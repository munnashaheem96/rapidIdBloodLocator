// index.js
// Bootstraps the modular Express application and schedulers
const app = require("./src/app");
const { startAvailabilityScheduler } = require("./src/services/availability_scheduler");

// Start background task scanning for expired donor availabilities
startAvailabilityScheduler();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Server running on", PORT));