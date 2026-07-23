import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import VerificationBadge from "../components/VerificationBadge";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, logout, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    state: "",
    address: "",
    businessName: "",
    businessType: "",
  });
  const [verification, setVerification] = useState(null);
  const [documentType, setDocumentType] = useState("");
  const [document, setDocument] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      phone: user.phone || "",
      city: user.city || user.district || "",
      state: user.state || "",
      address: user.address || "",
      businessName: user.business_name || "",
      businessType: user.business_type || "",
    });

    if (user.role !== "admin") {
      api
        .get("/verification/status")
        .then((res) => setVerification(res.data.verification))
        .catch((err) =>
          setError(err.response?.data?.message || "Failed to load KYC status")
        );
    }
  }, [user]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      setMessage("");
      await api.put("/auth/me", form);
      await refreshProfile();
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const submitKyc = async (e) => {
    e.preventDefault();
    if (!documentType || !document) {
      setError("Please select a document type and file.");
      return;
    }
    if (document.size > 8 * 1024 * 1024) {
      setError("KYC document must be smaller than 8 MB.");
      return;
    }

    const payload = new FormData();
    payload.append("documentType", documentType);
    payload.append("document", document);

    try {
      setUploading(true);
      setError("");
      setMessage("");
      await api.post("/verification/kyc", payload);
      const statusRes = await api.get("/verification/status");
      setVerification(statusRes.data.verification);
      await refreshProfile();
      setDocument(null);
      setMessage("KYC submitted successfully. Admin review is pending.");
      e.target.reset();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit KYC");
    } finally {
      setUploading(false);
    }
  };

  const status =
    verification?.verification_status ||
    user?.verification_status ||
    "unsubmitted";

  return (
    <main className="profile-page phase-one-profile">
      <div className="profile-container">
        <section className="profile-header-card">
          <div className="profile-avatar-large">
            {user?.name?.charAt(0)?.toUpperCase() || "A"}
          </div>
          <div>
            <p className="profile-badge">AgroConnect Business Profile</p>
            <h1>{user?.name || "User"}</h1>
            <div className="profile-status-line">
              <span className="profile-role">{user?.role || "user"}</span>
              {user?.role !== "admin" && <VerificationBadge status={status} />}
            </div>
          </div>
        </section>

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        <div className="profile-phase-grid">
          <form className="profile-edit-card" onSubmit={saveProfile}>
            <div className="admin-section-head">
              <div>
                <p>Account Details</p>
                <h2>Profile Information</h2>
              </div>
            </div>
            <div className="grid two">
              <div>
                <label>Full Name</label>
                <input name="name" value={form.name} onChange={handleChange} required />
              </div>
              <div>
                <label>Email</label>
                <input value={user?.email || ""} disabled />
              </div>
              <div>
                <label>Phone</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  inputMode="numeric"
                  required
                />
              </div>
              <div>
                <label>Business/Farm Name</label>
                <input
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="Example: Priyanka Farms"
                />
              </div>
              <div>
                <label>Business Type</label>
                <input
                  name="businessType"
                  value={form.businessType}
                  onChange={handleChange}
                  placeholder="Farmer, FPO, wholesaler..."
                />
              </div>
              <div>
                <label>City</label>
                <input name="city" value={form.city} onChange={handleChange} />
              </div>
              <div>
                <label>State</label>
                <input name="state" value={form.state} onChange={handleChange} />
              </div>
              <div className="full-width">
                <label>Address</label>
                <textarea name="address" value={form.address} onChange={handleChange} />
              </div>
            </div>
            <button className="btn full" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </form>

          {user?.role !== "admin" && (
            <section className="kyc-card">
              <div className="admin-section-head">
                <div>
                  <p>Identity Verification</p>
                  <h2>KYC Verification</h2>
                </div>
                <VerificationBadge status={status} />
              </div>

              {verification?.verification_note && (
                <div className="verification-note">
                  <strong>Admin note</strong>
                  <p>{verification.verification_note}</p>
                </div>
              )}

              <p className="kyc-helper">
                Upload one clear identity or business document. It remains
                private and can only be reviewed by an authenticated admin.
              </p>

              <form onSubmit={submitKyc}>
                <label>Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  required
                >
                  <option value="">Select document</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="pan">PAN</option>
                  <option value="farmer_id">Farmer ID</option>
                  <option value="gst">GST Certificate</option>
                  <option value="business_registration">Business Registration</option>
                </select>

                <label>Document File</label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setDocument(e.target.files?.[0] || null)}
                  required
                />
                <small className="form-help">JPG, PNG or PDF; maximum 8 MB.</small>

                <button className="btn full" disabled={uploading}>
                  {uploading
                    ? "Submitting..."
                    : status === "unsubmitted"
                      ? "Submit KYC"
                      : "Resubmit KYC"}
                </button>
              </form>
            </section>
          )}
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
    </main>
  );
}
