import { Link } from "../router";
import { useAuth } from "../context/AuthContext";

export default function LaunchHub() {
  const { user } = useAuth();
  const cards = [
    {
      icon: "₹",
      title: "Finance Center",
      text:
        user?.role === "admin"
          ? "Verify payment records, subscriptions and platform revenue."
          : "Create invoices, record payments and manage commission plans.",
      to: "/launch/finance",
    },
    {
      icon: "🚚",
      title: "Fulfilment Center",
      text:
        user?.role === "admin"
          ? "Oversee shipment milestones and quality inspections."
          : "Track dispatch milestones and independent quality checks.",
      to: "/launch/fulfilment",
    },
    {
      icon: "🛡️",
      title: "Trust Center",
      text:
        user?.role === "admin"
          ? "Moderate verified reviews and resolve structured disputes."
          : "Review completed deals and raise traceable order disputes.",
      to: "/launch/trust",
    },
  ];

  return (
    <main className="phase-five-page">
      <div className="phase-five-container">
        <section className="phase-five-hero">
          <div>
            <p className="phase-five-kicker">AgroConnect Phase 5</p>
            <h1>Trust, Revenue &amp; <span>Fulfilment</span></h1>
            <p>
              Turn accepted deals into auditable invoices, tracked delivery,
              inspected quality and trusted business relationships.
            </p>
          </div>
          <Link className="btn secondary" to="/dashboard">Back to Dashboard</Link>
        </section>

        <section className="phase-five-module-grid">
          {cards.map((card) => (
            <article className="phase-five-module-card" key={card.to}>
              <div className="phase-five-module-icon">{card.icon}</div>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
              <Link className="btn" to={card.to}>Open Center</Link>
            </article>
          ))}
        </section>

        <section className="phase-five-assurance">
          <div><strong>Order-linked</strong><span>No orphan business records</span></div>
          <div><strong>Role-safe</strong><span>Participant and admin access</span></div>
          <div><strong>Auditable</strong><span>Status history and references</span></div>
          <div><strong>Gateway-ready</strong><span>Manual verification for now</span></div>
        </section>

        <section className="phase-six-bridge">
          <div>
            <p>Phase 6 Communication</p>
            <h2>Keep users connected after the transaction.</h2>
            <span>Secure chat, live weather guidance and channel preferences.</span>
          </div>
          <Link className="btn" to="/connect">Open Phase 6</Link>
        </section>
      </div>
    </main>
  );
}
