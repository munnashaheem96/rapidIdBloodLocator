// src/controllers/alert.controller.js
const { db } = require("../config/firebase");
const { getDistance } = require("../utils/distance");
const { isCompatible } = require("../services/compatibility.service");
const { sendAlertNotification, cleanInvalidTokens } = require("../services/fcm.service");
const { scheduleRadiusExpansion } = require("../services/radius_expander");
const { classifyEmergency, recommendHospitals, forecastBloodDemand } = require("../services/ai.service");

/**
 * Handle incoming emergency broadcast requests.
 */
async function sendAlert(req, res) {
  try {
    const request = req.body;
    console.log("🔥 Incoming request:", request);

    if (!request.lat || !request.lng || !request.bloodGroup) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // AI Emergency Triage Prediction
    const triageResult = await classifyEmergency({
      notes: request.notes || "",
      units: request.units || 1,
      bloodGroup: request.bloodGroup
    });
    
    console.log("🧠 AI Triage Prediction:", triageResult);

    // Save initial request document if matching database entry not already present
    let requestId = request.requestId;
    if (!requestId) {
      const docRef = await db.collection("blood_requests").add({
        name: request.name || "Unknown Patient",
        bloodGroup: request.bloodGroup,
        units: Number(request.units || 1),
        location: request.location || "Nearby",
        lat: Number(request.lat),
        lng: Number(request.lng),
        phone: request.phone || "9999999999",
        urgency: triageResult.urgency,
        aiConfidence: triageResult.confidence,
        aiRationale: triageResult.rationale,
        notes: request.notes || "",
        currentRadius: 10, // Initial radius step (10km)
        createdAt: new Date(),
        status: "active"
      });
      requestId = docRef.id;
    } else {
      // Update existing document with AI triage values
      await db.collection("blood_requests").doc(requestId).update({
        urgency: triageResult.urgency,
        aiConfidence: triageResult.confidence,
        aiRationale: triageResult.rationale
      });
    }

    const usersSnap = await db.collection("users").get();

    const tokens = [];
    const userDocIds = [];
    const initialNotifiedList = [];

    for (const doc of usersSnap.docs) {
      const u = doc.data();

      const hasToken = !!u.fcmToken;
      const hasLocation = u.lat != null && u.lng != null;

      if (!hasToken || !hasLocation) continue;
      
      // Filter out unavailable donors
      if (u.availability === "Unavailable" || u.availability === "Sleeping" || u.availability === "Busy") {
        continue;
      }

      // Check Smart Blood Compatibility Rules
      const bloodMatch = isCompatible(request.bloodGroup, u.bloodGroup);
      if (!bloodMatch) continue;

      // Filter by initial radius limit (10km)
      const distance = getDistance(u.lat, u.lng, request.lat, request.lng);
      if (distance > 10) continue; 

      tokens.push(u.fcmToken);
      userDocIds.push(doc.id);
      initialNotifiedList.push(doc.id);
    }

    // Save notified list in Firestore request
    await db.collection("blood_requests").doc(requestId).update({
      notifiedDonors: initialNotifiedList,
      currentRadius: 10,
      stepIndex: 0
    });

    if (tokens.length === 0) {
      console.log("⚠️ No eligible matching donors found within initial 10km.");
      // Schedule background radius expansion task
      scheduleRadiusExpansion(requestId);
      return res.json({ 
        success: true, 
        sent: 0, 
        requestId,
        urgency: triageResult.urgency,
        confidence: triageResult.confidence 
      });
    }

    console.log(`📤 Dispatching notification to ${tokens.length} matching donors within 10km.`);

    const sendResult = await sendAlertNotification(tokens, {
      bloodGroup: request.bloodGroup,
      location: request.location,
      phone: request.phone,
      requestId: requestId,
      urgency: triageResult.urgency
    });

    // Prune invalid tokens
    if (sendResult.invalidTokenIndices && sendResult.invalidTokenIndices.length > 0) {
      await cleanInvalidTokens(userDocIds, sendResult.invalidTokenIndices, db);
    }

    console.log(`✅ Completed alerts: ${sendResult.successCount}/${tokens.length}`);

    // Schedule background radius expansion task
    scheduleRadiusExpansion(requestId);

    res.json({ 
      success: true, 
      sent: sendResult.successCount, 
      requestId,
      urgency: triageResult.urgency,
      confidence: triageResult.confidence 
    });
  } catch (e) {
    console.error("❌ Send Alert error:", e);
    res.status(500).json({ error: "Failed to broadcast alert" });
  }
}

/**
 * Handle AI Triage endpoint.
 */
