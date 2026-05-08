import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useSocket } from "../../contexts/SocketContext";
import { loansAPI, usersAPI } from "../../services/api";
import configAPI from "../../services/configAPI";
import ContentAPI from "../../services/contentAPI";

// Add inline styles for contact cards
const contactCardStyles = `
  .contact-card:hover {
    transform: translateY(-2px);
    transition: transform 0.2s ease-in-out;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
  }
  
  .contact-card {
    transition: all 0.2s ease-in-out;
  }
  
  .process-step-card:hover {
    transform: translateY(-2px);
    transition: transform 0.2s ease-in-out;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
  }
  
  .process-step-card {
    transition: all 0.2s ease-in-out;
    cursor: pointer;
  }
`;

// Inject styles
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = contactCardStyles;
  document.head.appendChild(styleSheet);
}

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  useSocket(); // Initialize socket connection
  const [userStats, setUserStats] = useState({
    availableCredit: 0,
    loansCompleted: 0,
    creditScore: 0,
  });
  const [userProfile, setUserProfile] = useState(null);
  const [activeLoan, setActiveLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);

  const [appConfig, setAppConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [processGuide, setProcessGuide] = useState([]);
  const [faqData, setFaqData] = useState([]);
  const [contactInfo, setContactInfo] = useState([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Fetch app configuration
  useEffect(() => {
    const fetchAppConfig = async () => {
      try {
        const configResponse = await configAPI.getCachedConfigs();
        if (configResponse.success) {
          setAppConfig(configResponse.data);
          // Config loaded successfully
        }
      } catch (error) {
        console.error("Error fetching app config:", error);
        // Use fallback config
        const fallbackConfig = configAPI.getDefaultConfig();
        setAppConfig(fallbackConfig.data);
      } finally {
        setConfigLoading(false);
      }
    };

    fetchAppConfig();
  }, []);

  // Fetch dynamic content
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const [processGuideData, faqContent, contactData] = await Promise.all([
          ContentAPI.getProcessGuideContent(),
          ContentAPI.getFAQContent(),
          ContentAPI.getContactInfo(),
        ]);

        setProcessGuide(processGuideData);
        setFaqData(faqContent);
        setContactInfo(contactData);
      } catch (error) {
        console.error("Error fetching content:", error);
      } finally {
        setContentLoading(false);
      }
    };

    fetchContent();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [profileResponse, loansResponse] = await Promise.all([
          usersAPI.getProfile(),
          loansAPI.getUserLoans(),
        ]);

        const profile = profileResponse.user;
        const loans = loansResponse.loans || [];

        setUserProfile(profile);

        const completedLoans = loans.filter(
          (loan) => loan.status === "completed",
        ).length;
        const active = loans.find((loan) =>
          [
            "pending",
            "under-review",
            "approved",
            "disbursed",
            "active",
            "overdue",
          ].includes(loan.status),
        );
        setActiveLoan(active || null);
        // Use dynamic credit limit or fallback to config default
        const availableCredit =
          profile.creditLimit || appConfig?.default_credit_limit || 2000;
        // Use dynamic credit score or fallback to config default
        const creditScore =
          profile.creditScore || appConfig?.credit_score_range?.default || 650;

        setUserStats({
          availableCredit,
          loansCompleted: completedLoans,
          creditScore,
        });
      } catch (error) {
        console.error("Error fetching user data:", error);
        // Set default values on error using config or hardcoded fallbacks
        setUserStats({
          availableCredit: appConfig?.default_credit_limit || 2000,
          loansCompleted: 0,
          creditScore: appConfig?.credit_score_range?.default || 650,
        });
      } finally {
        setLoading(false);
      }
    };

    if (user && !configLoading) {
      fetchUserData();
    } else if (!user) {
      setLoading(false);
    }
  }, [user, appConfig, configLoading]);

  const handleContactClick = (contact) => {
    const { type, value, displayText } = contact;

    switch (type) {
      case "whatsapp":
        window.open(`https://wa.me/${value}`, "_blank");
        break;
      case "phone":
        window.open(`tel:${value}`);
        break;
      case "email":
        window.open(`mailto:${value}`);
        break;
      case "faq":
        // Scroll to FAQ section
        document
          .getElementById("faqAccordion")
          ?.scrollIntoView({ behavior: "smooth" });
        break;
      case "ussd":
        // USSD codes can't be dialled from browser; show a copy prompt
        window.prompt("Dial this USSD code:", value);
        break;
      default:
        console.log("Contact clicked:", contact.title);
    }
  };

  const handleProcessStepClick = (step, index) => {
    // Show detailed information about the process step
    const stepDetails =
      step.content?.fullDescription ||
      step.content?.description ||
      "No additional details available.";
    const stepTitle = step.title || `Step ${index + 1}`;

    // Create a modal-like alert with step details
    const message = `${stepTitle}\n\n${stepDetails}`;

    if (step.content?.actionUrl) {
      // If there's an action URL, ask user if they want to navigate
      const shouldNavigate = window.confirm(
        `${message}\n\nWould you like to proceed with this step?`,
      );
      if (shouldNavigate) {
        window.open(step.content.actionUrl, "_blank");
      }
    } else {
      // Just show the information
      alert(message);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-8 pb-28 space-y-5">
      {/* Hero / Welcome Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-md p-7 text-white">
        <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-2">
          Good day 👋
        </p>
        <h2 className="text-3xl font-bold mb-1.5">
          Welcome
          {userProfile?.firstName
            ? `, ${userProfile.firstName}`
            : user?.firstName
              ? `, ${user.firstName}`
              : ""}
        </h2>
        <p className="text-blue-200 text-sm mt-1">
          Your trusted partner for quick and easy loans
        </p>
      </div>

      {/* Quick Stats */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Your Overview
        </p>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <div className="text-center px-3">
            <div className="text-xl font-bold text-blue-600 leading-tight">
              {loading
                ? "—"
                : `GHS ${userStats.availableCredit.toLocaleString()}`}
            </div>
            <div className="text-xs text-gray-400 mt-1">Available Credit</div>
          </div>
          <div className="text-center px-3">
            <div className="text-2xl font-bold text-emerald-600 leading-tight">
              {loading ? "—" : userStats.loansCompleted}
            </div>
            <div className="text-xs text-gray-400 mt-1">Loans Completed</div>
          </div>
          <div className="text-center px-3">
            <div className="text-2xl font-bold text-cyan-600 leading-tight">
              {loading ? "—" : userStats.creditScore}
            </div>
            <div className="text-xs text-gray-400 mt-1">Credit Score</div>
          </div>
        </div>
      </div>

      {/* Active Loan Card */}
      {!loading && activeLoan && (
        <div
          className={`rounded-2xl shadow-sm border p-4 cursor-pointer transition-all hover:shadow-md ${
            activeLoan.isOverdue
              ? "bg-red-50 border-red-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
          onClick={() => navigate("/apply")}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">💳</span>
              <span className="text-sm font-bold text-gray-700">
                Active Loan
              </span>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                activeLoan.isOverdue
                  ? "bg-red-100 text-red-700"
                  : activeLoan.status === "approved"
                    ? "bg-blue-100 text-blue-700"
                    : activeLoan.status === "pending" ||
                        activeLoan.status === "under-review"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {activeLoan.isOverdue
                ? "Overdue"
                : activeLoan.status.replace("-", " ")}
            </span>
          </div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm text-gray-500">Loan Amount</span>
            <span className="text-lg font-bold text-gray-800">
              GHS {parseFloat(activeLoan.amount || 0).toLocaleString()}
            </span>
          </div>
          {activeLoan.remainingBalance != null && (
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Remaining Balance</span>
              <span className="text-lg font-bold text-orange-600">
                GHS {parseFloat(activeLoan.remainingBalance).toLocaleString()}
              </span>
            </div>
          )}
          <p className="text-xs text-gray-400 mt-4 text-right">
            Tap to manage →
          </p>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-600 rounded-2xl shadow-md p-4 flex flex-col gap-2">
          <div>
            <div className="text-xl mb-1">💰</div>
            <h5 className="text-white font-bold text-sm leading-tight">
              Apply for Loan
            </h5>
            <p className="text-blue-200 text-xs mt-1">
              Up to GHS{" "}
              {(
                appConfig?.max_loan_amount ||
                userStats.availableCredit ||
                5000
              ).toLocaleString()}
            </p>
          </div>
          <button
            className="mt-auto w-full bg-white text-blue-600 hover:bg-blue-50 transition-colors rounded-xl px-3 py-2 text-sm font-semibold"
            onClick={() => navigate("/apply")}
          >
            Apply Now
          </button>
        </div>

        <div className="bg-emerald-600 rounded-2xl shadow-md p-4 flex flex-col gap-2">
          <div>
            <div className="text-xl mb-1">📋</div>
            <h5 className="text-white font-bold text-sm leading-tight">
              Loan History
            </h5>
            <p className="text-emerald-200 text-xs mt-1">
              View your transactions
            </p>
          </div>
          <button
            className="mt-auto w-full bg-white text-emerald-700 hover:bg-emerald-50 transition-colors rounded-xl px-3 py-2 text-sm font-semibold"
            onClick={() => navigate("/history")}
          >
            View History
          </button>
        </div>
      </div>

      {/* Process Guide */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-gray-50 transition-colors"
          onClick={() => setShowGuide(!showGuide)}
        >
          <span className="font-semibold text-gray-800">
            📋 Application & Repayment Guide
          </span>
          <span className="text-gray-300 text-sm">{showGuide ? "▲" : "▼"}</span>
        </button>
        {showGuide && (
          <div className="px-5 pt-2 pb-6 space-y-5 border-t border-gray-100">
            {[
              {
                num: "1",
                color: "bg-cyan-500",
                title: "Registration",
                desc: "Create your CEDI account by providing your phone number and basic personal information. New users will receive verification.",
              },
              {
                num: "2",
                color: "bg-blue-600",
                title: "Login",
                desc: "Login with SMS OTP (new customers) or Phone PIN (returning customers). Secure access to your account.",
              },
              {
                num: "3",
                color: "bg-emerald-600",
                title: "Apply for Loan",
                desc: "Complete your loan application by uploading NRC documents, providing references, and selecting loan amount.",
              },
              {
                num: "4",
                color: "bg-amber-500",
                title: "Repayment",
                desc: "Repay your loan through the app, dial *885*3134#, or use mobile money. Easy and convenient payment options.",
              },
            ].map((step) => (
              <div key={step.num} className="flex gap-4 pt-3">
                <div
                  className={`${step.color} text-white rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0 text-sm font-bold shadow-sm`}
                >
                  {step.num}
                </div>
                <div>
                  <p className="font-bold text-gray-800 mb-1">{step.title}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-gray-50 transition-colors"
          onClick={() => setShowFAQ(!showFAQ)}
        >
          <span className="font-semibold text-gray-800">
            ❓ Frequently Asked Questions
          </span>
          <span className="text-gray-300 text-sm">{showFAQ ? "▲" : "▼"}</span>
        </button>
        {showFAQ && (
          <div className="border-t border-gray-100" id="faqAccordion">
            {[
              {
                q: "What is the minimum and maximum loan amount I can apply for?",
                a: "CEDI offers flexible loan amounts ranging from GHS 500 to GHS 50,000. The exact amount you qualify for depends on your credit profile, income verification, and repayment history with us.",
              },
              {
                q: "How long does it take to get loan approval?",
                a: "Most loan applications are processed within 24–48 hours. New customers may take slightly longer (up to 72 hours) as we verify your information. Once approved, funds are disbursed immediately to your mobile money account.",
              },
              {
                q: "What documents do I need to apply?",
                a: "You need a valid National Registration Card (NRC), a selfie with your NRC, and contact information for two references. All documents can be uploaded directly through the app.",
              },
              {
                q: "How do I repay my loan?",
                a: "You can repay through the app by clicking 'Pay The Bill', or dial *885*3134# from your registered phone number. We also accept payments through mobile money and bank transfers.",
              },
              {
                q: "What happens if I miss a payment?",
                a: "We understand that sometimes circumstances change. Contact our customer service immediately if you anticipate difficulty making a payment. Late payments may incur additional fees and affect your credit score with us.",
              },
              {
                q: "Is my personal information secure?",
                a: "Yes, CEDI uses bank-level encryption and security measures to protect your personal and financial information. We comply with all data protection regulations and never share your information with unauthorized third parties.",
              },
            ].map((item, idx) => (
              <div key={idx} className="border-b border-gray-100 last:border-0">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  onClick={() =>
                    setExpandedFaq(expandedFaq === idx ? null : idx)
                  }
                >
                  <span className="text-sm font-medium text-gray-700 pr-4">
                    {idx + 1}. {item.q}
                  </span>
                  <span className="text-gray-300 text-sm flex-shrink-0">
                    {expandedFaq === idx ? "▲" : "▼"}
                  </span>
                </button>
                {expandedFaq === idx && (
                  <div className="px-5 pt-1 pb-6">
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Us Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <p className="px-5 pt-5 pb-3 text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Contact Us
        </p>
        <div className="divide-y divide-gray-100">
          <div
            className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() =>
              handleContactClick({ type: "whatsapp", value: "+260971234567" })
            }
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-600">💬</span>
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-sm font-semibold text-gray-700">WhatsApp</p>
              <p className="text-xs text-gray-400 mt-0.5">
                +260 97 123 4567 · Chat with us
              </p>
            </div>
            <span className="text-gray-300">›</span>
          </div>
          <div
            className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() =>
              handleContactClick({ type: "phone", value: "+260212345678" })
            }
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
              <span className="text-cyan-600">📞</span>
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-sm font-semibold text-gray-700">Call Centre</p>
              <p className="text-xs text-gray-400 mt-0.5">
                +260 21 234 5678 · Mon–Sat, 8am–6pm
              </p>
            </div>
            <span className="text-gray-300">›</span>
          </div>
          <div
            className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() =>
              handleContactClick({ type: "ussd", value: "*885*3134#" })
            }
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600">📱</span>
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-sm font-semibold text-gray-700">
                USSD Repayment
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Dial *885*3134# from your phone
              </p>
            </div>
            <span className="text-gray-300">›</span>
          </div>
          <div
            className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() =>
              handleContactClick({
                type: "email",
                value: "customer@cedilending.com",
              })
            }
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-600">✉️</span>
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-sm font-semibold text-gray-700">
                Email Support
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                customer@cedilending.com
              </p>
            </div>
            <span className="text-gray-300">›</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
