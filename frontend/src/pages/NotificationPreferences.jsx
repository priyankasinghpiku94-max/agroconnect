import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import Phase5Status from "../components/Phase5Status";

const defaultPreferences = {
  in_app_enabled: true,
  email_enabled: false,
  sms_enabled: false,
  order_updates: true,
  price_alerts: true,
  chat_messages: true,
  weather_advisories: true,
  preferred_language: "en",
  quiet_start: "",
  quiet_end: "",
};

const preferenceItems = [
  ["in_app_enabled", "In-app notifications", "Show updates inside AgroConnect."],
  ["email_enabled", "Email delivery queue", "Queue enabled alerts for your account email."],
  ["sms_enabled", "SMS delivery queue", "Queue enabled alerts for your registered phone."],
  ["order_updates", "Order & business updates", "Orders, payments, shipment, inspection and disputes."],
  ["price_alerts", "Price alerts", "Target-price and market intelligence notifications."],
  ["chat_messages", "Business messages", "New order-linked chat messages."],
  ["weather_advisories", "Weather advisories", "Weather-risk alerts when scheduling is enabled."],
];

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [form, setForm] = useState(defaultPreferences);
  const [outbox, setOutbox] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const requests = [api.get("/preferences")];
      if (user?.role === "admin") requests.push(api.get("/preferences/outbox"));
      const responses = await Promise.all(requests);
      setForm({
        ...defaultPreferences,
        ...(responses[0].data.preferences || {}),
        in_app_enabled: Boolean(responses[0].data.preferences?.in_app_enabled),
        email_enabled: Boolean(responses[0].data.preferences?.email_enabled),
        sms_enabled: Boolean(responses[0].data.preferences?.sms_enabled),
        order_updates: Boolean(responses[0].data.preferences?.order_updates),
        price_alerts: Boolean(responses[0].data.preferences?.price_alerts),
        chat_messages: Boolean(responses[0].data.preferences?.chat_messages),
        weather_advisories: Boolean(responses[0].data.preferences?.weather_advisories),
        quiet_start: responses[0].data.preferences?.quiet_start || "",
        quiet_end: responses[0].data.preferences?.quiet_end || "",
      });
      if (user?.role === "admin") setOutbox(responses[1].data.outbox || []);
    } catch (err) {
      setError(err.response?.data?.message || "Preferences could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const savePreferences = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError("");
      setNotice("");
      const response = await api.put("/preferences", form);
      setNotice(response.data.message);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Preferences could not be saved");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="phase-six-page"><div className="phase-six-loading"><div className="loader"></div><p>Loading notification settings...</p></div></main>;
  }

  return (
    <main className="phase-six-page">
      <div className="phase-six-container">
        <section className="phase-six-page-head">
          <div>
            <p className="phase-six-kicker">Communication controls</p>
            <h1>{user?.role === "admin" ? "Preferences & Delivery Outbox" : "Notification Preferences"}</h1>
            <p>Control which business events can reach your selected channels.</p>
          </div>
        </section>
        <div className="phase-six-provider-note">
          <strong>Provider-ready mode:</strong> Email/SMS selections create queued
          delivery records. They are not sent until a production provider worker
          with verified credentials is connected.
        </div>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        <form className="phase-six-panel notification-settings-form" onSubmit={savePreferences}>
          <div className="phase-six-section-head"><div><p>Your account</p><h2>Channels & Categories</h2></div></div>
          <div className="preference-toggle-grid">
            {preferenceItems.map(([key, title, description]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                />
                <span className="preference-switch"></span>
                <div><strong>{title}</strong><small>{description}</small></div>
              </label>
            ))}
          </div>
          <div className="preference-lower-row">
            <label>Preferred language
              <select value={form.preferred_language} onChange={(event) => setForm({ ...form, preferred_language: event.target.value })}>
                <option value="en">English</option><option value="hi">हिन्दी</option>
              </select>
            </label>
            <label>Quiet hours start
              <input type="time" value={form.quiet_start} onChange={(event) => setForm({ ...form, quiet_start: event.target.value })} />
            </label>
            <label>Quiet hours end
              <input type="time" value={form.quiet_end} onChange={(event) => setForm({ ...form, quiet_end: event.target.value })} />
            </label>
            <button className="btn" disabled={saving}>{saving ? "Saving…" : "Save Preferences"}</button>
          </div>
        </form>

        {user?.role === "admin" && (
          <section className="phase-six-panel">
            <div className="phase-six-section-head"><div><p>Provider hand-off</p><h2>Delivery Outbox</h2></div><span>{outbox.length} latest</span></div>
            <div className="phase-six-table-wrap">
              <table>
                <thead><tr><th>User</th><th>Channel</th><th>Recipient</th><th>Notification</th><th>Status</th><th>Created</th></tr></thead>
                <tbody>
                  {outbox.map((item) => {
                    const payload = typeof item.payload === "string"
                      ? (() => { try { return JSON.parse(item.payload); } catch { return {}; } })()
                      : item.payload || {};
                    return (
                      <tr key={item.id}>
                        <td>{item.user_name}<small>#{item.user_id}</small></td>
                        <td>{item.channel.toUpperCase()}</td>
                        <td>{item.recipient}</td>
                        <td>{payload.title || "Notification"}<small>{payload.type}</small></td>
                        <td><Phase5Status value={item.status} /></td>
                        <td>{new Date(item.created_at).toLocaleString("en-IN")}</td>
                      </tr>
                    );
                  })}
                  {!outbox.length && <tr><td colSpan="6" className="empty-row">No email/SMS records have been queued.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
