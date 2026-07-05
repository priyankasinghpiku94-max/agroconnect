import { useEffect, useState } from "react";
import api from "../api/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [statsRes, usersRes, productsRes, ordersRes] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/users"),
        api.get("/admin/products"),
        api.get("/admin/orders"),
      ]);

      setStats(statsRes.data.stats || {});
      setUsers(usersRes.data.users || []);
      setProducts(productsRes.data.products || []);
      setOrders(ordersRes.data.orders || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load admin dashboard data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const deleteUser = async (id) => {
    const confirmDelete = window.confirm("Delete this user?");
    if (!confirmDelete) return;

    try {
      setDeleteLoadingId(id);
      await api.delete(`/admin/users/${id}`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user");
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <main className="admin-page">
      <div className="admin-container">
        <section className="admin-hero">
          <div>
            <p className="admin-badge">📊 Admin Control Panel</p>

            <h1>
              AgroConnect <span>Admin Dashboard</span>
            </h1>

            <p>
              Manage farmers, distributors, crop listings, orders and platform
              activity from one centralized dashboard.
            </p>
          </div>

          <button className="admin-refresh-btn" onClick={fetchData}>
            Refresh Data
          </button>
        </section>

        {error && <div className="alert error admin-alert">{error}</div>}

        {loading ? (
          <div className="admin-loading-card">
            <div className="loader"></div>
            <p>Loading dashboard data...</p>
          </div>
        ) : (
          <>
            <section className="admin-stats-grid">
              <div className="admin-stat-card">
                <span>{stats?.totalUsers || 0}</span>
                <p>Total Users</p>
              </div>

              <div className="admin-stat-card">
                <span>{stats?.totalFarmers || 0}</span>
                <p>Farmers</p>
              </div>

              <div className="admin-stat-card">
                <span>{stats?.totalDistributors || 0}</span>
                <p>Distributors</p>
              </div>

              <div className="admin-stat-card">
                <span>{stats?.totalProducts || 0}</span>
                <p>Products</p>
              </div>

              <div className="admin-stat-card">
                <span>{stats?.totalOrders || 0}</span>
                <p>Orders</p>
              </div>
            </section>

            <section className="premium-admin-section">
              <div className="admin-section-head">
                <div>
                  <p>Platform Users</p>
                  <h2>Users</h2>
                </div>

                <span>{users.length} Records</span>
              </div>

              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>Location</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.length > 0 ? (
                      users.map((u) => (
                        <tr key={u.id}>
                          <td>{u.name || "N/A"}</td>
                          <td>{u.email || "N/A"}</td>
                          <td>{u.phone || "N/A"}</td>
                          <td>
                            <span className={`role-badge ${u.role}`}>
                              {u.role || "user"}
                            </span>
                          </td>
                          <td>
                            {u.district || "N/A"}
                            {u.state ? `, ${u.state}` : ""}
                          </td>
                          <td>
                            {u.role !== "admin" ? (
                              <button
                                className="btn small danger"
                                onClick={() => deleteUser(u.id)}
                                disabled={deleteLoadingId === u.id}
                              >
                                {deleteLoadingId === u.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            ) : (
                              <span className="admin-safe-text">
                                Protected
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="empty-row">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="premium-admin-section">
              <div className="admin-section-head">
                <div>
                  <p>Crop Listings</p>
                  <h2>Products</h2>
                </div>

                <span>{products.length} Records</span>
              </div>

              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Crop</th>
                      <th>Farmer</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.length > 0 ? (
                      products.map((p) => (
                        <tr key={p.id}>
                          <td>{p.crop_name || "N/A"}</td>
                          <td>{p.farmer_name || "N/A"}</td>
                          <td>
                            {p.quantity || 0} {p.unit || ""}
                          </td>
                          <td>₹{p.price_per_unit || 0}</td>
                          <td>
                            <span className="status-badge">
                              {p.status || "active"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty-row">
                          No products found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="premium-admin-section">
              <div className="admin-section-head">
                <div>
                  <p>Order Management</p>
                  <h2>Orders</h2>
                </div>

                <span>{orders.length} Records</span>
              </div>

              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Crop</th>
                      <th>Farmer</th>
                      <th>Distributor</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.length > 0 ? (
                      orders.map((o) => (
                        <tr key={o.id}>
                          <td>{o.crop_name || "N/A"}</td>
                          <td>{o.farmer_name || "N/A"}</td>
                          <td>{o.distributor_name || "N/A"}</td>
                          <td>₹{o.total_price || 0}</td>
                          <td>
                            <span className="status-badge order">
                              {o.status || "pending"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty-row">
                          No orders found.
                        </td>
                      </tr>
                    )}
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