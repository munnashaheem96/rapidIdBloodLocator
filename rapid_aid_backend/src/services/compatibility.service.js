// src/services/compatibility.service.js

/**
 * Blood Compatibility Lookup Matrix
 * Key: Patient's required blood group (Recipient)
 * Value: Array of compatible donor blood groups
 */
const COMPATIBILITY_RULES = {
  'O-':  ['O-'],
  'O+':  ['O-', 'O+'],
  'A-':  ['O-', 'A-'],
  'A+':  ['O-', 'O+', 'A-', 'A+'],
  'B-':  ['O-', 'B-'],
  'B+':  ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
};

/**
 * Check if a donor's blood group is compatible with the recipient's required blood group.
 * @param {string} recipientGroup - The blood group the recipient needs (e.g. 'A+')
 * @param {string} donorGroup - The blood group the donor has (e.g. 'O-')
 * @returns {boolean} True if compatible, false otherwise
 */
function isCompatible(recipientGroup, donorGroup) {
  const allowedDonors = COMPATIBILITY_RULES[recipientGroup];
  if (!allowedDonors) return false;
  return allowedDonors.includes(donorGroup);
}

/**
 * Returns a score representing match priority.
 * - 100: Exact match (e.g., A+ for A+)
 * - 70: Compatible but not identical (e.g., O- for A+)
 * - 0: Incompatible
 * @param {string} recipientGroup
 * @param {string} donorGroup
 * @returns {number} Priority score
 */
function getMatchScore(recipientGroup, donorGroup) {
  if (recipientGroup === donorGroup) return 100;
  if (isCompatible(recipientGroup, donorGroup)) return 70;
  return 0;
}

module.exports = {
  COMPATIBILITY_RULES,
  isCompatible,
  getMatchScore
};
