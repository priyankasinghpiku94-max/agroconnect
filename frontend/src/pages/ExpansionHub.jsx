import { Link } from "../router";
import { useAuth } from "../context/AuthContext";

export default function ExpansionHub() {
  const { user } = useAuth();
  const cards = [
    {
      icon: "🚜",
      title: "Equipment Rental",
      text: "List or rent verified farm machinery with date-wise availability.",
      to: "/expansion/equipment",
    },
    {
      icon: "🌱",
      title: "Agriculture Inputs",
      text:
        user?.role === "distributor"
          ? "Sell certified seeds, fertilizers and other farm inputs."
          : "Order verified seeds, fertilizers and farm supplies.",
      to: "/expansion/inputs",
    },
    {
      icon: "✨",
      title: "Smart Market Assistant",
      text: "See explainable matches, price trends, alerts and voice navigation.",
      to: "/expansion/smart-market",
    },
    {
      icon: "🏪",
      title: "Collection Centres",
      text:
        user?.role === "admin"
          ? "Manage rural collection capacity and booking approvals."
          : "Reserve aggregation, quality-check and dispatch slots.",
      to: "/expansion/collection-centres",
    },
  ];

  return (
    <main className="phase-four-page">
      <div className="phase-four-container">
        <section className="phase-four-hero">
          <div>
            <p className="phase-four-kicker">⚡ AgroConnect Phase 4</p>
            <h1>
              Rural Commerce <span>Expansion Hub</span>
            </h1>
            <p>
              Equipment, farm inputs, intelligent market discovery and local
              collection infrastructure—connected to your verified account.
            </p>
          </div>
          <div className="phase-four-hero-actions">
            <Link className="btn" to="/expansion/smart-market">
              Open Smart Assistant
            </Link>
            <Link className="btn secondary" to="/business">
              Phase 3 Hub
            </Link>
          </div>
        </section>

        <section className="expansion-grid">
          {cards.map((card) => (
            <article className="expansion-card" key={card.to}>
              <div className="expansion-card-icon">{card.icon}</div>
              <div>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
              </div>
              <Link className="btn" to={card.to}>
                Open Module
              </Link>
            </article>
          ))}
        </section>

        <section className="phase-four-trust-strip">
          <div><strong>Verified</strong><span>KYC-gated transactions</span></div>
          <div><strong>Explainable</strong><span>Every match includes reasons</span></div>
          <div><strong>Capacity-safe</strong><span>Date and stock checks</span></div>
          <div><strong>No paid key</strong><span>Browser-native voice tools</span></div>
        </section>
      </div>
    </main>
  );
}
