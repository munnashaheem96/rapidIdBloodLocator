# Rapid Aid: Project Explanation & Technical Documentation

Rapid Aid is an emergency location-based blood locator and medical assistance ecosystem designed to connect blood seekers with nearby matching donors instantly, provide offline medical first-aid information, and serve critical health profiles via virtual and physical NFC cards.

This document provides a comprehensive technical guide, architecture map, codebase walk-through, and implementation details of the entire Rapid Aid system.

---

## 🌟 Current Features of the App (Upgraded Platform)

Rapid Aid has evolved from a simple blood locator into a comprehensive, national-level emergency response platform with the following advanced features:

### 1. Advanced Emergency Coordination & Triage
- **AI Triage System**: Integrates Gemini symptom parsing to analyze emergency severity levels (`Normal`, `Urgent`, `Critical`, `Mass Casualty`) with immediate step-by-step first-aid guidance.
- **Offline Triage Fallbacks**: Matches critical keywords locally (e.g. `cpr`, `cardiac`, `heart attack`, `unconscious`, `heavy bleeding`) to guarantee instant safety advice without internet access.
- **Accident Detection**: Uses accelerometer streams to catch high-impact collisions (shock force $\ge 4.5\text{G}$ or rapid speed drops) and trigger automated emergency countdown alerts.
- **Family SOS Beacon**: Provides a secure Panic Button that instantly dials emergency services (108), sends distress SMS messages, and streams continuous real-time coordinate logs and battery metrics.
- **NFC Medical Passports**: Secures local health metrics (diseases, allergies, blood group) using AES-256 encryption, allowing first responders to access details instantly via virtual or physical NFC cards.

### 2. Intelligent Backend Matching & Automation
- **Haversine Distance Filter**: Connects seekers to volunteers within a localized radius.
- **Smart Blood Compatibility Rules**: Computes exact and compatible blood type matching (O- universal compatibility, AB+ universal receipt) and ranks donor matches dynamically.
- **Automated Radius Expander**: Runs a scheduler that expands the search perimeter ($10\text{km} \rightarrow 25\text{km} \rightarrow 50\text{km} \rightarrow 100\text{km} \rightarrow 250\text{km}$) every 30 seconds if a request is unfulfilled.
- **Availability Auto-Expiry**: Resets active donor flags back to `Unavailable` dynamically to keep active dispatch queues clean and accurate.
- **FCM Token Cleansing**: Clears invalid push registration tokens from Firestore database registers upon receiving multicast transmission errors.

### 3. Command Dashboards & Operations Portals
- **Hospital Queue & Inventory Control**: Tracks current blood units, issues alert thresholds for low stock, and features Chart.js AI forecasting graphs predicting demand over a 7-day window.
- **Disaster Command Twin**: Presents a 2D digital twin map displaying coordinate markers, emergency logs, live progress timelines, and regional disaster alerts (Floods, Cyclones, Earthquakes, Fires).
- **NDMA & 108 CAD API Gateways**: Converts local incidents into standard National Disaster Management Authority and 108 Computer Aided Dispatch payload models.
- **Camera AI Visualizer**: Overlays outline guides (CPR posture ovals, tourniquet band placement lines) on mock camera frames to guide bystanders.

### 4. Gamified Donorship & History
- **Donor Reputation System**: Computes points and ranks volunteers across Bronze, Silver, Gold, Platinum, Diamond, and Legend tiers, displaying trust indicators and response speed metrics.
- **Donation History Logs**: Tracks volunteer logs, computes 90-day donation eligibility clocks, and exports simulated PDF Lifesaver Certificates.

---

## 🗺️ System Architecture & Data Flow

Rapid Aid operates on a tri-component architecture:
1. **Frontend Mobile Application (`rapid_aid`)**: Built using Flutter, providing location services, emergency triggers, maps, and offline assistant capabilities.
2. **Backend Server (`rapid_aid_backend`)**: Built with Node.js & Express, running on Render. It handles routing geo-spatial alerts and broadcasting push notifications.
3. **Web Emergency Profile (`rapid_aid_card`)**: HTML/CSS/Vanilla Javascript single-page app hosted on GitHub Pages that displays critical medical info when an emergency NFC card is tapped or a QR code is scanned.

