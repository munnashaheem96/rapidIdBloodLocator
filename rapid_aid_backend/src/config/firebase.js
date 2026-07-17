// src/config/firebase.js
const admin = require("firebase-admin");

let db;

try {
  if (admin.apps.length === 0) {
    let credential;
    if (process.env.FIREBASE_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
      credential = admin.credential.cert(serviceAccount);
    } else {
      // Local fallback key if present
      const path = require("path");
      const localKeyPath = path.join(__dirname, "../../serviceAccountKey.json");
      if (require("fs").existsSync(localKeyPath)) {
        credential = admin.credential.cert(require(localKeyPath));
      } else {
        console.warn("⚠️ No Firebase Credentials found in Env or file path. Live database calls will fail.");
      }
    }

    if (credential) {
      admin.initializeApp({
        credential
      });
    } else {
      admin.initializeApp(); // fallback default init
    }
  }
  db = admin.firestore();
} catch (e) {
  console.error("❌ Firebase Admin Initialization failed:", e);
}

module.exports = {
  admin,
  db
};
