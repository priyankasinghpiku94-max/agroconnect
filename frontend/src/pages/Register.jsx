import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    password: "",
    city: "",
    state: "Bihar",
    businessName: "",
    businessType: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
    setSuccess("");

    if (!form.role) {
      setError("Please select role.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/register", {
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role,
        password: form.password,
        city: form.city,
        state: form.state,
        address: form.city,
        businessName: form.businessName,
        businessType: form.businessType,
      });

      const token = res.data.token;
      const user = res.data.user;

      if (token) {
        localStorage.setItem("token", token);
      }

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }

      if (auth?.login) {
        auth.login(user, token);
      }

      if (auth?.setUser) {
        auth.setUser(user);
      }

      setSuccess("Registration successful.");

      setTimeout(() => {
        navigate("/dashboard");
      }, 700);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card wide">
        <p className="auth-badge">Join AgroConnect</p>

        <h2>Create Your Account</h2>

        <p className="auth-subtitle">
          Register as a farmer or distributor and start using the marketplace.
        </p>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <form className="grid two" onSubmit={handleSubmit}>
          <div>
            <label>Full Name</label>
            <input
              name="name"
              type="text"
              placeholder="Enter full name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label>Email Address</label>
            <input
              name="email"
              type="email"
              placeholder="Enter email address"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label>Phone Number</label>
            <input
              name="phone"
              type="text"
              placeholder="Enter phone number"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label>Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              required
            >
              <option value="">Select Role</option>
              <option value="farmer">Farmer</option>
              <option value="distributor">Distributor</option>
            </select>
          </div>

          <div>
            <label>Password</label>
            <input
              name="password"
              type="password"
              placeholder="Create password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label>City</label>
            <input
              name="city"
              type="text"
              placeholder="Enter city/location"
              value={form.city}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label>State</label>
            <input
              name="state"
              type="text"
              value={form.state}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label>Farm/Business Name</label>
            <input
              name="businessName"
              type="text"
              placeholder="Enter farm or business name"
              value={form.businessName}
              onChange={handleChange}
            />
          </div>

          <div>
            <label>Business Type</label>
            <input
              name="businessType"
              type="text"
              placeholder="Farmer, FPO, wholesaler..."
              value={form.businessType}
              onChange={handleChange}
            />
          </div>

          <div className="full-width">
            <button type="submit" className="btn full" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>
          </div>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Login Here</Link>
        </p>
      </div>
    </main>
  );
}