```
+------------------+         1. Broadcast SOS Alert        +---------------------+
|   Seeker Mobile  | ====================================> |   Express Backend   |
|        App       |                                       |     (on Render)     |
+------------------+                                       +---------------------+
                                                                      ||
                                                            2. Fetch matching donors
                                                            & calculate distances
                                                                      ||
                                                                      \/
+------------------+         3. Send Multicast Push        +---------------------+
|  Nearby Matching | <==================================== |  Firebase Firestore |
|      Donors      |                                       |   & Firebase FCM    |
+------------------+                                       +---------------------+
```

---

## 📦 Project Components

### 1. Flutter Mobile App (`rapid_aid`)
The primary client application. It manages local permissions, updates the donor's coordinates and FCM tokens, enables emergency broadcasts, handles payments, and provides an offline AI Assistant.

* **Key Directories & Files:**
  * `lib/main.dart`: Standard initialization wrapper. Configures Geolocator permission handling, initial FCM setup, background message handling, and foreground/background push click behavior. Plays `emergency.mp3` on incoming alerts.
  * `lib/theme/app_theme.dart`: Centralized design system using Poppins typography, premium shadows, and curated gradients (medical crimson `primary`, soft slate `charcoal`, page gray `bgGrey`).
  * `lib/screens/`: Contains all user interfaces:
    * `home_screen.dart`: The user landing board showing the profile details, donor badge tier level (e.g. Silver), recent blood requests nearby, and category selectors.
    * `radar_scanner_screen.dart`: A circular rotating radar painter utilizing polar coordinates to display local matching donors. Generates mock data fallback if the database has zero matching records in range.
    * `ai_assistant_screen.dart`: Simulated chat widget for offline first-aid directions (CPR, choking/Heimlich, bleeding, burns, heart attack).
    * `emergency_card_screen.dart`: Configures the virtual emergency card rendering patient name, address, contact, and generating a `QRImageView` referencing `https://munnashaheem96.github.io/rapid-aid-card/user.html?id=$uid`. Includes Razorpay checkout navigation to order the physical NFC card for ₹140.
    * `create_request_screen.dart`: Captures patient name, bystander, required blood units, urgency level, and coordinates, saving to the Firestore `blood_requests` collection and sending an HTTP POST request to the backend endpoint.
    * `emergency_alert_screen.dart`: Overlay/modal showing detailed incoming emergency request parameters.
    * `ambulance_nearby.dart`, `pharmacy_screen.dart`: Geolocation services showing local health resources.
    * `donor_achievements_screen.dart`: Displays donor levels and custom gamified accomplishments.

### 2. Node.js Backend (`rapid_aid_backend`)
A lightweight helper API for handling notification broadcasts. It is built using Node.js and Express, configured to connect to Firebase.

* **Main Endpoint:**
  * **POST `/send-alert`**:
    * Expects request payload: `lat`, `lng`, `bloodGroup`, `location`, `phone`.
    * Queries the `users` collection from Firestore to locate active donors who have registered FCM tokens.
    * Filters candidates based on matching blood types.
    * Uses the **Haversine formula** to filter for volunteers within a **50 km** radius.
    * Dispatches high-priority multicast messages using Firebase Cloud Messaging (`admin.messaging().sendEachForMulticast`).
    * Automatically cleanses stale/invalid registration tokens from Firestore.

### 3. Web NFC Card Portal (`rapid_aid_card`)
A minimal, fast-loading, responsive page designed for first responders.

* **Functionality:**
  * If launched via `index.html`, automatically forwards to `user.html` maintaining query parameters.
  * `user.html?id=USER_ID` fetches details from the Firestore `users` collection for the corresponding patient.
  * Renders:
    * Personal Details: Name, DOB, Blood Type, Profile Photo.
    * Medical Parameters: Allergies, Diseases, Medications.
    * Automated Risk Summary (e.g. flagging rare blood O- or pre-existing diseases).
    * Quick Emergency actions: Tap-to-call emergency contacts, direct ambulance caller (108), and Google Maps routing coordinates.
  * Allows profile owners to log in via Google Auth to modify their emergency details or export the medical sheet to PDF.

