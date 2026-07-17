// src/services/ai.service.js
const http = require("https");

/**
 * AI Emergency Assistant, Triage, and Inventory Forecast services.
 * Integrates with Gemini or falls back to an offline rule-based prediction engine.
 */

/**
 * Predict Emergency Severity & Triage category
 * @param {Object} patientInfo 
 * @param {string} patientInfo.notes - Medical condition notes
 * @param {number} patientInfo.units - Required blood units
 * @param {string} patientInfo.bloodGroup - Needed blood type
 * @returns {Promise<{urgency: string, confidence: number, rationale: string}>}
 */
async function classifyEmergency(patientInfo) {
  const notes = (patientInfo.notes || "").toLowerCase();
  const units = Number(patientInfo.units || 1);
  const blood = patientInfo.bloodGroup;

  // Default parameters
  let urgency = "Normal";
  let confidence = 0.85;
  let rationale = "Standard automated triage based on request criteria.";

  // Rule-based classification algorithm
  if (notes.includes("cpr") || notes.includes("cardiac") || notes.includes("accident") || notes.includes("unconscious") || notes.includes("heavy bleeding") || notes.includes("head injury") || units >= 5) {
    urgency = "Critical";
    confidence = 0.94;
    rationale = "Critical triage classification: High units requested or severe keywords detected (Accident/Cardiac).";
  } else if (notes.includes("surgery") || notes.includes("operation") || notes.includes("internal bleeding") || notes.includes("fracture") || units >= 3) {
    urgency = "Urgent";
    confidence = 0.90;
    rationale = "Urgent triage classification: Scheduled surgery or moderate quantity request.";
  } else if (notes.includes("mass casualty") || notes.includes("disaster") || notes.includes("flood") || notes.includes("earthquake") || units >= 8) {
    urgency = "Mass Casualty";
    confidence = 0.97;
    rationale = "Mass Casualty classification: Global disaster indicator or extremely high volumes required.";
  }

  // Attempt to call Gemini API if key is present
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const result = await callGeminiTriage(apiKey, notes, units, blood);
      if (result) {
        return result;
      }
    } catch (e) {
      console.warn("⚠️ Gemini classification failed, using offline fallback:", e.message);
    }
  }

  return { urgency, confidence, rationale };
}

/**
 * Predict blood inventory demand forecast for hospitals
 * @param {string} hospitalId 
 * @param {Array<Object>} history - Recent hospital requests
 * @returns {Promise<{forecast: Object, alerts: Array<string>}>}
 */
async function forecastBloodDemand(hospitalId, history) {
  // Mock statistical demand prediction
  const now = new Date();
  const month = now.getMonth();
  
  // High demand seasons in India: Monsoon (dengue season: Jul-Oct), festive periods.
  const isHighDemandMonth = month >= 6 && month <= 9; // July to October
  
  const forecast = {
    'O-': isHighDemandMonth ? 8 : 4,
    'O+': isHighDemandMonth ? 18 : 12,
    'A+': isHighDemandMonth ? 15 : 10,
    'B+': isHighDemandMonth ? 20 : 14,
    'AB+': isHighDemandMonth ? 6 : 4,
  };

  const alerts = [];
  if (isHighDemandMonth) {
    alerts.push("⚠️ Monsoon Dengue outbreak season active: Expect A+ and O+ demand spikes of 40-50%.");
  }

  return {
    forecast,
    alerts
  };
}

/**
 * AI Hospital Recommendation engine based on occupancy, blood stock, and traffic
 * @param {Object} location - Latitude/Longitude coordinates
 * @param {Array<Object>} hospitals - List of candidate hospitals
 * @param {string} bloodGroup - Required blood group
 * @returns {Promise<Array<Object>>} Ranked list of hospital options
 */
async function recommendHospitals(location, hospitals, bloodGroup) {
  // Rank hospitals dynamically by balancing distance, traffic, and blood availability
  return hospitals.map(h => {
    const hasBlood = h.inventory && h.inventory[bloodGroup] > 0;
    const distanceKm = h.distance || 5;
    const currentOccupancy = h.occupancy || 0.7; // ratio
    
    // Scored metric (lower is better rank)
    let score = distanceKm * 1.0;
    if (!hasBlood) score += 15; // penalize heavily if required blood is out of stock
    score += currentOccupancy * 8; // penalize if hospital ICU is crowded
    
    return {
      ...h,
      suitabilityScore: Number(score.toFixed(2)),
      reasoning: hasBlood 
        ? `Recommended: Required blood (${bloodGroup}) is currently in stock. Proximity: ${distanceKm}km.`
        : `Fallback: Low or zero stock of ${bloodGroup}. Recommendation adjusted.`
    };
  }).sort((a, b) => a.suitabilityScore - b.suitabilityScore);
}

/**
 * Call Gemini API to execute symptom triage
 */
function callGeminiTriage(apiKey, notes, units, bloodGroup) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: `Evaluate the following medical request details and return a JSON object with keys "urgency" (values: "Normal", "Urgent", "Critical", "Mass Casualty"), "confidence" (number between 0 and 1), and "rationale" (short explanation string). Details:\nNotes: "${notes}"\nUnits needed: ${units}\nBlood Group: "${bloodGroup}". Return raw JSON only.`
        }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const responseText = parsed.candidates[0].content.parts[0].text;
          
          // Regex extraction of JSON block
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            resolve({
              urgency: data.urgency || "Urgent",
              confidence: Number(data.confidence || 0.8),
              rationale: data.rationale || "AI Analyzed"
            });
          } else {
            reject(new Error("No JSON object found in response"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

module.exports = {
  classifyEmergency,
  forecastBloodDemand,
  recommendHospitals
};
