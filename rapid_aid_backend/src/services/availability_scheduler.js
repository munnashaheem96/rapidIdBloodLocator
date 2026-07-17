// src/services/availability_scheduler.js
const { db } = require("../config/firebase");

/**
 * Periodically scans the users collection in Firestore to locate users whose 
 * active donor availability status has expired, and resets them to 'Unavailable'.
 */
async function checkExpiredAvailabilities() {
  try {
    const now = new Date();
    console.log(`⏱️ Running donor availability expiry check at: ${now.toISOString()}`);

    const expiredSnap = await db.collection("users")
      .where("availabilityExpiresAt", "<=", now)
      .get();

    if (expiredSnap.empty) {
      return;
    }

    const batch = db.batch();
    let count = 0;

    expiredSnap.docs.forEach(doc => {
      const data = doc.data();
      // Only reset if they aren't already marked Unavailable
      if (data.availability !== "Unavailable") {
        console.log(`🧹 Expiring active status for donor: ${doc.id} (${data.name})`);
        batch.update(doc.ref, {
          availability: "Unavailable",
          availabilityExpiresAt: null
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`✅ Reset ${count} expired donor availability records to 'Unavailable'.`);
    }
  } catch (e) {
    console.error("❌ Error running availability scheduler:", e);
  }
}

/**
 * Initializes the background timer task for checking expired availabilities.
 * Runs every 5 minutes in production, 1 minute in development/test.
 */
function startAvailabilityScheduler() {
  const intervalMs = process.env.NODE_ENV === "production" ? 300000 : 60000;
  console.log(`🚀 Starting donor availability scheduler (Interval: ${intervalMs / 1000}s)`);
  
  // Initial immediate check
  checkExpiredAvailabilities();

  setInterval(checkExpiredAvailabilities, intervalMs);
}

module.exports = {
  checkExpiredAvailabilities,
  startAvailabilityScheduler
};
