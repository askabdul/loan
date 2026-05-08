import React from "react";
import ReactDOM from "react-dom";
import { useToast } from "../../contexts/ToastContext";
import Toast from "./Toast";
import "./Toast.css";

const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  // Render via portal directly under <body> so no ancestor overflow,
  // transform, or z-index context can interfere with positioning.
  return ReactDOM.createPortal(
    <div
      className="toast-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>,
    document.body,
  );
};

export default ToastContainer;
