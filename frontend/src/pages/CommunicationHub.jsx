import { Link } from "../router";
import { useAuth } from "../context/AuthContext";

export default function CommunicationHub() {
  const { user } = useAuth();
  const cards = [
    ...(user?.role !== "admin"
      ? [{
          icon: "💬",
          title: "Business Chat",
          text: "Secure order-linked messages between the verified farmer and distributor.",
          to: "/connect/messages",
        }]
      : []),
    {
      icon: "🌦️",
      title: "Weather Advisory",
      text: "Location-based forecast, risk warnings and Hindi/English crop guidance.",
      to: "/connect/advisory",
    },
    {
      icon: "🔔",
      title: user?.role === "admin" ? "Delivery Outbox" : "Notification Preferences",
      text:
        user?.role === "admin"
          ? "Inspect queued email/SMS records and platform delivery readiness."
          : "Choose channels, alert categories, language and quiet hours.",
      to: "/connect/preferences",
    },
  ];

  return (
    <main className="phase-six-page">
      <div className="phase-six-container">
        <section className="phase-six-hero">
          <div>
            <p className="phase-six-kicker">AgroConnect Phase 6</p>
            <h1>Communication &amp; <span>Smart Advisory</span></h1>
            <p>
              Keep every business conversation tied to an order and convert live
              weather signals into practical, explainable field guidance.
            </p>
          </div>
          <Link className="btn secondary" to="/dashboard">Back to Dashboard</Link>
        </section>

        <section className="phase-six-module-grid">
          {cards.map((card) => (
            <article className="phase-six-module-card" key={card.to}>
              <div className="phase-six-module-icon">{card.icon}</div>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
              <Link className="btn" to={card.to}>Open Module</Link>
            </article>
          ))}
        </section>

        <section className="phase-six-trust-row">
          <div><strong>Participant-only</strong><span>Chat is order scoped</span></div>
          <div><strong>Near real-time</strong><span>Secure automatic refresh</span></div>
          <div><strong>Live + cached</strong><span>Weather outage fallback</span></div>
          <div><strong>Provider-ready</strong><span>Email/SMS outbox</span></div>
        </section>
      </div>
    </main>
  );
}
