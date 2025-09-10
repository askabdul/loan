import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { path: '/home', label: 'Home', icon: '🏠' },
    { path: '/apply', label: 'Apply', icon: '💰' },
    { path: '/history', label: 'History', icon: '📜' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div className="bottom-navigation">
      {navItems.map((item) => (
        <div
          key={item.path}
          className={`nav-item ${currentPath === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <div className="nav-icon">{item.icon}</div>
          <div className="nav-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
};

export default BottomNavigation;