async function triageSymptom(req, res) {
  try {
    const { notes, units, bloodGroup } = req.body;
    if (!notes) {
      return res.status(400).json({ error: "Symptom notes are required" });
    }

    const triageResult = await classifyEmergency({ notes, units, bloodGroup });
    res.json(triageResult);
  } catch (e) {
    console.error("❌ AI Triage error:", e);
    res.status(500).json({ error: "Triage process failed" });
  }
}

/**
 * Handle Hospital AI Recommendations endpoint.
 */
async function getHospitalRecommendation(req, res) {
  try {
    const { lat, lng, bloodGroup, hospitals } = req.body;
    if (!lat || !lng || !bloodGroup || !hospitals) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const rankedHospitals = await recommendHospitals({ lat, lng }, hospitals, bloodGroup);
    res.json(rankedHospitals);
  } catch (e) {
    console.error("❌ Recommendation failed:", e);
    res.status(500).json({ error: "Failed to calculate recommendations" });
  }
}

/**
 * Handle blood demand forecast forecasting endpoint.
 */
async function getDemandForecast(req, res) {
  try {
    const { hospitalId, history } = req.body;
    if (!hospitalId) {
      return res.status(400).json({ error: "hospitalId is required" });
    }

    const forecast = await forecastBloodDemand(hospitalId, history || []);
    res.json(forecast);
  } catch (e) {
    console.error("❌ Forecast failed:", e);
    res.status(500).json({ error: "Failed to generate demand forecast" });
  }
}

const orchestrationService = require("../services/orchestration.service");
const predictiveService = require("../services/predictive.service");

/**
 * Run full Multi-Agent AI Orchestrator and write Digital Twin.
 */
async function orchestrateEmergencyIncident(req, res) {
  try {
    const payload = req.body;
    if (!payload.patientName || !payload.lat || !payload.lng || !payload.bloodGroup) {
      return res.status(400).json({ error: "Missing required orchestration fields" });
    }

    const digitalTwin = await orchestrationService.orchestrateEmergency(payload);
    res.json(digitalTwin);
  } catch (e) {
    console.error("❌ Orchestration failed:", e);
    res.status(500).json({ error: "Emergency orchestrator failed" });
  }
}

/**
 * Calculate automated inventory rebalancing directions across hospitals.
 */
async function getBloodGridRebalance(req, res) {
  try {
    const transfers = await predictiveService.calculateGridRebalancing();
    res.json(transfers);
  } catch (e) {
    console.error("❌ Rebalancing failed:", e);
    res.status(500).json({ error: "Failed to calculate rebalance directives" });
  }
}

/**
 * Generate simulated disaster twin incidents to test responders.
 */
async function simulateDisasterZone(req, res) {
  try {
    const { disasterType, locationName, lat, lng } = req.body;
    if (!disasterType || !lat || !lng) {
      return res.status(400).json({ error: "Missing required disaster parameters" });
    }

    const numericLat = parseFloat(lat);
    const numericLng = parseFloat(lng);

    const simulationIncident = {
      id: "SIM_INCIDENT_" + Math.floor(1000 + Math.random() * 9000),
      patientName: "Simulated Casualty (Disaster Test)",
      patientPhone: "108",
      location: {
        lat: numericLat + (Math.random() - 0.5) * 0.02,
        lng: numericLng + (Math.random() - 0.5) * 0.02,
        address: locationName || "Simulation Geofence Zone"
      },
      medicalStatus: {
        symptoms: `${disasterType} blast/trauma impact`,
        triageLevel: "CRITICAL",
        agentDiagnosis: `Disaster simulation case: ${disasterType}`
      },
      assignedHospital: {
        hospitalId: "HOSP_SIM_01",
        name: "Regional Mobile Med-Unit",
        reasoning: "Closest simulation responder",
        confidenceScore: 99
      },
      status: "dispatched",
      timelineLogs: [
        { status: "detected", time: new Date().toISOString(), desc: "Disaster simulated event triggered" }
      ],
      createdAt: new Date(),
      isSimulation: true
    };

    // Save mock simulation incident to Firestore
    await db.collection("incidents").doc(simulationIncident.id).set(simulationIncident);

    res.json({
      success: true,
      assessment: {
        threatLevel: "EXTREME",
        safetyBoundaryMeters: 5000,
        ndmaHandoffStatus: "COMPLETED"
      },
      incident: simulationIncident
    });
  } catch (e) {
    console.error("❌ Simulation failed:", e);
    res.status(500).json({ error: "Disaster simulation failed" });
  }
}

module.exports = {
  sendAlert,
  triageSymptom,
  getHospitalRecommendation,
  getDemandForecast,
  orchestrateEmergencyIncident,
  getBloodGridRebalance,
  simulateDisasterZone
};
