import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usersAPI, authAPI } from '../../services/api';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const { user: authUser, logout } = useAuth();

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!authUser) {
        navigate('/login');
        return;
      }

      try {
        setIsLoading(true);
        const profileResponse = await usersAPI.getProfile();
        const profile = profileResponse.user || profileResponse.profile || profileResponse;
        
        const userData = {
          id: profile.userId || authUser.userId || '',
          name: profile.fullName || (
            profile.personalInfo?.firstName && profile.personalInfo?.lastName 
              ? `${profile.personalInfo.firstName} ${profile.personalInfo.lastName}`
              : authUser.phoneNumber || profile.phoneNumber || 'User'
          ),
          email: profile.personalInfo?.email || profile.email || 'Not provided',
          phone: profile.phoneNumber || authUser.phoneNumber || 'Not provided',
          idVerified: profile.idVerification?.verified || profile.idVerification?.isVerified || false,
          accountCreated: new Date(profile.createdAt || authUser.createdAt || Date.now()),
          creditScore: profile.creditScore || 0
        };
        
        setUser(userData);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setUser(null);
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
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 mt-4">
      <div className="page-header mb-4">
        <button 
          className="mb-3 inline-flex items-center rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          onClick={() => navigate('/home')}
        >
          ← Back
        </button>
        <h1 className="page-title text-xl font-semibold">My Profile</h1>
        <p className="page-subtitle text-gray-500">Manage your account information</p>
      </div>

      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading profile...</p>
        </div>
      ) : user ? (
        <div className="row">
          <div className="col-12">
            <div className="bg-white shadow rounded-lg mb-4">
              <div className="p-4">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-600 text-white rounded-full flex items-center justify-center mr-3" style={{width: '80px', height: '80px', fontSize: '2rem', fontWeight: 'bold'}}>
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-1">{user.name}</h2>
                    <p className="text-gray-500 mb-0">ID: {user.id}</p>
                  </div>
                </div>
                
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="p-3 bg-gray-50 rounded">
                      <h6 className="text-gray-500 mb-1">Email</h6>
                      <p className="mb-0 font-medium">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="p-3 bg-gray-50 rounded">
                      <h6 className="text-gray-500 mb-1">Phone</h6>
                      <p className="mb-0 font-medium">{user.phone}</p>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="p-3 bg-gray-50 rounded">
                      <h6 className="text-gray-500 mb-1">ID Verification</h6>
                      <span className={`status-badge ${user.idVerified ? 'status-completed' : 'status-pending'}`}>
                        {user.idVerified ? 'Verified ✓' : 'Not Verified ✗'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="p-3 bg-gray-50 rounded">
                      <h6 className="text-gray-500 mb-1">Account Created</h6>
                      <p className="mb-0 font-medium">
                        {user.accountCreated.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="col-12">
                    <div className="p-3 bg-gray-50 rounded">
                      <h6 className="text-gray-500 mb-2">Credit Score</h6>
                      <div className="flex items-center">
                        <div className="flex-grow mr-3 w-full">
                          <div className="w-full h-2 bg-gray-200 rounded">
                            <div 
                              className="h-2 bg-green-500 rounded" 
                              style={{ width: `${(user.creditScore / 1000) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <span className="font-bold text-green-600 text-lg">{user.creditScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            

            <div className="row g-3 page-bottom-actions">
              <div className="col-md-4 col-lg-12 col-xl-12">
                <button className="w-100 inline-flex items-center rounded border border-blue-500 text-blue-600 hover:bg-blue-50 px-4 py-2 font-medium" onClick={() => navigate('/edit-profile')}>
                  ✏️ Edit Profile
                </button>
              </div>
              <div className="col-md-4 col-lg-12 col-xl-12">
                <button className="w-100 inline-flex items-center rounded border border-gray-400 text-gray-700 hover:bg-gray-50 px-4 py-2 font-medium" onClick={() => navigate('/change-password')}>
                  🔒 Change Password
                </button>
              </div>
              <div className="col-md-4 col-lg-12 col-xl-12">
                <button className="w-100 inline-flex items-center rounded border border-red-500 text-red-600 hover:bg-red-50 px-4 py-2 font-medium" onClick={handleLogout}>
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-5">
          <div className="bg-white shadow rounded-lg">
            <div className="p-6">
              <div className="mb-4">
                <div className="text-5xl text-gray-400">⚠️</div>
              </div>
              <h4 className="text-lg font-semibold text-gray-600">Profile Load Error</h4>
              <p className="text-gray-500 mb-4">Could not load profile information. Please try again.</p>
              <button 
                className="inline-flex items-center rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-base font-medium"
                onClick={() => window.location.reload()}
              >
                🔄 Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
