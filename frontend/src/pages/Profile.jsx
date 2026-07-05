import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <main className="profile-page">
      <div className="profile-container">
        <section className="profile-card">
          <div className="profile-avatar-large">
            {user?.name?.charAt(0)?.toUpperCase() || "A"}
          </div>

          <div className="profile-info">
            <p className="profile-badge">AgroConnect Profile</p>

            <h1>{user?.name || "User"}</h1>

            <span className="profile-role">
              {user?.role || "user"}
            </span>

            <div className="profile-details">
              <div>
                <label>Email</label>
                <p>{user?.email || "N/A"}</p>
              </div>

              <div>
                <label>Phone</label>
                <p>{user?.phone || "N/A"}</p>
              </div>

              <div>
                <label>City</label>
                <p>{user?.city || user?.district || "N/A"}</p>
              </div>

              <div>
                <label>State</label>
                <p>{user?.state || "N/A"}</p>
              </div>

              <div className="full-width">
                <label>Address</label>
                <p>{user?.address || "N/A"}</p>
              </div>
            </div>

            <div className="profile-actions">
              <Link className="btn secondary" to="/dashboard">
                Back to Dashboard
              </Link>

              <button className="btn danger" onClick={logout}>
                Logout
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}