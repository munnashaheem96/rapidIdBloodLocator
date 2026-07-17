// tests/compatibility.test.js
const { isCompatible, getMatchScore } = require("../src/services/compatibility.service");

describe("Smart Blood Compatibility Rules", () => {
  test("O- should only receive from O-", () => {
    expect(isCompatible("O-", "O-")).toBe(true);
    expect(isCompatible("O-", "O+")).toBe(false);
    expect(isCompatible("O-", "A-")).toBe(false);
    expect(isCompatible("O-", "AB+")).toBe(false);
  });

  test("A+ should receive from A+, A-, O+, O-", () => {
    expect(isCompatible("A+", "A+")).toBe(true);
    expect(isCompatible("A+", "A-")).toBe(true);
    expect(isCompatible("A+", "O+")).toBe(true);
    expect(isCompatible("A+", "O-")).toBe(true);
    
    expect(isCompatible("A+", "B+")).toBe(false);
    expect(isCompatible("A+", "AB+")).toBe(false);
  });

  test("AB+ should receive from all blood groups (Universal Recipient)", () => {
    const groups = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"];
    groups.forEach(group => {
      expect(isCompatible("AB+", group)).toBe(true);
    });
  });

  test("Match scores should be calculated correctly", () => {
    expect(getMatchScore("A+", "A+")).toBe(100); // Exact Match
    expect(getMatchScore("A+", "O-")).toBe(70);  // Compatible Match
    expect(getMatchScore("O-", "A+")).toBe(0);   // Incompatible Match
  });
});
