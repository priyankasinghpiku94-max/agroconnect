import { Link } from "../router";
import VerificationBadge from "../components/VerificationBadge";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <main className="user-dashboard-page">
      <div className="user-dashboard-container">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-badge">🌾 Welcome to AgroConnect</p>

            <h1>
              Hello, <span>{user?.name || "User"}</span>
            </h1>

            <p>
              Manage your AgroConnect activities from one place. Your current
              role is <strong>{user?.role || "user"}</strong>.
            </p>
          </div>

          <div className="dashboard-profile-card">
            <div className="profile-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>

            <div>
              <h3>{user?.name || "AgroConnect User"}</h3>
              <p>{user?.email || "user@agroconnect.com"}</p>
              <span>{user?.role || "user"}</span>
            </div>
          </div>
        </section>

        {user?.role !== "admin" && (
          <section className="dashboard-verification-card">
            <div>
              <p>Business Verification</p>
              <h2>
                <VerificationBadge
                  status={user?.verification_status || "unsubmitted"}
                />
              </h2>
              <span>
                Verified accounts can publish crops, place orders and update
                business transactions.
              </span>
            </div>
            <Link className="btn" to="/profile">
              Manage Profile & KYC
            </Link>
          </section>
        )}

        {user?.role === "farmer" && (
          <section className="dashboard-action-grid">
            <div className="dashboard-action-card">
              <div className="action-icon">➕</div>
              <h3>Add Product</h3>
              <p>List your crop or product for distributors.</p>

              <Link className="btn dashboard-btn" to="/farmer/add-product">
                Add Now
              </Link>
            </div>

            <div className="dashboard-action-card">
              <div className="action-icon">🌽</div>
              <h3>My Products</h3>
              <p>View, edit and delete your listed products.</p>

              <Link
                className="btn secondary dashboard-btn"
                to="/farmer/products"
              >
                View Products
              </Link>
            </div>

            <div className="dashboard-action-card">
              <div className="action-icon">📦</div>
              <h3>Orders</h3>
              <p>Accept or reject distributor order requests.</p>

              <Link className="btn secondary dashboard-btn" to="/orders">
                View Orders
              </Link>
            </div>

            <div className="dashboard-action-card">
              <div className="action-icon">📣</div>
              <h3>Demand Board</h3>
              <p>Find verified bulk demand and submit quotations.</p>
              <Link className="btn secondary dashboard-btn" to="/demands">
                Browse Demands
              </Link>
            </div>

            <div className="dashboard-action-card">
              <div className="action-icon">🤝</div>
              <h3>Negotiations</h3>
              <p>Review offers, counter prices and confirm deals.</p>
              <Link className="btn secondary dashboard-btn" to="/negotiations">
                Open Negotiations
              </Link>
            </div>
            <div className="dashboard-action-card phase-three-dashboard-card">
              <div className="action-icon">👥</div>
              <h3>Business Growth Hub</h3>
              <p>Manage FPO, contracts, warehouses and business analytics.</p>
              <Link className="btn dashboard-btn" to="/business">
                Open Business Hub
              </Link>
            </div>
            <div className="dashboard-action-card phase-four-dashboard-card">
              <div className="action-icon">🚜</div>
              <h3>Phase 4 Expansion</h3>
              <p>Equipment, agri-inputs, smart matching and collection centres.</p>
              <Link className="btn dashboard-btn" to="/expansion">Open Expansion</Link>
            </div>
            <div className="dashboard-action-card phase-five-dashboard-card">
              <div className="action-icon">🛡️</div>
              <h3>Phase 5 Launch</h3>
              <p>Invoices, delivery tracking, inspections, reviews and disputes.</p>
              <Link className="btn dashboard-btn" to="/launch">Open Launch Hub</Link>
            </div>
            <div className="dashboard-action-card phase-six-dashboard-card">
              <div className="action-icon">🌦️</div>
              <h3>Phase 6 Connect</h3>
              <p>Order chat, live weather advisory and notification controls.</p>
              <Link className="btn dashboard-btn" to="/connect">Open Connect Hub</Link>
            </div>
          </section>
        )}

        {user?.role === "distributor" && (
          <section className="dashboard-action-grid">
            <div className="dashboard-action-card">
              <div className="action-icon">🛒</div>
              <h3>Marketplace</h3>
              <p>Search fresh crops directly from farmers.</p>

              <Link className="btn dashboard-btn" to="/marketplace">
                Explore
              </Link>
            </div>

            <div className="dashboard-action-card">
              <div className="action-icon">🚚</div>
              <h3>My Orders</h3>
              <p>Track all orders sent to farmers.</p>

              <Link className="btn secondary dashboard-btn" to="/orders">
                View Orders
              </Link>
            </div>

            <div className="dashboard-action-card">
              <div className="action-icon">🏢</div>
              <h3>Profile</h3>
              <p>Manage your distributor business information.</p>

              <Link className="btn secondary dashboard-btn" to="/profile">
                Profile
              </Link>
            </div>

            <div className="dashboard-action-card">
              <div className="action-icon">📣</div>
              <h3>Purchase Demands</h3>
              <p>Publish bulk requirements for verified farmers.</p>
              <Link className="btn dashboard-btn" to="/demands">
                Manage Demands
              </Link>
            </div>

            <div className="dashboard-action-card">
              <div className="action-icon">🤝</div>
              <h3>Negotiations</h3>
              <p>Accept, reject or counter farmer quotations.</p>
              <Link className="btn secondary dashboard-btn" to="/negotiations">
                Review Offers
              </Link>
            </div>
            <div className="dashboard-action-card phase-three-dashboard-card">
              <div className="action-icon">🏛️</div>
              <h3>Business Growth Hub</h3>
              <p>Manage recurring contracts, storage and procurement analytics.</p>
              <Link className="btn dashboard-btn" to="/business">
                Open Business Hub
              </Link>
            </div>
            <div className="dashboard-action-card phase-four-dashboard-card">
              <div className="action-icon">✨</div>
              <h3>Phase 4 Expansion</h3>
              <p>Input sales, equipment rental, price alerts and smart matches.</p>
              <Link className="btn dashboard-btn" to="/expansion">Open Expansion</Link>
            </div>
            <div className="dashboard-action-card phase-five-dashboard-card">
              <div className="action-icon">₹</div>
              <h3>Phase 5 Launch</h3>
              <p>Payments, subscriptions, shipment tracking and business trust.</p>
              <Link className="btn dashboard-btn" to="/launch">Open Launch Hub</Link>
            </div>
            <div className="dashboard-action-card phase-six-dashboard-card">
              <div className="action-icon">💬</div>
              <h3>Phase 6 Connect</h3>
              <p>Talk to farmers, check weather signals and control alerts.</p>
              <Link className="btn dashboard-btn" to="/connect">Open Connect Hub</Link>
            </div>
          </section>
        )}

        {user?.role === "admin" && (
          <section className="dashboard-action-grid admin-only-grid">
            <div className="dashboard-action-card">
              <div className="action-icon">📊</div>
              <h3>Admin Dashboard</h3>
              <p>Manage users, products, orders and platform records.</p>

              <Link className="btn dashboard-btn" to="/admin">
                Open Admin
              </Link>
            </div>
            <div className="dashboard-action-card phase-three-dashboard-card">
              <div className="action-icon">📈</div>
              <h3>Business Operations</h3>
              <p>Manage warehouses, institutional contracts and analytics.</p>
              <Link className="btn secondary dashboard-btn" to="/business">
                Open Business Hub
              </Link>
            </div>
            <div className="dashboard-action-card phase-four-dashboard-card">
              <div className="action-icon">🏪</div>
              <h3>Expansion Operations</h3>
              <p>Manage equipment, inputs, alerts and collection centres.</p>
              <Link className="btn dashboard-btn" to="/expansion">Open Phase 4</Link>
            </div>
            <div className="dashboard-action-card phase-five-dashboard-card">
              <div className="action-icon">⚖️</div>
              <h3>Phase 5 Operations</h3>
              <p>Verify payments, control fulfilment and resolve disputes.</p>
              <Link className="btn dashboard-btn" to="/launch">Open Phase 5</Link>
            </div>
            <div className="dashboard-action-card phase-six-dashboard-card">
              <div className="action-icon">🔔</div>
              <h3>Phase 6 Operations</h3>
              <p>Monitor advisory use and external notification delivery queues.</p>
              <Link className="btn dashboard-btn" to="/connect">Open Phase 6</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
