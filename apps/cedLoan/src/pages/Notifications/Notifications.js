import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { notificationsAPI } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";

const typeIcon = {
  loan_status: "🏦",
  payment: "💳",
  announcement: "📢",
  warning: "⚠️",
  success: "✅",
  default: "ℹ️",
};

const Notifications = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchNotifications = useCallback(
    async (pageNum = 1) => {
      try {
        setIsLoading(true);
        const response = await notificationsAPI.getNotifications(pageNum, 20);
        const list = response.notifications || response.data || [];
        if (pageNum === 1) {
          setNotifications(list);
        } else {
          setNotifications((prev) => [...prev, ...list]);
        }
        setHasMore(list.length === 20);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        showToast("Failed to load notifications", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleMarkRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, isRead: true, readAt: new Date() }
            : n,
        ),
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date() })),
      );
      showToast("All notifications marked as read", "success");
    } catch (error) {
      console.error("Error marking all notifications:", error);
      showToast("Failed to mark notifications", "error");
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-xl mx-auto px-4 pt-8 pb-28 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <button
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
            onClick={() => navigate("/home")}
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-400 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="text-sm text-blue-600 hover:text-blue-800 font-semibold mt-2 transition-colors"
            onClick={handleMarkAllRead}
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading && notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading notifications…</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🔔</div>
          <h3 className="text-base font-semibold text-gray-600">
            No notifications yet
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            You'll be notified about loan updates and payments here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                !notification.isRead
                  ? "border-blue-200 bg-blue-50 shadow-sm"
                  : "border-gray-100 shadow-sm"
              }`}
              onClick={() =>
                !notification.isRead && handleMarkRead(notification.id)
              }
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0 mt-0.5">
                  {typeIcon[notification.type] || typeIcon.default}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4
                      className={`font-bold ${!notification.isRead ? "text-blue-900 text-base" : "text-gray-800 text-sm"}`}
                    >
                      {notification.title || "Notification"}
                    </h4>
                    {!notification.isRead && (
                      <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {notification.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notification.createdAt).toLocaleDateString(
                      "en-GB",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              className="w-full py-3 text-sm text-blue-600 hover:text-blue-800 font-semibold text-center transition-colors"
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchNotifications(nextPage);
              }}
              disabled={isLoading}
            >
              {isLoading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
