const agents = require("../src/services/agents");
const predictiveService = require("../src/services/predictive.service");

describe("Rapid Aid 3.0 Core Services & Multi-Agent Tests", () => {
  
  test("EmergencyAI should categorize symptoms accurately", () => {
    const criticalCase = agents.EmergencyAI.analyzeUrgency("Unconscious patient, potential cardiac arrest");
    expect(criticalCase.level).toBe("CRITICAL");
    expect(criticalCase.confidence).toBe(96);

    const normalCase = agents.EmergencyAI.analyzeUrgency("Need 2 units for elective surgery");
    expect(normalCase.level).toBe("NORMAL");
  });

  test("MedicalAI should recommend suitable first-aid instructions", () => {
    const criticalDirectives = agents.MedicalAI.getDirectives("CRITICAL");
    expect(criticalDirectives[0]).toContain("CPR");
    
    const normalDirectives = agents.MedicalAI.getDirectives("NORMAL");
    expect(normalDirectives[0]).toContain("resting");
  });

  test("HospitalRoutingAI should compute weighted routing scores and suggest explainable reasons", () => {
    const hospitals = [
      {
        id: "HOSP_A",
        name: "Trauma Hospital A",
        lat: 12.97,
        lng: 77.59,
        trafficFactor: 0.9,
        icuAvailable: true,
        specialistsOnDuty: true,
        bloodInventory: { "O-": 10 }
      },
      {
        id: "HOSP_B",
        name: "General Hospital B",
        lat: 12.98,
        lng: 77.58,
        trafficFactor: 0.4,
        icuAvailable: false,
        specialistsOnDuty: false,
        bloodInventory: { "O-": 0 }
      }
    ];

    const results = agents.HospitalRoutingAI.rankHospitals(12.971, 77.591, "O-", hospitals);
    expect(results[0].hospitalId).toBe("HOSP_A");
    expect(results[0].finalScore).toBeGreaterThan(results[1].finalScore);
    expect(results[0].reasons).toContain("Close proximity");
  });

  test("Intelligent dispatch should score local responder capabilities", () => {
    const volunteers = [
      { uid: "V1", name: "Dr. Roy", role: "Doctor", lat: 12.97, lng: 77.59, isActive: true, reputationPoints: 800, batteryLevel: 95, networkQuality: "EXCELLENT" },
      { uid: "V2", name: "Volunteer B", role: "Doctor", lat: 12.98, lng: 77.58, isActive: true, reputationPoints: 100, batteryLevel: 40, networkQuality: "POOR" }
    ];

    const results = agents.VolunteerDispatchAI.dispatchBestResponders(12.971, 77.591, volunteers, "Doctor");
    expect(results[0].uid).toBe("V1");
    expect(results[0].dispatchScore).toBeGreaterThan(results[1].dispatchScore);
  });

  test("Blood grid calculations should identify rebalancing transfers", async () => {
    const transfers = await predictiveService.calculateGridRebalancing();
    expect(transfers.length).toBeGreaterThan(0);
    expect(transfers[0].bloodGroup).toBe("O-");
    expect(transfers[0].units).toBeGreaterThan(0);
  });

});
