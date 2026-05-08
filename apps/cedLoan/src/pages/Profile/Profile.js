import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usersAPI, authAPI, loansAPI } from "../../services/api";

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loanStats, setLoanStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const { user: authUser, logout } = useAuth();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!authUser) {
        navigate("/login");
        return;
      }

      try {
        setIsLoading(true);
        const [profileResponse, statsResponse] = await Promise.allSettled([
          usersAPI.getProfile(),
          loansAPI.getLoanStats(),
        ]);

        if (profileResponse.status === "fulfilled") {
          const profile = profileResponse.value.user || profileResponse.value;
          setUser({
            id: profile.id || authUser.id || "",
            name:
              profile.firstName && profile.lastName
                ? `${profile.firstName} ${profile.lastName}`.trim()
                : profile.phoneNumber || authUser.phoneNumber || "User",
            email: profile.email || "Not provided",
            phone:
              profile.phoneNumber || authUser.phoneNumber || "Not provided",
            idVerified: profile.idVerified || false,
            accountCreated: new Date(
              profile.createdAt || authUser.createdAt || Date.now(),
            ),
            creditScore: profile.creditScore || 0,
            currentLoanLevel: profile.currentLoanLevel || 1,
            registrationStatus: profile.registrationStatus || "basic",
          });
        }

        if (statsResponse.status === "fulfilled") {
          setLoanStats(statsResponse.value.stats || statsResponse.value);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [authUser, navigate]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout even if API call fails
      logout();
      navigate("/login");
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 pt-8 pb-28 space-y-5">
      <div>
        <button
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
          onClick={() => navigate("/home")}
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage your account information
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading profile…</p>
        </div>
      ) : user ? (
        <div className="space-y-5">
          {/* Identity Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-5 mb-6">
              <div
                className="w-18 h-18 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 ring-4 ring-blue-100"
                style={{ width: "4.5rem", height: "4.5rem" }}
              >
                <span className="text-white text-3xl font-bold">
                  {user.name.charAt(0)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Member ID: {user.id}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3.5">
                <p className="text-xs text-gray-400 mb-1.5">Email</p>
                <p className="text-sm font-semibold text-gray-800 break-all">
                  {user.email}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5">
                <p className="text-xs text-gray-400 mb-1.5">Phone</p>
                <p className="text-sm font-semibold text-gray-800">
                  {user.phone}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5">
                <p className="text-xs text-gray-400 mb-1.5">ID Verification</p>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${user.idVerified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {user.idVerified ? "✓ Verified" : "⏳ Pending"}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5">
                <p className="text-xs text-gray-400 mb-1.5">Loan Level</p>
                <span className="inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                  Level {user.currentLoanLevel}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3.5 col-span-2">
                <p className="text-xs text-gray-400 mb-1.5">Member Since</p>
                <p className="text-sm font-semibold text-gray-800">
                  {user.accountCreated.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Credit Score */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
              Credit Score
            </p>
            <div className="flex items-center gap-5">
              <div className="flex-grow">
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-3 bg-emerald-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min((user.creditScore / 1000) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-2">
                  <span>0</span>
                  <span>1000</span>
                </div>
              </div>
              <span className="text-3xl font-bold text-emerald-600 flex-shrink-0">
                {user.creditScore}
              </span>
            </div>
          </div>

          {/* Loan Summary */}
          {loanStats && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
                Loan Summary
              </p>
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                <div className="text-center px-3">
                  <p className="text-3xl font-bold text-blue-600">
                    {loanStats.totalLoans || 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5">Total</p>
                </div>
                <div className="text-center px-3">
                  <p className="text-3xl font-bold text-emerald-600">
                    {loanStats.completedLoans || 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5">Completed</p>
                </div>
                <div className="text-center px-3">
                  <p className="text-3xl font-bold text-orange-500">
                    {loanStats.activeLoans || 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-1.5">Active</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
              onClick={() => navigate("/forgot-pin")}
            >
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-gray-600">🔒</span>
              </div>
              <span className="text-sm font-semibold text-gray-800 flex-grow text-left">
                Change PIN
              </span>
              <span className="text-gray-300">›</span>
            </button>
            <div className="border-t border-gray-100" />
            <button
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-red-50 transition-colors"
              onClick={handleLogout}
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-500">🚪</span>
              </div>
              <span className="text-sm font-semibold text-red-600 flex-grow text-left">
                Logout
              </span>
              <span className="text-red-300">›</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h4 className="text-base font-semibold text-gray-700 mb-1">
            Profile Load Error
          </h4>
          <p className="text-sm text-gray-400 mb-6">
            Could not load profile information. Please try again.
          </p>
          <button
            className="w-full max-w-xs mx-auto block bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl px-4 py-3 text-sm font-semibold"
            onClick={() => window.location.reload()}
          >
            🔄 Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;
