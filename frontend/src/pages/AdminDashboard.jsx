import { useEffect, useState } from "react";
import api from "../api/api";
import VerificationBadge from "../components/VerificationBadge";

export default function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actionKey, setActionKey] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const [statsRes, usersRes, productsRes, ordersRes, verificationRes] =
        await Promise.all([
          api.get("/admin/stats"),
          api.get("/admin/users"),
          api.get("/admin/products"),
          api.get("/admin/orders"),
          api.get("/admin/verifications"),
        ]);

      setStats(statsRes.data.stats || {});
      setUsers(usersRes.data.users || []);
      setProducts(productsRes.data.products || []);
      setOrders(ordersRes.data.orders || []);
      setVerifications(verificationRes.data.verifications || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runAction = async (key, request, successMessage) => {
    try {
      setActionKey(key);
      setError("");
      setMessage("");
      await request();
      setMessage(successMessage);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Admin action failed");
    } finally {
      setActionKey("");
    }
  };

  const reviewVerification = (userId, status) => {
    let note = "";
    if (status === "rejected") {
      note = window.prompt("Enter the rejection reason:")?.trim() || "";
      if (!note) return;
    }

    runAction(
      `kyc-${userId}-${status}`,
      () => api.put(`/admin/verifications/${userId}`, { status, note }),
      status === "verified" ? "KYC approved successfully." : "KYC rejected."
    );
  };

  const downloadDocument = async (userId, documentType) => {
    try {
      setActionKey(`document-${userId}`);
      const response = await api.get(
        `/admin/verifications/${userId}/document`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(response.data);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = `${documentType || "kyc"}-${userId}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to download KYC document");
    } finally {
      setActionKey("");
    }
  };

  const toggleUser = (user) =>
    runAction(
      `user-status-${user.id}`,
      () =>
        api.patch(`/admin/users/${user.id}/status`, {
          is_active: !Boolean(user.is_active),
        }),
      user.is_active ? "User account deactivated." : "User account activated."
    );

  const deleteUser = (id) => {
    if (!window.confirm("Delete this user and all related records permanently?")) {
      return;
    }
    runAction(
      `delete-${id}`,
      () => api.delete(`/admin/users/${id}`),
      "User deleted successfully."
    );
  };

  return (
    <main className="admin-page">
      <div className="admin-container">
        <section className="admin-hero">
          <div>
            <p className="admin-badge">📊 Phase 1 Admin Control Panel</p>
            <h1>
              AgroConnect <span>Business Operations</span>
            </h1>
            <p>
              Review KYC, control account access, monitor verified listings and
              track order activity from one secure dashboard.
            </p>
          </div>
          <button className="admin-refresh-btn" onClick={fetchData}>
            Refresh Data
          </button>
        </section>

        {message && <div className="alert success admin-alert">{message}</div>}
        {error && <div className="alert error admin-alert">{error}</div>}

        {loading ? (
          <div className="admin-loading-card">
            <div className="loader"></div>
            <p>Loading dashboard data...</p>
          </div>
        ) : (
          <>
            <section className="admin-stats-grid phase-one-stats">
              <div className="admin-stat-card"><span>{stats.totalUsers || 0}</span><p>Total Users</p></div>
              <div className="admin-stat-card"><span>{stats.totalFarmers || 0}</span><p>Farmers</p></div>
              <div className="admin-stat-card"><span>{stats.totalDistributors || 0}</span><p>Distributors</p></div>
              <div className="admin-stat-card"><span>{stats.totalProducts || 0}</span><p>Products</p></div>
              <div className="admin-stat-card"><span>{stats.totalOrders || 0}</span><p>Orders</p></div>
              <div className="admin-stat-card pending-stat"><span>{stats.pendingVerifications || 0}</span><p>Pending KYC</p></div>
              <div className="admin-stat-card"><span>{stats.openDemands || 0}</span><p>Open Demands</p></div>
              <div className="admin-stat-card"><span>{stats.activeQuotations || 0}</span><p>Active Quotes</p></div>
            </section>

            <section className="premium-admin-section">
              <div className="admin-section-head">
                <div><p>Identity Review</p><h2>KYC Verification Queue</h2></div>
                <span>{verifications.length} Requests</span>
              </div>
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role / Business</th>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.length ? (
                      verifications.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.name}</strong><small className="admin-cell-note">{item.email}</small></td>
                          <td>{item.role}<small className="admin-cell-note">{item.business_name || "Business name not added"}</small></td>
                          <td>{String(item.document_type || "").replaceAll("_", " ")}</td>
                          <td><VerificationBadge status={item.verification_status} /></td>
                          <td>
                            <div className="table-actions phase-one-actions">
                              <button className="btn small secondary" onClick={() => downloadDocument(item.id, item.document_type)} disabled={actionKey === `document-${item.id}`}>Document</button>
                              {item.verification_status !== "verified" && (
                                <button className="btn small" onClick={() => reviewVerification(item.id, "verified")} disabled={actionKey.startsWith(`kyc-${item.id}`)}>Approve</button>
                              )}
                              {item.verification_status !== "rejected" && (
                                <button className="btn small danger" onClick={() => reviewVerification(item.id, "rejected")} disabled={actionKey.startsWith(`kyc-${item.id}`)}>Reject</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="empty-row">No KYC requests found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="premium-admin-section">
              <div className="admin-section-head">
                <div><p>Platform Accounts</p><h2>Users</h2></div>
                <span>{users.length} Records</span>
              </div>
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Location</th>
                      <th>Verification</th>
                      <th>Account</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.name}</strong><small className="admin-cell-note">{item.email}<br />{item.phone}</small></td>
                        <td><span className={`role-badge ${item.role}`}>{item.role}</span></td>
                        <td>{item.district || "N/A"}{item.state ? `, ${item.state}` : ""}</td>
                        <td>{item.role === "admin" ? "System admin" : <VerificationBadge status={item.verification_status} />}</td>
                        <td><span className={`account-status ${item.is_active ? "active" : "inactive"}`}>{item.is_active ? "Active" : "Inactive"}</span></td>
                        <td>
                          {item.role === "admin" ? (
                            <span className="admin-safe-text">Protected</span>
                          ) : (
                            <div className="table-actions phase-one-actions">
                              <button className="btn small secondary" onClick={() => toggleUser(item)} disabled={actionKey === `user-status-${item.id}`}>{item.is_active ? "Deactivate" : "Activate"}</button>
                              <button className="btn small danger" onClick={() => deleteUser(item.id)} disabled={actionKey === `delete-${item.id}`}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="premium-admin-section">
              <div className="admin-section-head">
                <div><p>Verified Supply</p><h2>Products</h2></div>
                <span>{products.length} Records</span>
              </div>
              <div className="admin-table-wrap">
                <table>
                  <thead><tr><th>Crop</th><th>Farmer</th><th>Quantity</th><th>Price</th><th>Status</th></tr></thead>
                  <tbody>
                    {products.length ? products.map((item) => (
                      <tr key={item.id}>
                        <td>{item.crop_name}</td>
                        <td>{item.farmer_name || "N/A"}</td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>₹{item.price_per_unit}</td>
                        <td><span className="status-badge">{String(item.status).replaceAll("_", " ")}</span></td>
                      </tr>
                    )) : <tr><td colSpan="5" className="empty-row">No products found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="premium-admin-section">
              <div className="admin-section-head">
                <div><p>Order Monitoring</p><h2>Orders</h2></div>
                <span>{orders.length} Records</span>
              </div>
              <div className="admin-table-wrap">
                <table>
                  <thead><tr><th>Crop</th><th>Farmer</th><th>Distributor</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>
                    {orders.length ? orders.map((item) => (
                      <tr key={item.id}>
                        <td>{item.crop_name || "N/A"}</td>
                        <td>{item.farmer_name || "N/A"}</td>
                        <td>{item.distributor_name || "N/A"}</td>
                        <td>₹{item.total_price || 0}</td>
                        <td><span className="status-badge order">{item.status}</span></td>
                      </tr>
                    )) : <tr><td colSpan="5" className="empty-row">No orders found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
