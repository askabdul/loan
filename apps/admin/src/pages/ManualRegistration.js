import React, { useState, useEffect } from "react";
import {
  FiUser,
  FiPhone,
  FiMapPin,
  FiBriefcase,
  FiBook,
  FiUsers,
  FiCreditCard,
  FiSave,
  FiX,
  FiPlus,
  FiTrash2,
  FiRefreshCw,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/api";
import { useNavigate } from "react-router-dom";

const ManualRegistration = () => {
  const navigate = useNavigate();
  const { hasActionPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loanLevels, setLoanLevels] = useState([]);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    pin: "",
    personalInfo: {
      firstName: "",
      lastName: "",
      email: "",
      dateOfBirth: "",
      gender: "",
      maritalStatus: "",
      address: {
        street: "",
        city: "",
        region: "",
        country: "Ghana",
      },
    },
    workInfo: {
      employmentStatus: "",
      employer: "",
      jobTitle: "",
      monthlyIncome: "",
      workAddress: "",
      yearsOfEmployment: "",
    },
    educationInfo: {
      highestLevel: "",
      institution: "",
      fieldOfStudy: "",
      graduationYear: "",
    },
    emergencyContacts: [
      {
        name: "",
        relationship: "",
        phoneNumber: "",
        email: "",
      },
    ],
    idVerification: {
      idType: "",
      idNumber: "",
      idFrontImage: null,
      idBackImage: null,
      selfieImage: null,
    },
    assignedLoanLevel: 1,
  });
  const [errors, setErrors] = useState({});
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    fetchLoanLevels();
  }, []);

  const fetchLoanLevels = async () => {
    try {
      const response = await apiService.getAllLevels();
      if (response && response.data && response.data.levels) {
        setLoanLevels(response.data.levels);
      }
    } catch (error) {
      console.error("Error fetching loan levels:", error);
    }
  };

  const handleInputChange = (section, field, value, index = null) => {
    setFormData((prev) => {
      const newData = { ...prev };

      if (section === "emergencyContacts" && index !== null) {
        newData.emergencyContacts[index][field] = value;
      } else if (section && field) {
        if (!newData[section]) newData[section] = {};
        if (field.includes(".")) {
          const [parentField, childField] = field.split(".");
          if (!newData[section][parentField])
            newData[section][parentField] = {};
          newData[section][parentField][childField] = value;
        } else {
          newData[section][field] = value;
        }
      } else {
        newData[section] = value;
      }

      return newData;
    });

    // Clear error for this field
    if (errors[`${section}.${field}`]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[`${section}.${field}`];
        return newErrors;
      });
    }
  };

  const addEmergencyContact = () => {
    setFormData((prev) => ({
      ...prev,
      emergencyContacts: [
        ...prev.emergencyContacts,
        { name: "", relationship: "", phoneNumber: "", email: "" },
      ],
    }));
  };

  const removeEmergencyContact = (index) => {
    if (formData.emergencyContacts.length > 1) {
      setFormData((prev) => ({
        ...prev,
        emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index),
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Phone number validation
    if (!formData.phoneNumber) {
      newErrors["phoneNumber"] = "Phone number is required";
    } else {
      // Accept both Ghana local format (0XXXXXXXXX) and international format (+233XXXXXXXXX)
      const ghanaLocalPattern = /^0[2-9]\d{8}$/; // Ghana local: 0 followed by 2-9, then 8 digits
      const internationalPattern = /^\+233[2-9]\d{8}$/; // International: +233 followed by 2-9, then 8 digits

      if (
        !ghanaLocalPattern.test(formData.phoneNumber) &&
        !internationalPattern.test(formData.phoneNumber)
      ) {
        newErrors["phoneNumber"] =
          "Please enter a valid Ghana phone number (0XXXXXXXXX or +233XXXXXXXXX)";
      }
    }

    // PIN validation
    if (!formData.pin) {
      newErrors["pin"] = "PIN is required";
    } else if (!/^\d{4}$/.test(formData.pin)) {
      newErrors["pin"] = "PIN must be exactly 4 digits";
    }

    // Personal info validation
    if (!formData.personalInfo.firstName) {
      newErrors["personalInfo.firstName"] = "First name is required";
    }
    if (!formData.personalInfo.lastName) {
      newErrors["personalInfo.lastName"] = "Last name is required";
    }
    if (!formData.personalInfo.dateOfBirth) {
      newErrors["personalInfo.dateOfBirth"] = "Date of birth is required";
    }
    if (!formData.personalInfo.gender) {
      newErrors["personalInfo.gender"] = "Gender is required";
    }

    // Work info validation
    if (!formData.workInfo.employmentStatus) {
      newErrors["workInfo.employmentStatus"] = "Employment status is required";
    }

    // Emergency contacts validation
    formData.emergencyContacts.forEach((contact, index) => {
      if (!contact.name) {
        newErrors[`emergencyContacts.${index}.name`] =
          "Contact name is required";
      }
      if (!contact.relationship) {
        newErrors[`emergencyContacts.${index}.relationship`] =
          "Relationship is required";
      }
      if (!contact.phoneNumber) {
        newErrors[`emergencyContacts.${index}.phoneNumber`] =
          "Contact phone number is required";
      } else {
        // Validate Ghana phone number format for emergency contacts
        const ghanaLocalPattern = /^0[2-9]\d{8}$/;
        const internationalPattern = /^\+233[2-9]\d{8}$/;

        if (
          !ghanaLocalPattern.test(contact.phoneNumber) &&
          !internationalPattern.test(contact.phoneNumber)
        ) {
          newErrors[`emergencyContacts.${index}.phoneNumber`] =
            "Please enter a valid Ghana phone number (0XXXXXXXXX or +233XXXXXXXXX)";
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    setFormErrors({});

    // Validate form
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fix the errors in the form");
      return;
    }

    try {
      setLoading(true);
      await apiService.adminRegisterUser(formData);
      toast.success("User registered successfully");
      navigate("/user-list");
    } catch (error) {
      console.error("Registration error:", error);

      // Handle server errors (500)
      if (error.response && error.response.status === 500) {
        toast.error("Server error occurred. Please try again later.");
        setFormErrors({
          general:
            "Server error occurred. The registration could not be completed.",
        });
      }
      // Handle structured error responses from the backend
      else if (error.response && error.response.data) {
        const { message, errors } = error.response.data;

        // Display the main error message
        toast.error(message || "Registration failed");

        // Map backend errors to form fields
        if (errors && Array.isArray(errors)) {
          const newFormErrors = {};

          errors.forEach((err) => {
            // Map backend field names to form field names
            const fieldMapping = {
              phone: "phoneNumber",
              pin: "pin",
              firstName: "firstName",
              lastName: "lastName",
              email: "email",
              emergencyContacts: "emergencyContacts",
              loanLevel: "loanLevel",
            };

            const fieldName = fieldMapping[err.path] || err.path;

            // Handle nested fields like emergencyContacts[0].phone
            if (err.path && err.path.includes("emergencyContacts")) {
              const match = err.path.match(/emergencyContacts\[(\d+)\]\.(.+)/);
              if (match) {
                const [, index, field] = match;
                if (!newFormErrors.emergencyContacts) {
                  newFormErrors.emergencyContacts = [];
                }
                if (!newFormErrors.emergencyContacts[index]) {
                  newFormErrors.emergencyContacts[index] = {};
                }
                newFormErrors.emergencyContacts[index][field] = err.msg;
              } else {
                newFormErrors.emergencyContacts = err.msg;
              }
            } else {
              newFormErrors[fieldName] = err.msg;
            }
          });

          setFormErrors(newFormErrors);
        }
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!hasActionPermission("createUser")) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen w-full flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center max-w-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            Access Denied
          </h2>
          <p className="text-sm text-gray-500">
            You don't have permission to register users.
          </p>
        </div>
      </div>
    );
  }

  const inp = (hasErr) =>
    `w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 bg-white ${hasErr ? "border-red-400 focus:ring-red-400" : "border-gray-200 focus:ring-blue-500"}`;
  const sec = "bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5";
  const secHdr = "flex items-center gap-2 text-sm font-bold text-gray-700 mb-4";
  const lbl =
    "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide";
  const err = "text-xs text-red-600 mt-1";

  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
          <FiUser size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
            Manual User Registration
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Register new users directly from the admin panel
          </p>
        </div>
      </div>

      {/* Error banner */}
      {(errors.general || formErrors.general) && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
          <span className="text-sm text-red-700">
            {errors.general || formErrors.general}
          </span>
          <button
            onClick={() => {
              setErrors((p) => ({ ...p, general: "" }));
              setFormErrors((p) => ({ ...p, general: "" }));
            }}
            className="text-red-400 hover:text-red-600 transition"
          >
            <FiX size={14} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Authentication Details */}
        <div className={sec}>
          <p className={secHdr}>
            <FiPhone size={15} className="text-blue-500" /> Authentication
            Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Phone Number *</label>
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) =>
                  handleInputChange("phoneNumber", null, e.target.value)
                }
                placeholder="0541972780 or +233541972780"
                className={inp(errors.phoneNumber)}
              />
              {errors.phoneNumber && (
                <p className={err}>{errors.phoneNumber}</p>
              )}
            </div>
            <div>
              <label className={lbl}>PIN (4 digits) *</label>
              <input
                type="password"
                maxLength="4"
                value={formData.pin}
                onChange={(e) => handleInputChange("pin", null, e.target.value)}
                placeholder="1234"
                className={inp(errors.pin)}
              />
              {errors.pin && <p className={err}>{errors.pin}</p>}
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className={sec}>
          <p className={secHdr}>
            <FiUser size={15} className="text-blue-500" /> Personal Information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>First Name *</label>
              <input
                type="text"
                value={formData.personalInfo.firstName}
                onChange={(e) =>
                  handleInputChange("personalInfo", "firstName", e.target.value)
                }
                className={inp(errors["personalInfo.firstName"])}
              />
              {errors["personalInfo.firstName"] && (
                <p className={err}>{errors["personalInfo.firstName"]}</p>
              )}
            </div>
            <div>
              <label className={lbl}>Last Name *</label>
              <input
                type="text"
                value={formData.personalInfo.lastName}
                onChange={(e) =>
                  handleInputChange("personalInfo", "lastName", e.target.value)
                }
                className={inp(errors["personalInfo.lastName"])}
              />
              {errors["personalInfo.lastName"] && (
                <p className={err}>{errors["personalInfo.lastName"]}</p>
              )}
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input
                type="email"
                value={formData.personalInfo.email}
                onChange={(e) =>
                  handleInputChange("personalInfo", "email", e.target.value)
                }
                className={inp(false)}
              />
            </div>
            <div>
              <label className={lbl}>Date of Birth *</label>
              <input
                type="date"
                value={formData.personalInfo.dateOfBirth}
                onChange={(e) =>
                  handleInputChange(
                    "personalInfo",
                    "dateOfBirth",
                    e.target.value,
                  )
                }
                className={inp(errors["personalInfo.dateOfBirth"])}
              />
              {errors["personalInfo.dateOfBirth"] && (
                <p className={err}>{errors["personalInfo.dateOfBirth"]}</p>
              )}
            </div>
            <div>
              <label className={lbl}>Gender *</label>
              <select
                value={formData.personalInfo.gender}
                onChange={(e) =>
                  handleInputChange("personalInfo", "gender", e.target.value)
                }
                className={inp(errors["personalInfo.gender"])}
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {errors["personalInfo.gender"] && (
                <p className={err}>{errors["personalInfo.gender"]}</p>
              )}
            </div>
            <div>
              <label className={lbl}>Marital Status</label>
              <select
                value={formData.personalInfo.maritalStatus}
                onChange={(e) =>
                  handleInputChange(
                    "personalInfo",
                    "maritalStatus",
                    e.target.value,
                  )
                }
                className={inp(false)}
              >
                <option value="">Select Status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mt-4 mb-3">
            <FiMapPin size={12} /> Address
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                label: "Street Address",
                field: "address.street",
                value: formData.personalInfo.address.street,
              },
              {
                label: "City",
                field: "address.city",
                value: formData.personalInfo.address.city,
              },
              {
                label: "Region",
                field: "address.region",
                value: formData.personalInfo.address.region,
              },
              {
                label: "Country",
                field: "address.country",
                value: formData.personalInfo.address.country,
              },
            ].map(({ label, field, value }) => (
              <div key={field}>
                <label className={lbl}>{label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    handleInputChange("personalInfo", field, e.target.value)
                  }
                  className={inp(false)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Work Information */}
        <div className={sec}>
          <p className={secHdr}>
            <FiBriefcase size={15} className="text-blue-500" /> Work Information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Employment Status *</label>
              <select
                value={formData.workInfo.employmentStatus}
                onChange={(e) =>
                  handleInputChange(
                    "workInfo",
                    "employmentStatus",
                    e.target.value,
                  )
                }
                className={inp(errors["workInfo.employmentStatus"])}
              >
                <option value="">Select Status</option>
                <option value="employed">Employed</option>
                <option value="self-employed">Self-Employed</option>
                <option value="unemployed">Unemployed</option>
                <option value="student">Student</option>
                <option value="retired">Retired</option>
              </select>
              {errors["workInfo.employmentStatus"] && (
                <p className={err}>{errors["workInfo.employmentStatus"]}</p>
              )}
            </div>
            {[
              {
                label: "Employer",
                field: "employer",
                value: formData.workInfo.employer,
              },
              {
                label: "Job Title",
                field: "jobTitle",
                value: formData.workInfo.jobTitle,
              },
              {
                label: "Monthly Income (GHS)",
                field: "monthlyIncome",
                value: formData.workInfo.monthlyIncome,
                type: "number",
              },
              {
                label: "Work Address",
                field: "workAddress",
                value: formData.workInfo.workAddress,
              },
              {
                label: "Years of Employment",
                field: "yearsOfEmployment",
                value: formData.workInfo.yearsOfEmployment,
                type: "number",
              },
            ].map(({ label, field, value, type = "text" }) => (
              <div key={field}>
                <label className={lbl}>{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) =>
                    handleInputChange("workInfo", field, e.target.value)
                  }
                  className={inp(false)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Education Information */}
        <div className={sec}>
          <p className={secHdr}>
            <FiBook size={15} className="text-blue-500" /> Education Information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Highest Education Level</label>
              <select
                value={formData.educationInfo.highestLevel}
                onChange={(e) =>
                  handleInputChange(
                    "educationInfo",
                    "highestLevel",
                    e.target.value,
                  )
                }
                className={inp(false)}
              >
                <option value="">Select Level</option>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="tertiary">Tertiary</option>
                <option value="university">University</option>
                <option value="postgraduate">Postgraduate</option>
              </select>
            </div>
            {[
              {
                label: "Institution",
                field: "institution",
                value: formData.educationInfo.institution,
              },
              {
                label: "Field of Study",
                field: "fieldOfStudy",
                value: formData.educationInfo.fieldOfStudy,
              },
              {
                label: "Graduation Year",
                field: "graduationYear",
                value: formData.educationInfo.graduationYear,
                type: "number",
              },
            ].map(({ label, field, value, type = "text" }) => (
              <div key={field}>
                <label className={lbl}>{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) =>
                    handleInputChange("educationInfo", field, e.target.value)
                  }
                  className={inp(false)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className={sec}>
          <p className={secHdr}>
            <FiUsers size={15} className="text-blue-500" /> Emergency Contacts
          </p>
          {formData.emergencyContacts.map((contact, index) => (
            <div
              key={index}
              className="border border-gray-100 rounded-xl p-4 mb-3"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide m-0">
                  Contact {index + 1}
                </p>
                {formData.emergencyContacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmergencyContact(index)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                  >
                    <FiTrash2 size={12} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Name *</label>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(e) =>
                      handleInputChange(
                        "emergencyContacts",
                        "name",
                        e.target.value,
                        index,
                      )
                    }
                    className={inp(errors[`emergencyContacts.${index}.name`])}
                  />
                  {errors[`emergencyContacts.${index}.name`] && (
                    <p className={err}>
                      {errors[`emergencyContacts.${index}.name`]}
                    </p>
                  )}
                </div>
                <div>
                  <label className={lbl}>Relationship *</label>
                  <select
                    value={contact.relationship}
                    onChange={(e) =>
                      handleInputChange(
                        "emergencyContacts",
                        "relationship",
                        e.target.value,
                        index,
                      )
                    }
                    className={inp(
                      errors[`emergencyContacts.${index}.relationship`],
                    )}
                  >
                    <option value="">Select relationship</option>
                    {[
                      "parent",
                      "sibling",
                      "spouse",
                      "child",
                      "friend",
                      "colleague",
                      "relative",
                      "other",
                    ].map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                  {errors[`emergencyContacts.${index}.relationship`] && (
                    <p className={err}>
                      {errors[`emergencyContacts.${index}.relationship`]}
                    </p>
                  )}
                </div>
                <div>
                  <label className={lbl}>Phone Number *</label>
                  <input
                    type="tel"
                    value={contact.phoneNumber}
                    onChange={(e) =>
                      handleInputChange(
                        "emergencyContacts",
                        "phoneNumber",
                        e.target.value,
                        index,
                      )
                    }
                    placeholder="0541972780 or +233541972780"
                    className={inp(
                      errors[`emergencyContacts.${index}.phoneNumber`],
                    )}
                  />
                  {errors[`emergencyContacts.${index}.phoneNumber`] && (
                    <p className={err}>
                      {errors[`emergencyContacts.${index}.phoneNumber`]}
                    </p>
                  )}
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={(e) =>
                      handleInputChange(
                        "emergencyContacts",
                        "email",
                        e.target.value,
                        index,
                      )
                    }
                    className={inp(false)}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addEmergencyContact}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
          >
            <FiPlus size={14} /> Add Another Contact
          </button>
        </div>

        {/* ID Verification */}
        <div className={sec}>
          <p className={secHdr}>
            <FiCreditCard size={15} className="text-blue-500" /> ID Verification
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>ID Type</label>
              <select
                value={formData.idVerification.idType}
                onChange={(e) =>
                  handleInputChange("idVerification", "idType", e.target.value)
                }
                className={inp(false)}
              >
                <option value="">Select ID Type</option>
                <option value="national-id">National ID</option>
                <option value="passport">Passport</option>
                <option value="drivers-license">Driver's License</option>
                <option value="voters-id">Voter ID</option>
              </select>
            </div>
            <div>
              <label className={lbl}>ID Number</label>
              <input
                type="text"
                value={formData.idVerification.idNumber}
                onChange={(e) =>
                  handleInputChange(
                    "idVerification",
                    "idNumber",
                    e.target.value,
                  )
                }
                className={inp(false)}
              />
            </div>
            {[
              { label: "ID Front Image", field: "idFrontImage" },
              { label: "ID Back Image", field: "idBackImage" },
              { label: "Selfie Photo", field: "selfieImage" },
            ].map(({ label, field }) => (
              <div key={field}>
                <label className={lbl}>{label}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleInputChange(
                      "idVerification",
                      field,
                      e.target.files[0],
                    )
                  }
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700"
                />
                {formData.idVerification[field] && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formData.idVerification[field].name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Loan Level Assignment */}
        <div className={sec}>
          <p className={secHdr}>
            <FiCreditCard size={15} className="text-blue-500" /> Loan Level
            Assignment
          </p>
          <div className="max-w-xs">
            <label className={lbl}>Assigned Loan Level</label>
            <select
              value={formData.assignedLoanLevel}
              onChange={(e) =>
                handleInputChange(
                  "assignedLoanLevel",
                  null,
                  parseInt(e.target.value),
                )
              }
              className={inp(false)}
            >
              {loanLevels.map((level) => (
                <option key={level._id} value={level.level}>
                  Level {level.level} – {level.name} (Max: GHS {level.maxAmount}
                  )
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <FiRefreshCw size={14} className="animate-spin" />{" "}
                Registering...
              </>
            ) : (
              <>
                <FiSave size={14} /> Register User
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ManualRegistration;
