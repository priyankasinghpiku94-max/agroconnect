import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      setUnread(Number(res.data.unread_count || 0));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const destination = (item) => {
    if (item.related_type === "quotation") return "/negotiations";
    if (item.related_type === "order") return "/orders";
    if (item.related_type === "demand") return "/demands";
    return "/dashboard";
  };

  const openNotification = async (item) => {
    try {
      if (!item.is_read) await api.patch(`/notifications/${item.id}/read`);
    } finally {
      navigate(destination(item));
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications(notifications.map((item) => ({ ...item, is_read: 1 })));
      setUnread(0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update notifications");
    }
  };

  return (
    <main className="phase-two-page">
      <div className="phase-two-container notification-container">
        <section className="phase-two-hero">
          <div>
            <p className="phase-two-badge">🔔 Activity Center</p>
            <h1>Business <span>Notifications</span></h1>
            <p>Stay updated on quotations, counter-offers, demand decisions and orders.</p>
          </div>
          {unread > 0 && <button className="btn secondary" onClick={markAllRead}>Mark all read ({unread})</button>}
        </section>

        {error && <div className="alert error">{error}</div>}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading notifications...</p></div>
        ) : notifications.length === 0 ? (
          <section className="phase-two-empty">
            <div className="empty-icon">🔔</div>
            <h2>No notifications</h2>
            <p>New business activity will appear here.</p>
          </section>
        ) : (
          <section className="notification-list">
            {notifications.map((item) => (
              <button
                key={item.id}
                className={`notification-card ${item.is_read ? "read" : "unread"}`}
                onClick={() => openNotification(item)}
              >
                <span className="notification-icon">{item.is_read ? "✓" : "●"}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <time>{new Date(item.created_at).toLocaleString()}</time>
                </div>
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
