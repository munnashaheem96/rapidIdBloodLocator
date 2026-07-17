// src/services/fcm.service.js
const admin = require("firebase-admin");

/**
 * Send multicast notification to registered donor tokens.
 * @param {Array<string>} tokens - List of FCM tokens
 * @param {Object} alertData - Data to send with alert
 * @param {string} alertData.bloodGroup
 * @param {string} alertData.location
 * @param {string} alertData.phone
 * @param {string} alertData.requestId
 * @param {string} alertData.urgency
 * @param {string} [alertData.type] - e.g. 'blood_request', 'disaster'
 * @returns {Promise<{successCount: number, invalidTokens: Array<number>}>}
 */
async function sendAlertNotification(tokens, alertData) {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, invalidTokens: [] };
  }

  const payload = {
    tokens,
    data: {
      bloodGroup: String(alertData.bloodGroup),
      location: String(alertData.location || "Nearby"),
      phone: String(alertData.phone || "9999999999"),
      requestId: String(alertData.requestId || ""),
      urgency: String(alertData.urgency || "Urgent"),
      type: String(alertData.type || "blood_request"),
      click_action: "FLUTTER_NOTIFICATION_CLICK"
    },
    android: {
      priority: "high",
      notification: {
        sound: "emergency",
        channelId: "emergency_alerts",
        title: `🚨 Emergency Alert: ${alertData.bloodGroup} Required`,
        body: `A patient needs matching blood at ${alertData.location}. Urgent level: ${alertData.urgency}.`
      }
    }
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(payload);
    
    let successCount = 0;
    const invalidTokenIndices = [];

    response.responses.forEach((res, idx) => {
      if (res.success) {
        successCount++;
      } else {
        const code = res.error?.code;
        console.log(`❌ Error sending to token at index ${idx}:`, code);
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidTokenIndices.push(idx);
        }
      }
    });

    return {
      successCount,
      invalidTokenIndices
    };
  } catch (e) {
    console.error("❌ FCM Multicast failed:", e);
    throw e;
  }
}

/**
 * Remove invalid fcmTokens from user documents.
 * @param {Array<string>} userDocIds - User document IDs matching the tokens array indices
 * @param {Array<number>} invalidTokenIndices - Indices of invalid tokens to clean
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 */
async function cleanInvalidTokens(userDocIds, invalidTokenIndices, db) {
  if (invalidTokenIndices.length === 0) return;

  const batch = db.batch();
  invalidTokenIndices.forEach(idx => {
    const docId = userDocIds[idx];
    if (docId) {
      console.log("🧹 Pruning invalid token for user:", docId);
      const userRef = db.collection("users").doc(docId);
      batch.update(userRef, {
        fcmToken: admin.firestore.FieldValue.delete()
      });
    }
  });

  await batch.commit();
}

module.exports = {
  sendAlertNotification,
  cleanInvalidTokens
};
