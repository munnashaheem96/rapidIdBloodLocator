const compatibilityService = require("./compatibility.service");
const distanceUtil = require("../utils/distance");

// 🧠 1. Emergency AI Agent: Evaluates symptoms and determines urgency triage severity levels
const EmergencyAI = {
  analyzeUrgency: (symptoms = "") => {
    const text = symptoms.toLowerCase();
    let level = "NORMAL";
    let diagnosis = "Non-acute general request. Standard queue dispatch.";

    if (text.includes("cpr") || text.includes("cardiac") || text.includes("heart attack") || text.includes("unconscious")) {
      level = "CRITICAL";
      diagnosis = "Suspected severe cardiovascular event or loss of consciousness. Red alert triggered.";
    } else if (text.includes("stroke") || text.includes("heavy bleeding") || text.includes("fracture") || text.includes("accident")) {
      level = "URGENT";
      diagnosis = "Acute physical trauma or stroke symptoms. High-priority response dispatched.";
    } else if (text.includes("mass casualty") || text.includes("disaster") || text.includes("collapse")) {
      level = "MASS CASUALTY";
      diagnosis = "Multiple potential victims flagged. Direct handoff to national NDMA portals.";
    }

    return { level, diagnosis, confidence: 96 };
  }
};

// 🏥 2. Medical AI Agent: Recommends immediate first-aid directives
const MedicalAI = {
  getDirectives: (triageLevel) => {
    if (triageLevel === "CRITICAL") {
      return [
        "Initiate CPR immediately if patient is unresponsive.",
        "Ensure clear airway access; place patient on back on firm surface.",
        "Prepare AED device if available locally."
      ];
    } else if (triageLevel === "URGENT") {
      return [
        "Apply direct pressure to bleeding zones with clean dressings.",
        "Immobilize any affected joints; do not attempt to realign bones.",
        "Keep patient calm, warm, and elevated."
      ];
    }
    return [
      "Keep patient resting in comfortable position.",
      "Monitor vitals while responder team transitions.",
      "Ensure access point is visible to arriving crew."
    ];
  }
};

// 🩸 3. Blood Matching AI Agent: Filters donor registries based on receiver compatibility
const BloodMatchingAI = {
  matchDonors: (requiredGroup, donors = []) => {
    const matched = donors.filter(donor => {
      const matchDetails = compatibilityService.checkCompatibility(requiredGroup, donor.bloodGroup);
      return matchDetails.compatible;
    });

    return matched.map(donor => ({
      uid: donor.uid,
      name: donor.name,
      bloodGroup: donor.bloodGroup,
      distanceKm: donor.distanceKm || 0,
      reputationScore: donor.donorPoints || 100
    }));
  }
};

// 🏨 4. Hospital Routing AI Agent: Evaluates hospital options using weighted scores
const HospitalRoutingAI = {
  rankHospitals: (patientLat, patientLng, bloodGroup, hospitals = []) => {
    const scored = hospitals.map(h => {
      const dist = distanceUtil.getDistance(patientLat, patientLng, h.lat, h.lng);
      
      // Calculate weighted components
      const distScore = Math.max(0, 100 - (dist * 4)); // 30% weight
      const trafficFactor = h.trafficFactor || 0.8; // 0.0 (blocked) to 1.0 (free) - 20% weight
      const trafficScore = trafficFactor * 100;
      
      const hasBlood = (h.bloodInventory && h.bloodInventory[bloodGroup] > 0) ? 1.0 : 0.0; // 25% weight
      const bloodScore = hasBlood * 100;
      
      const icuReadiness = h.icuAvailable ? 100 : 30; // 15% weight
      const doctorScore = h.specialistsOnDuty ? 100 : 50; // 10% weight

      const finalScore = Math.round(
        (distScore * 0.3) +
        (trafficScore * 0.2) +
        (bloodScore * 0.25) +
        (icuReadiness * 0.15) +
        (doctorScore * 0.1)
      );

      // Generate explainable AI reasoning
      const reasons = [];
      if (dist < 5) reasons.push(`Close proximity (${dist.toFixed(1)} km)`);
      if (trafficFactor > 0.8) reasons.push("Low traffic congestion along route");
      if (hasBlood > 0) reasons.push(`Required blood group (${bloodGroup}) available in active grid`);
      if (h.icuAvailable) reasons.push("ICU beds ready");
      if (h.specialistsOnDuty) reasons.push("Trauma specialists active on site");

      return {
        hospitalId: h.id,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        finalScore,
        etaMinutes: Math.round(dist * 2 / trafficFactor) + 2,
        reasons: reasons.join(", ") || "Nearest standard care provider",
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.finalScore - a.finalScore);
    return scored;
  }
};

// 👮 5. Volunteer Dispatch AI Agent: Optimization loop for citizen networks
const VolunteerDispatchAI = {
  dispatchBestResponders: (patientLat, patientLng, volunteers = [], requestedRole) => {
    const list = volunteers
      .filter(v => v.isActive && v.role === requestedRole)
      .map(v => {
        const dist = distanceUtil.getDistance(patientLat, patientLng, v.lat, v.lng);
        const eta = Math.round(dist * 3) + 1; // standard walk speed approximation
        
        // Intelligent Dispatch Score calculation
        const repFactor = (v.reputationPoints || 100) / 1000;
        const battFactor = (v.batteryLevel || 80) / 100;
        const netFactor = v.networkQuality === "EXCELLENT" ? 1.0 : v.networkQuality === "GOOD" ? 0.8 : 0.4;
        
        const score = Math.round(
          (Math.max(0, 100 - (dist * 10)) * 0.4) + // Distance ETA (40%)
          (repFactor * 100 * 0.3) +                // Volunteer Reputation (30%)
          (battFactor * 100 * 0.2) +               // Device battery stability (20%)
          (netFactor * 100 * 0.1)                  // Signal quality (10%)
        );

        return {
          uid: v.uid,
          name: v.name,
          role: v.role,
          distanceKm: dist,
          etaMinutes: eta,
          dispatchScore: score
        };
      });

    // Sort by dispatch priority score
    list.sort((a, b) => b.dispatchScore - a.dispatchScore);
    return list.slice(0, 3); // Dispatch top 3 best matching local guardians
  }
};

// 📊 6. Analytics AI Agent: Computes dynamic time-series and queue analytics
const AnalyticsAI = {
  estimateCompletionTime: (hospitalEta, volunteerEta, severity) => {
    let baseTime = Math.max(hospitalEta, volunteerEta || 0);
    if (severity === "CRITICAL") baseTime += 15; // stabilization time
    else if (severity === "URGENT") baseTime += 10;
    else baseTime += 5;

    return baseTime; // in minutes
  }
};

// 🌪️ 7. Disaster Response AI Agent: Directs alerts based on catastrophe scale
const DisasterResponseAI = {
  evaluateZoneThreats: (disasterType, lat, lng) => {
    const threatDescription = `Mass emergency active. Geofencing triggered for ${disasterType} at [${lat.toFixed(4)}, ${lng.toFixed(4)}].`;
    return {
      threatDescription,
      requiresNdmaBroadcast: true,
      isolationRadiusMeters: 5000
    };
  }
};

module.exports = {
  EmergencyAI,
  MedicalAI,
  BloodMatchingAI,
  HospitalRoutingAI,
  VolunteerDispatchAI,
  AnalyticsAI,
  DisasterResponseAI
};
