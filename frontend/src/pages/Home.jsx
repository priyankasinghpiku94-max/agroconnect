import { Link } from "react-router-dom";

export default function Home() {
  return (
    <main className="home-page">
      <section className="premium-hero">
        <div className="hero-glow hero-glow-one"></div>
        <div className="hero-glow hero-glow-two"></div>

        <div className="hero-content">
          <p className="eyebrow">🌾 AgroConnect</p>

          <h1>
            Connect Farmers With{" "}
            <span>Trusted Distributors</span>
          </h1>

          <p className="hero-description">
            A premium web-based agriculture marketplace that helps farmers sell
            crops directly to distributors, reduce middlemen, increase profit
            transparency and build a smarter supply chain.
          </p>

          <div className="actions">
            <Link className="btn primary-btn" to="/register">
              Get Started
            </Link>

            <Link className="btn secondary-btn" to="/marketplace">
              Explore Marketplace
            </Link>
          </div>

          <div className="hero-stats">
            <div>
              <h3>500+</h3>
              <p>Farmers</p>
            </div>
            <div>
              <h3>120+</h3>
              <p>Distributors</p>
            </div>
            <div>
              <h3>50+</h3>
              <p>Crop Types</p>
            </div>
          </div>
        </div>

        <div className="hero-card premium-card">
          <div className="card-top">
            <div className="card-icon">🚜</div>
            <div>
              <p>Smart Farming Network</p>
              <h3>Why AgroConnect?</h3>
            </div>
          </div>

          <ul>
            <li>
              <span>✓</span>
              Direct farmer-distributor connection
            </li>
            <li>
              <span>✓</span>
              Premium crop listing and search
            </li>
            <li>
              <span>✓</span>
              Order and inquiry management
            </li>
            <li>
              <span>✓</span>
              Admin monitoring dashboard
            </li>
          </ul>

          <div className="mini-card">
            <p>Platform Benefit</p>
            <h4>No unnecessary middlemen</h4>
          </div>
        </div>
      </section>

      <section className="container premium-features">
        <div className="feature">
          <div className="feature-icon">👨‍🌾</div>
          <h3>For Farmers</h3>
          <p>
            Add crops, manage stock, update prices and receive distributor
            inquiries directly.
          </p>
        </div>

        <div className="feature">
          <div className="feature-icon">🚚</div>
          <h3>For Distributors</h3>
          <p>
            Search fresh crops by category, quantity and location and place bulk
            order requests.
          </p>
        </div>

        <div className="feature">
          <div className="feature-icon">📊</div>
          <h3>For Admin</h3>
          <p>
            Manage users, crop listings, inquiries and platform records from one
            dashboard.
          </p>
        </div>
      </section>
    </main>
  );
}