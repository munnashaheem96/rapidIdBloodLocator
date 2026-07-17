// src/routes/alert.routes.js
const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alert.controller");

// Route configurations
router.post("/send-alert", alertController.sendAlert);
router.post("/triage", alertController.triageSymptom);
router.post("/recommend-hospitals", alertController.getHospitalRecommendation);
router.post("/forecast-demand", alertController.getDemandForecast);

// New Orchestration & Grid & Simulation Routes
router.post("/orchestrate-emergency", alertController.orchestrateEmergencyIncident);
router.post("/blood-grid/rebalance", alertController.getBloodGridRebalance);
router.post("/simulate-disaster", alertController.simulateDisasterZone);

module.exports = router;
