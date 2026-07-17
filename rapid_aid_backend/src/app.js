// src/app.js
const express = require("express");
const cors = require("cors");
const alertRoutes = require("./routes/alert.routes");

const app = express();

// Standard middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing mounts
app.use("/", alertRoutes);

// Base heartbeat route
app.get("/", (_, res) => {
  res.send("🚀 Rapid Aid AI Emergency Response Backend Active");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Express unhandled error:", err.stack);
  res.status(500).json({ error: "Something broke internally on the server" });
});

module.exports = app;
