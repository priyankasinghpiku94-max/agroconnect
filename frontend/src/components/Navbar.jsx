import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          <div className="brand-icon">🌾</div>

          <div className="brand-text">
            <h2>AgroConnect</h2>
            <span>Smart Farming Network</span>
          </div>
        </Link>

        <nav className="nav-menu">
          <NavLink to="/marketplace">Marketplace</NavLink>

          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>

              {user.role === "farmer" && (
                <>
                  <NavLink to="/farmer/products">My Products</NavLink>
                  <NavLink to="/farmer/add-product">Add Product</NavLink>
                  <NavLink to="/orders">Orders</NavLink>
                </>
              )}

              {user.role === "distributor" && (
                <>
                  <NavLink to="/orders">My Orders</NavLink>
                  <NavLink to="/profile">Profile</NavLink>
                </>
              )}

              {user.role === "admin" && <NavLink to="/admin">Admin</NavLink>}

              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register" className="register-link">
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}