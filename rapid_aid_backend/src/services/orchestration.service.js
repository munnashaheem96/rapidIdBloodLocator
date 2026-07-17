const { db, admin } = require("../config/firebase");
const agents = require("./agents");
const fcmService = require("./fcm.service");
const distanceUtil = require("../utils/distance");

// Fallback Mock Hospitals if collection 'hospitals' is empty or doesn't exist
const MOCK_HOSPITALS = [
  {
    id: "HOSP_01",
    name: "Fortis Hospital & Trauma Centre",
    lat: 12.9715987,
    lng: 77.5945627,
    trafficFactor: 0.9,
    icuAvailable: true,
    specialistsOnDuty: true,
    bloodInventory: { "O-": 12, "A+": 25, "B+": 18, "AB+": 10 }
  },
  {
    id: "HOSP_02",
    name: "Apollo Emergency Care",
    lat: 12.965,
    lng: 77.601,
    trafficFactor: 0.6,
    icuAvailable: true,
    specialistsOnDuty: false,
    bloodInventory: { "O-": 0, "A+": 15, "B+": 5, "AB+": 22 }
  },
  {
    id: "HOSP_03",
    name: "St. John's Medical College",
    lat: 12.934,
    lng: 77.621,
    trafficFactor: 0.8,
    icuAvailable: false,
    specialistsOnDuty: true,
    bloodInventory: { "O-": 8, "A+": 0, "B+": 30, "AB+": 15 }
  }
];

/**
 * Main AI Emergency Orchestrator pipeline.
 * Coordinates triage classification, routing recommendations, donor matching, and citizen responders.
 */
