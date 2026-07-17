// src/services/radius_expander.js
const { db } = require("../config/firebase");
const { getDistance } = require("../utils/distance");
const { isCompatible } = require("./compatibility.service");
const { sendAlertNotification } = require("./fcm.service");

// Radial expansion milestones in kilometers
const RADIUS_STEPS = [10, 25, 50, 100, 250];

/**
 * Executes a deferred radius expansion step for an active blood request.
 * Checks if request has been accepted. If not, expands search radius and sends new alerts.
 * @param {string} requestId - The Firestore document ID of the request
 * @param {number} stepIndex - Current step index of RADIUS_STEPS
 */
async function triggerExpansionStep(requestId, stepIndex) {
  try {
    const reqRef = db.collection("blood_requests").doc(requestId);
    const reqSnap = await reqRef.get();

    if (!reqSnap.exists) return;
    const request = reqSnap.data();

    // Stop if resolved or already accepted
    if (request.status === "completed" || request.acceptedBy) {
      console.log(`ℹ️ Request ${requestId} already completed or accepted. Stopping expansion.`);
      return;
    }

    if (stepIndex >= RADIUS_STEPS.length) {
      console.log(`🏁 Maximum search radius reached for request ${requestId}.`);
      return;
    }

    const nextRadius = RADIUS_STEPS[stepIndex];
    console.log(`📡 Expanding search radius to ${nextRadius}km for request ${requestId}...`);

    // Update radius in request
    await reqRef.update({
      currentRadius: nextRadius,
      stepIndex: stepIndex
    });

    // Find compatible donors within the new radius limit
    const usersSnap = await db.collection("users")
      .where("isDonor", isEqualTo: true)
      .get();

    const newTokens = [];
    const notifiedList = request.notifiedDonors || [];

    for (const doc of usersSnap.docs) {
      const u = doc.data();
      const hasToken = !!u.fcmToken;
      const hasLocation = u.lat != null && u.lng != null;
      
      if (!hasToken || !hasLocation) continue;
      
      // Skip if already notified in previous cycles
      if (notifiedList.includes(doc.id)) continue;
      
      // Skip if unavailable
      if (u.availability === "Unavailable" || u.availability === "Sleeping" || u.availability === "Busy") {
        continue;
      }

      // Check blood compatibility (Smart Compatibility Engine)
      const bloodMatch = isCompatible(request.bloodGroup, u.bloodGroup);
      if (!bloodMatch) continue;

      const distance = getDistance(u.lat, u.lng, request.lat, request.lng);
      
      // Limit to current expanded step radius
      if (distance <= nextRadius) {
        newTokens.push(u.fcmToken);
        notifiedList.push(doc.id);
      }
    }

    if (newTokens.length > 0) {
      console.log(`📤 Sending notifications to ${newTokens.length} additional compatible donors...`);
      await sendAlertNotification(newTokens, {
        bloodGroup: request.bloodGroup,
        location: request.location,
        phone: request.phone,
        requestId: requestId,
        urgency: request.urgency
      });

      // Update notified donors list in DB
      await reqRef.update({
        notifiedDonors: notifiedList
      });
    }

    // Schedule next expansion step after 30 seconds for simulation (2 minutes in production)
    const timeoutMs = process.env.NODE_ENV === "production" ? 120000 : 30000;
    setTimeout(() => {
      triggerExpansionStep(requestId, stepIndex + 1);
    }, timeoutMs);

  } catch (e) {
    console.error("❌ Radius expansion error:", e);
  }
}

/**
 * Initializes radius expansion scheduler for a new request.
 * @param {string} requestId
 */
function scheduleRadiusExpansion(requestId) {
  const timeoutMs = process.env.NODE_ENV === "production" ? 120000 : 30000;
  setTimeout(() => {
    triggerExpansionStep(requestId, 1); // Step 1 is 25km (step 0 was initial 10km)
  }, timeoutMs);
}

module.exports = {
  scheduleRadiusExpansion,
  triggerExpansionStep
};
