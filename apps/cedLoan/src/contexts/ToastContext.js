import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};

// Must match the toastSlideDown animation duration in Toast.css
const EXIT_DURATION = 250;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({}); // { [id]: timeoutHandle }

  // Phase-1: mark removing (triggers CSS exit animation)
  // Phase-2: remove from state after animation completes
  const dismiss = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, removing: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, EXIT_DURATION);
  }, []);

  const removeToast = useCallback(
    (id) => {
      if (timers.current[id]) {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
      }
      dismiss(id);
    },
    [dismiss],
  );

  const addToast = useCallback(
    (message, type = "info", duration = 5000) => {
      const id = `toast-${type}-${Date.now()}`;

      setToasts((prev) => {
        // Never stack more than 3 toasts — drop the oldest if at cap
        const capped = prev.length >= 3 ? prev.slice(1) : prev;
        return [...capped, { id, message, type, duration, removing: false }];
      });

      if (duration > 0) {
        timers.current[id] = setTimeout(() => {
          delete timers.current[id];
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss],
  );

  const showToast = useCallback(
    (msg, type = "info", dur) => addToast(msg, type, dur),
    [addToast],
  );
  const showSuccess = useCallback(
    (msg, dur) => addToast(msg, "success", dur),
    [addToast],
  );
  const showError = useCallback(
    (msg, dur) => addToast(msg, "error", dur),
    [addToast],
  );
  const showInfo = useCallback(
    (msg, dur) => addToast(msg, "info", dur),
    [addToast],
  );
  const showWarning = useCallback(
    (msg, dur) => addToast(msg, "warning", dur),
    [addToast],
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        showToast,
        showSuccess,
        showError,
        showInfo,
        showWarning,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};
