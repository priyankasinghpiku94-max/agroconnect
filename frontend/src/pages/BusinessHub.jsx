import { Link } from "../router";
import { useAuth } from "../context/AuthContext";

export default function BusinessHub() {
  const { user } = useAuth();
  const cards = [
    ...(user?.role === "farmer"
      ? [
          {
            icon: "👥",
            title: "FPO Workspace",
            text: "Manage members and view your collective crop inventory.",
            to: "/business/fpo",
          },
        ]
      : []),
    ...(user?.role !== "admin"
      ? [
          {
            icon: "🏛️",
            title: "Procurement Contracts",
            text: "Track recurring institutional supply agreements.",
            to: "/business/contracts",
          },
        ]
      : [
          {
            icon: "🏛️",
            title: "All Contracts",
            text: "Review institutional procurement across the platform.",
            to: "/business/contracts",
          },
        ]),
    {
      icon: "🏬",
      title: user?.role === "admin" ? "Warehouse Operations" : "Warehouse Booking",
      text:
        user?.role === "admin"
          ? "Add facilities and approve storage booking requests."
          : "Reserve verified storage capacity for crops and orders.",
      to: "/business/warehouses",
    },
    {
      icon: "📈",
      title: "Business Analytics",
      text: "Review performance, trends and export business records.",
      to: "/business/analytics",
    },
  ];

  return (
    <main className="phase-three-page">
      <div className="phase-three-container">
        <section className="phase-three-hero">
          <div>
            <p className="phase-three-kicker">🚀 AgroConnect Phase 3</p>
            <h1>
              Business <span>Growth Hub</span>
            </h1>
            <p>
              Manage recurring procurement, farmer collectives, verified
              storage and decision-ready analytics from one workspace.
            </p>
          </div>
          <Link className="btn secondary" to="/dashboard">Dashboard</Link>
        </section>

        <section className="business-hub-grid">
          {cards.map((card) => (
            <article className="business-hub-card" key={card.to}>
              <div className="business-hub-icon">{card.icon}</div>
              <h2>{card.title}</h2>
              <p>{card.text}</p>
              <Link className="btn" to={card.to}>Open Workspace</Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
