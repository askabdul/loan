import React from "react";
import "./EmployeeIdCard.css";

const EmployeeIdCard = ({ admin }) => {
  if (!admin) {
    return <div>No admin data available</div>;
  }

  const {
    firstName,
    lastName,
    designation,
    employeeNumber,
    dateJoined,
    dateOfExpiry,
    profileImage,
  } = admin;

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="employee-id-card">
      <div className="card-header">
        <div className="card-title">EMPLOYEE ID CARD</div>
        <div className="sector-label">Support Sector</div>
      </div>

      <div className="card-body">
        <div className="employee-photo">
          {profileImage ? (
            <img
              src={`${process.env.REACT_APP_API_URL?.replace("/api", "") || "http://localhost:8001"}/${profileImage}`}
              alt={`${firstName} ${lastName}`}
              className="profile-image"
            />
          ) : (
            <div className="default-avatar">
              <span>
                {firstName?.charAt(0)}
                {lastName?.charAt(0)}
              </span>
            </div>
          )}
        </div>

        <div className="employee-details">
          <div className="detail-row">
            <span className="label">Name:</span>
            <span className="value">
              {firstName} {lastName}
            </span>
          </div>

          <div className="detail-row">
            <span className="label">Designation:</span>
            <span className="value">{designation || "N/A"}</span>
          </div>

          <div className="detail-row">
            <span className="label">Joined:</span>
            <span className="value">{formatDate(dateJoined)}</span>
          </div>

          <div className="detail-row">
            <span className="label">Employee Number:</span>
            <span className="value">{employeeNumber || "N/A"}</span>
          </div>
        </div>
      </div>

      <div className="card-footer">
        <div className="barcode">
          <div className="barcode-lines">
            {Array.from({ length: 30 }, (_, i) => (
              <div
                key={i}
                className="barcode-line"
                style={{ height: `${Math.random() * 20 + 10}px` }}
              ></div>
            ))}
          </div>
          <div className="barcode-number">{employeeNumber || "000000"}</div>
        </div>

        <div className="expiry-info">
          <span className="expiry-label">Exp. {formatDate(dateOfExpiry)}</span>
        </div>
      </div>

      <div className="company-info">
        <div className="company-logo">
          <div className="logo-triangle"></div>
          <div className="logo-triangle"></div>
          <div className="logo-triangle"></div>
        </div>
        <div className="company-name">
          <div>Transistor</div>
          <div>Holding</div>
        </div>
        <div className="qr-code">
          <div className="qr-grid">
            {Array.from({ length: 64 }, (_, i) => (
              <div
                key={i}
                className={`qr-dot ${Math.random() > 0.5 ? "filled" : ""}`}
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeIdCard;