async function orchestrateEmergency(payload) {
  const {
    patientName,
    patientPhone,
    symptoms,
    bloodGroup,
    lat,
    lng,
    notes = ""
  } = payload;

  const numericLat = parseFloat(lat);
  const numericLng = parseFloat(lng);

  console.log(`🧠 Orchestrator triggered for patient: ${patientName} (${bloodGroup}) at [${numericLat}, ${numericLng}]`);

  // 1. Run Emergency AI triage classification
  const triageResult = agents.EmergencyAI.analyzeUrgency(symptoms);

  // 2. Fetch treatment directives from Medical AI
  const medicalDirectives = agents.MedicalAI.getDirectives(triageResult.level);

  // 3. Smart Hospital Recommendation Engine ranking
  // Attempt to fetch live hospital collection or use fallback mocks
  let hospitals = [];
  try {
    const hospSnap = await db.collection("hospitals").get();
    if (!hSnap.empty) {
      hospSnap.forEach(doc => {
        hospitals.push({ id: doc.id, ...doc.data() });
      });
    } else {
      hospitals = MOCK_HOSPITALS;
    }
  } catch (e) {
    console.log("⚠️ Failed to query Firestore hospitals. Defaulting to mock grid.");
    hospitals = MOCK_HOSPITALS;
  }

  const hospitalRankings = agents.HospitalRoutingAI.rankHospitals(
    numericLat,
    numericLng,
    bloodGroup,
    hospitals
  );
  const bestHospital = hospitalRankings[0] || {
    hospitalId: "UNKNOWN",
    name: "Nearest General Care",
    finalScore: 50,
    etaMinutes: 15,
    reasons: "Default routing",
    lat: numericLat + 0.01,
    lng: numericLng + 0.01
  };

  // 4. Match blood donors dynamically
  let matchingDonors = [];
  let fcmTokens = [];
  let userDocIds = [];

  try {
    const usersSnap = await db.collection("users")
      .where("isDonor", "==", true)
      .get();
    
    const donorsList = [];
    usersSnap.forEach(doc => {
      const u = doc.data();
      if (u.lat && u.lng) {
        const dist = distanceUtil.getDistance(numericLat, numericLng, u.lat, u.lng);
        donorsList.push({ uid: doc.id, distanceKm: dist, ...u });
      }
    });

    matchingDonors = agents.BloodMatchingAI.matchDonors(bloodGroup, donorsList);
    
    // Extract tokens for push
    matchingDonors.forEach(donor => {
      const donorDoc = donorsList.find(d => d.uid === donor.uid);
      if (donorDoc && donorDoc.fcmToken) {
        fcmTokens.push(donorDoc.fcmToken);
        userDocIds.push(donor.uid);
      }
    });
  } catch (e) {
    console.error("⚠️ Failed to retrieve live matching donors:", e);
  }

  // 5. Intelligent Dispatch for Citizen Responders (CPR, Doctor, Nurses)
  let localResponders = [];
  try {
    // Roles map: Doctors, Nurses, CPR responders
    const respondersSnap = await db.collection("users")
      .where("isResponder", "==", true)
      .get();

    const volList = [];
    respondersSnap.forEach(doc => {
      const v = doc.data();
      if (v.lat && v.lng) {
        volList.push({ uid: doc.id, ...v });
      }
    });

    // Select CPR responders if critical, doctors if urgent/general
    const roleNeeded = triageResult.level === "CRITICAL" ? "CPR Volunteer" : "Doctor";
    localResponders = agents.VolunteerDispatchAI.dispatchBestResponders(
      numericLat,
      numericLng,
      volList,
      roleNeeded
    );

    // Append responder tokens for FCM alerts
    localResponders.forEach(v => {
      const volDoc = volList.find(d => d.uid === v.uid);
      if (volDoc && volDoc.fcmToken) {
        fcmTokens.push(volDoc.fcmToken);
        userDocIds.push(v.uid);
      }
    });
  } catch (e) {
    console.error("⚠️ Failed to retrieve citizen responders network:", e);
  }

  // 6. Analytics AI Estimate ETA/Completion duration
  const estimatedCompletionMinutes = agents.AnalyticsAI.estimateCompletionTime(
    bestHospital.etaMinutes,
    localResponders[0]?.etaMinutes || 10,
    triageResult.level
  );

  const completionTimestamp = new Date();
  completionTimestamp.setMinutes(completionTimestamp.getMinutes() + estimatedCompletionMinutes);

  // 7. Write to "incidents" Digital Twin Collection in Firestore
  const incidentRef = db.collection("incidents").doc();
  const incidentTwin = {
    id: incidentRef.id,
    patientName,
    patientPhone,
    location: {
      lat: numericLat,
      lng: numericLng,
      address: notes || "Emergency Location"
    },
    medicalStatus: {
      symptoms,
      triageLevel: triageResult.level,
      agentDiagnosis: triageResult.diagnosis
    },
    assignedHospital: {
      hospitalId: bestHospital.hospitalId,
      name: bestHospital.name,
      reasoning: bestHospital.reasons,
      confidenceScore: bestHospital.finalScore,
      lat: bestHospital.lat,
      lng: bestHospital.lng
    },
    assignedAmbulance: {
      id: "AMB_" + Math.floor(1000 + Math.random() * 9000),
      driverName: "Emergency Response Crew",
      phone: "108",
      lat: numericLat + 0.005,
      lng: numericLng - 0.005,
      etaMinutes: bestHospital.etaMinutes
    },
    responders: {
      acceptedVolunteers: localResponders.map(r => r.uid),
      acceptedDonors: matchingDonors.map(d => d.uid)
    },
    timelineLogs: [
      { status: "detected", time: new Date().toISOString(), desc: "Emergency incident detected & logged" },
      { status: "triaged", time: new Date().toISOString(), desc: `AI classified incident severity as ${triageResult.level}` },
      { status: "assigned", time: new Date().toISOString(), desc: `Routed to ${bestHospital.name} (${bestHospital.reasons})` }
    ],
    status: "dispatched",
    estimatedCompletion: completionTimestamp.toISOString(),
    createdAt: admin.firestore.Timestamp.now()
  };

  await incidentRef.set(incidentTwin);
  console.log(`✅ Live Digital Twin created successfully: ${incidentRef.id}`);

  // 8. Fire FCM Multicast broadcasts to matched responders & compatible donors
  if (fcmTokens.length > 0) {
    try {
      console.log(`📡 Alerting ${fcmTokens.length} nearby matching volunteers via FCM...`);
      const fcmResult = await fcmService.sendAlertNotification(fcmTokens, {
        bloodGroup,
        location: notes || "Nearby Emergency",
        phone: patientPhone,
        requestId: incidentRef.id,
        urgency: triageResult.level,
        type: "incident_twin"
      });

      // Clean invalid tokens automatically
      if (fcmResult.invalidTokenIndices && fcmResult.invalidTokenIndices.length > 0) {
        await fcmService.cleanInvalidTokens(userDocIds, fcmResult.invalidTokenIndices, db);
      }
    } catch (e) {
      console.error("⚠️ Failed to dispatch multicast notification alerts:", e);
    }
  }

  return incidentTwin;
}

module.exports = {
  orchestrateEmergency
};
