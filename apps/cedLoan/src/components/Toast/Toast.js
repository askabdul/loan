import React from "react";
import "./Toast.css";

const ICONS = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

const Toast = ({ toast, onClose }) => {
  const { id, type, message, duration, removing } = toast;

  return (
    <div
      className={`toast toast-${type}${removing ? " toast-removing" : ""}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="toast-content">
        <span className="toast-icon" aria-hidden="true">
          {ICONS[type] ?? "ℹ"}
        </span>
        <span className="toast-message">{message}</span>
        <button
          className="toast-close"
          onClick={() => onClose(id)}
          aria-label="Dismiss notification"
          type="button"
        >
          ×
        </button>
      </div>
      {duration > 0 && !removing && (
        <div className="toast-progress" aria-hidden="true">
          <div
            className="toast-progress-bar"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}
    </div>
  );
};

export default Toast;
