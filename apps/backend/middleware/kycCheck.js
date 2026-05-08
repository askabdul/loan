/**
 * KYC completeness check middleware.
 * Applied to POST /api/loans/apply — blocks the request if the user's
 * KYC profile is incomplete and returns the list of missing fields.
 */

const KYC_FIELDS = [
  { field: "employmentStatus", label: "Employment Status", step: "work" },
  { field: "monthlyIncome", label: "Monthly Income", step: "work" },
  { field: "educationLevel", label: "Education Level", step: "education" },
  {
    field: "emergencyContacts",
    label: "Emergency Contacts",
    step: "emergency-contacts",
  },
  { field: "idType", label: "ID Type", step: "id-verification" },
  { field: "idNumber", label: "ID Number", step: "id-verification" },
  { field: "idDocuments", label: "ID Documents", step: "id-verification" },
];

function kycIsComplete(user) {
  if (user.kycComplete === true) return true; // fast path once flagged complete

  if (!user.employmentStatus) return false;
  if (
    ["employed", "self-employed"].includes(user.employmentStatus) &&
    !user.employer
  )
    return false;
  if (!user.monthlyIncome || user.monthlyIncome <= 0) return false;
  if (!user.educationLevel) return false;
  if (
    !user.emergencyContacts ||
    !Array.isArray(user.emergencyContacts) ||
    user.emergencyContacts.length === 0
  )
    return false;
  if (!user.idType) return false;
  if (!user.idNumber) return false;
  if (
    !user.idDocuments ||
    !Array.isArray(user.idDocuments) ||
    user.idDocuments.length === 0
  )
    return false;

  return true;
}

function getMissingKycFields(user) {
  const missing = [];

  if (!user.employmentStatus)
    missing.push({ field: "employmentStatus", step: "work" });
  if (
    ["employed", "self-employed"].includes(user.employmentStatus) &&
    !user.employer
  )
    missing.push({ field: "employer", step: "work" });
  if (!user.monthlyIncome || user.monthlyIncome <= 0)
    missing.push({ field: "monthlyIncome", step: "work" });
  if (!user.educationLevel)
    missing.push({ field: "educationLevel", step: "education" });
  if (
    !user.emergencyContacts ||
    !Array.isArray(user.emergencyContacts) ||
    user.emergencyContacts.length === 0
  )
    missing.push({ field: "emergencyContacts", step: "emergency-contacts" });
  if (!user.idType) missing.push({ field: "idType", step: "id-verification" });
  if (!user.idNumber)
    missing.push({ field: "idNumber", step: "id-verification" });
  if (
    !user.idDocuments ||
    !Array.isArray(user.idDocuments) ||
    user.idDocuments.length === 0
  )
    missing.push({ field: "idDocuments", step: "id-verification" });

  return missing;
}

// Express middleware
const kycCheck = (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (kycIsComplete(user)) return next();

  const missingFields = getMissingKycFields(user);
  // Determine first incomplete step
  const firstStep = missingFields[0]?.step || "work";

  return res.status(422).json({
    success: false,
    code: "KYC_INCOMPLETE",
    message:
      "Please complete your profile information before applying for a loan.",
    missingFields,
    firstStep,
  });
};

module.exports = kycCheck;
module.exports.kycIsComplete = kycIsComplete;
module.exports.getMissingKycFields = getMissingKycFields;