---

## 🗄️ Firestore Database Schema

The Firebase Firestore instance organizes data in the following main collections:

### 1. `users` Collection
Tracks authentication info, volunteer preferences, and emergency profile details.
* **Document ID**: `uid` (matching Firebase Auth UID)
* **Fields**:
  * `name` (String) - Donor/patient full name
  * `dob` (String) - Date of birth
  * `bloodGroup` (String) - Blood type (e.g. "O-", "A+")
  * `lat` (Double) - Last known latitude
  * `lng` (Double) - Last known longitude
  * `fcmToken` (String) - Current push registration token
  * `isDonor` (Boolean) - Available for matching broadcasts
  * `hasCardData` (Boolean) - Confirmed card setup flag
  * `address` (String) - Mailing address for physical cards
  * `phone1` / `phone2` (String) - Emergency contacts
  * `photoUrl` (String) - Profile photo path

### 2. `blood_requests` Collection
Stores active broadcast alarms.
* **Document ID**: Auto-generated
* **Fields**:
  * `uid` (String) - Creator's UID
  * `name` (String) - Patient name
  * `bystander` (String) - Contact person
  * `bloodGroup` (String) - Required type
  * `units` (Number) - Count of required blood bags
  * `hospital` (String) - Hospital branch & room details
  * `phone` (String) - Active phone line
  * `notes` (String) - Special instructions
  * `urgency` (String) - urgency hierarchy ("Normal", "Urgent", "Critical")
  * `location` (String) - Locality description
  * `lat` / `lng` (Double) - Geolocation coordinates
  * `createdAt` (Timestamp) - Time of creation

### 3. `users/{uid}/ai_chats` Subcollection
Local assistant query log.
* **Document ID**: Auto-generated
* **Fields**:
  * `text` (String) - Message content
  * `isUser` (Boolean) - Source flag
  * `createdAt` (Timestamp) - Server timestamp
  * `time` (String) - Local clock string ("HH:MM")

---

## 🔧 Technical Details & Core Algorithms

### Geolocation & Distance Filtering (Haversine Formula)
To locate nearest donors within 50 km on the backend, the system calculates the great-circle distance between two coordinates using the Haversine formula:

$$\Delta d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$

Where $R = 6371\text{ km}$ (Earth's radius).

Implemented in `index.js` as:
```javascript
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
```

### FCM Multicast & Token Cleansing
To ensure high delivery rates, alerts are delivered via multicast message packets. Invalid device tokens returned by FCM (due to app uninstalls or expired sessions) are intercepted immediately and updated inside the Firestore db using the `admin.firestore.FieldValue.delete()` operator, ensuring zero repeated queries to dead devices.

### Offline First Aid Rules
The app uses a lightweight deterministic intent parser in `AiAssistantScreen` to provide immediate advice for standard keywords (`cpr`, `choke`, `heimlich`, `bleed`, `burn`, `heart`) allowing the assistant to function instantly and reliably under networks that might be degraded during emergency conditions.

### Smart Hospital Routing Score Algorithm
To rank and recommend the best healthcare facility, the routing agent computes a weighted score:

$$\text{Routing Score} = (S_{\text{distance}} \times 0.3) + (S_{\text{traffic}} \times 0.2) + (S_{\text{blood}} \times 0.25) + (S_{\text{icu}} \times 0.15) + (S_{\text{specialist}} \times 0.1)$$

Where:
- $S_{\text{distance}}$ is a spatial distance modifier score.
- $S_{\text{traffic}}$ is the path delay speed modifier factor.
- $S_{\text{blood}}$ denotes required group inventory availability.
- $S_{\text{icu}}$ and $S_{\text{specialist}}$ are hospital capabilities indicators.

### Centralized Blood Grid Rebalancing Matcher
Matches hospital deficits to surpluses using a greedy allocation strategy:
1. Filters centers where current stocks are below threshold levels (deficits).
2. Filters centers holding a surplus (current units exceeding thresholds by at least 5).
3. Allocates excess inventory units directly to cover deficits on compatible blood types recursively.

