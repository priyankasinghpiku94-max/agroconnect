import { useEffect, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function MyOrders() {
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/orders/my/list");
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          "Failed to load orders. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      setUpdatingId(id);
      setError("");

      await api.put(`/orders/${id}/status`, { status });
      fetchOrders();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to update order status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="orders-page">
      <div className="orders-container">
        <section className="orders-hero">
          <div>
            <p className="orders-badge">📦 Order Management</p>

            <h1>
              My <span>Orders</span>
            </h1>

            <p>
              Track order requests, check crop details, monitor payment amount
              and update order status from one clean dashboard.
            </p>
          </div>

          <div className="orders-count-card">
            <h3>{orders.length}</h3>
            <p>Total Orders</p>
          </div>
        </section>

        {error && <div className="alert error orders-alert">{error}</div>}

        {loading ? (
          <div className="orders-loading">
            <div className="loader"></div>
            <p>Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="orders-empty-card">
            <div className="empty-icon">🌱</div>
            <h2>No Orders Found</h2>
            <p>
              Your order records will appear here once any distributor places an
              order or request.
            </p>
          </div>
        ) : (
          <section className="orders-section">
            <div className="orders-section-head">
              <div>
                <p>Order Records</p>
                <h2>Recent Orders</h2>
              </div>

              <span>{orders.length} Records</span>
            </div>

            <div className="orders-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th>Quantity</th>
                    <th>Total</th>
                    <th>
                      {user?.role === "farmer" ? "Distributor" : "Farmer"}
                    </th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <div className="order-crop-cell">
                          <div className="order-crop-icon">🌾</div>
                          <div>
                            <strong>{order.crop_name || "N/A"}</strong>
                            <p>Order ID: #{order.id}</p>
                          </div>
                        </div>
                      </td>

                      <td>
                        {order.quantity || 0} {order.unit || ""}
                      </td>

                      <td>
                        <strong className="order-price">
                          ₹{order.total_price || 0}
                        </strong>
                      </td>

                      <td>
                        {user?.role === "farmer"
                          ? order.distributor_name || "N/A"
                          : order.farmer_name || "N/A"}
                      </td>

                      <td>
                        <span className={`order-status-badge ${order.status}`}>
                          {order.status || "pending"}
                        </span>
                      </td>

                      <td>
                        {user?.role === "farmer" ? (
                          <div className="table-actions">
                            {order.status === "pending" && (
                              <button
                                className="btn small"
                                onClick={() => updateStatus(order.id, "accepted")}
                                disabled={updatingId === order.id}
                              >
                                Accept
                              </button>
                            )}

                            {order.status === "accepted" && (
                              <button
                                className="btn small secondary"
                                onClick={() => updateStatus(order.id, "completed")}
                                disabled={updatingId === order.id}
                              >
                                Complete
                              </button>
                            )}

                            {["pending", "accepted"].includes(order.status) && (
                              <button
                                className="btn small danger"
                                onClick={() => updateStatus(order.id, "rejected")}
                                disabled={updatingId === order.id}
                              >
                                Reject
                              </button>
                            )}

                            {["completed", "rejected"].includes(order.status) && (
                              <span className="view-text">No action required</span>
                            )}
                          </div>
                        ) : (
                          <span className="view-text">View Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
