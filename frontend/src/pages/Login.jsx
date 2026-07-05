import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", form);

      const token = res.data.token;
      const user = res.data.user;

      if (token) localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));

      if (auth?.login) auth.login(user, token);
      if (auth?.setUser) auth.setUser(user);

      if (user?.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Login failed. Please check your email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="agro-login-page">
      <section className="agro-login-card">
        <div className="agro-login-left">
          <div className="agro-brand-circle">🌾</div>

          <p className="agro-small-badge">AgroConnect</p>

          <h1>
            Welcome Back to <span>AgroConnect</span>
          </h1>

          <p>
            Farmers and distributors can manage products, orders and marketplace
            activities from a single smart dashboard.
          </p>

          
        </div>

        <div className="agro-login-right">
          <p className="agro-form-badge">Welcome Back</p>

          <h2>Login Account</h2>

          <p className="agro-form-text">
            Enter your login details to continue.
          </p>

          {error && <div className="agro-error-box">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="agro-input-group">
              <label>Email Address</label>
              <div className="agro-input-box">
                <span>✉️</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="agro-input-group">
              <label>Password</label>
              <div className="agro-input-box">
                <span>🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />

                <button
                  type="button"
                  className="agro-show-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button type="submit" className="agro-login-submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="agro-register-link">
            Don&apos;t have an account? <Link to="/register">Create Account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}