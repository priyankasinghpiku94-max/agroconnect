import { useEffect, useState } from "react";
import api from "../api/api";
import { Link } from "../router";
import { useAuth } from "../context/AuthContext";

const emptyInput = {
  name: "",
  category: "seed",
  brand: "",
  description: "",
  certification: "",
  price: "",
  stock_quantity: "",
  unit: "kg",
  min_order_quantity: 1,
  city: "",
  state: "Bihar",
};
const emptyOrder = { quantity: "", delivery_address: "", message: "" };

export default function AgriInputs() {
  const { user } = useAuth();
  const [inputs, setInputs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyInput);
  const [orderForm, setOrderForm] = useState(emptyOrder);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [inputRes, orderRes] = await Promise.all([
        api.get("/inputs"),
        api.get("/inputs/orders"),
      ]);
      setInputs(inputRes.data.inputs || []);
      setOrders(orderRes.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load agriculture inputs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createListing = async (event) => {
    event.preventDefault();
    try {
      setAction("create");
      const response = await api.post("/inputs", form);
      setMessage(response.data.message);
      setForm({ ...emptyInput, city: user?.city || "" });
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to publish input");
    } finally {
      setAction("");
    }
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    try {
      setAction(`order-${selected.id}`);
      const response = await api.post(`/inputs/${selected.id}/orders`, orderForm);
      setMessage(response.data.message);
      setSelected(null);
      setOrderForm(emptyOrder);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to place input order");
    } finally {
      setAction("");
    }
  };

  const updateListing = async (item) => {
    try {
      setAction(`input-${item.id}`);
      const response = await api.patch(`/inputs/${item.id}`, {
        status: item.status === "active" ? "inactive" : "active",
      });
      setMessage(response.data.message);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update listing");
    } finally {
      setAction("");
    }
  };

  const updateOrder = async (id, status) => {
    try {
      setAction(`order-status-${id}`);
      const response = await api.patch(`/inputs/orders/${id}/status`, { status });
      setMessage(response.data.message);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update order");
    } finally {
      setAction("");
    }
  };

  return (
    <main className="phase-four-page">
      <div className="phase-four-container">
        <section className="phase-four-page-head">
          <div>
            <p className="phase-four-kicker">🌱 Verified supply network</p>
            <h1>Agriculture Inputs</h1>
            <p>Certified seeds, fertilizers, crop protection and tools.</p>
          </div>
          <div className="table-actions">
            {user?.role === "distributor" && (
              <button className="btn" onClick={() => setShowForm(!showForm)}>
                {showForm ? "Close Form" : "Sell Input"}
              </button>
            )}
            <Link className="btn secondary" to="/expansion">Expansion Hub</Link>
          </div>
        </section>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        {user?.role !== "admin" && user?.verification_status !== "verified" && (
          <div className="alert warning">Verified KYC is required for input transactions.</div>
        )}

        {showForm && user?.role === "distributor" && (
          <form className="phase-four-form" onSubmit={createListing}>
            <div className="phase-four-section-title"><div><span>Seller catalogue</span><h2>Add certified input</h2></div></div>
            <div className="grid three">
              <div><label>Product Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label>Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="seed">Seed</option><option value="fertilizer">Fertilizer</option><option value="pesticide">Pesticide</option><option value="bio_input">Bio input</option><option value="tools">Tools</option><option value="other">Other</option></select></div>
              <div><label>Brand</label><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
              <div><label>Price (₹)</label><input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></div>
              <div><label>Stock Quantity</label><input type="number" min="0.01" step="0.01" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} required /></div>
              <div><label>Unit</label><select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}><option value="kg">kg</option><option value="litre">litre</option><option value="packet">packet</option><option value="bag">bag</option><option value="piece">piece</option></select></div>
              <div><label>Minimum Order</label><input type="number" min="0.01" step="0.01" value={form.min_order_quantity} onChange={(e) => setForm({ ...form, min_order_quantity: e.target.value })} required /></div>
              <div><label>Certification</label><input value={form.certification} onChange={(e) => setForm({ ...form, certification: e.target.value })} /></div>
              <div><label>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></div>
              <div><label>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required /></div>
              <div className="full-width"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <button className="btn" disabled={action === "create"}>Publish Input</button>
          </form>
        )}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading verified inputs...</p></div>
        ) : (
          <>
            <section className="input-market-grid">
              {inputs.length ? inputs.map((item) => {
                const owner = Number(item.seller_id) === Number(user?.id);
                return (
                  <article className="input-market-card" key={item.id}>
                    <div className="input-market-badge">{item.category === "seed" ? "🌾" : item.category === "fertilizer" ? "🧪" : item.category === "tools" ? "🛠️" : "🌿"}</div>
                    <div className="equipment-card-top"><span className="phase-four-eyebrow">{item.category.replaceAll("_", " ")}</span><span className={`deal-status ${item.status}`}>{item.status}</span></div>
                    <h2>{item.name}</h2>
                    <p className="input-brand">{item.brand || "Independent supplier"} · {item.certification || "Seller declared"}</p>
                    <p>{item.description || "Verified agriculture input listing."}</p>
                    <div className="equipment-price"><strong>₹{Number(item.price).toLocaleString()}</strong><span>/{item.unit}</span></div>
                    <div className="phase-four-meta">
                      <span>📦 {item.available_quantity} {item.unit} available</span>
                      <span>🛍️ Min {item.min_order_quantity} {item.unit}</span>
                      <span>📍 {item.city}, {item.state}</span>
                      <span>🏪 {item.business_name || item.seller_name}</span>
                    </div>
                    <div className="table-actions">
                      {user?.role === "farmer" && (
                        <button className="btn small" onClick={() => { setSelected(item); setOrderForm({ ...emptyOrder, quantity: item.min_order_quantity, delivery_address: user?.address || "" }); }}>Order Now</button>
                      )}
                      {(owner || user?.role === "admin") && (
                        <button className="btn small secondary" disabled={action === `input-${item.id}`} onClick={() => updateListing(item)}>
                          Mark {item.status === "active" ? "Inactive" : "Active"}
                        </button>
                      )}
                    </div>
                    {selected?.id === item.id && (
                      <form className="inline-booking-form" onSubmit={placeOrder}>
                        <div className="grid two">
                          <div><label>Quantity ({item.unit})</label><input type="number" min={item.min_order_quantity} max={item.available_quantity} step="0.01" value={orderForm.quantity} onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })} required /></div>
                          <div><label>Delivery Address</label><input value={orderForm.delivery_address} onChange={(e) => setOrderForm({ ...orderForm, delivery_address: e.target.value })} required /></div>
                          <div className="full-width"><label>Message</label><textarea value={orderForm.message} onChange={(e) => setOrderForm({ ...orderForm, message: e.target.value })} /></div>
                        </div>
                        <p className="order-estimate">Estimated: ₹{(Number(orderForm.quantity || 0) * Number(item.price)).toLocaleString()}</p>
                        <div className="table-actions"><button className="btn small" disabled={action === `order-${item.id}`}>Place Order</button><button type="button" className="btn small secondary" onClick={() => setSelected(null)}>Cancel</button></div>
                      </form>
                    )}
                  </article>
                );
              }) : <div className="phase-four-empty">No agriculture inputs are listed yet.</div>}
            </section>

            <section className="phase-four-panel">
              <div className="phase-four-section-title"><div><span>{user?.role === "admin" ? "Platform activity" : "My activity"}</span><h2>Input Orders</h2></div><b>{orders.length} records</b></div>
              <div className="phase-four-table-wrap">
                <table>
                  <thead><tr><th>Order</th><th>Buyer / Seller</th><th>Quantity</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {orders.length ? orders.map((item) => (
                      <tr key={item.id}>
                        <td><strong>#{item.id} {item.input_name}</strong><small>{item.category}</small></td>
                        <td>{item.buyer_name}<small>Seller: {item.seller_name}</small></td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>₹{Number(item.total_amount).toLocaleString()}</td>
                        <td><span className={`deal-status ${item.status}`}>{item.status}</span></td>
                        <td><div className="table-actions">
                          {(user?.role === "distributor" || user?.role === "admin") && item.status === "pending" && <><button className="btn small" onClick={() => updateOrder(item.id, "accepted")}>Accept</button><button className="btn small danger" onClick={() => updateOrder(item.id, "rejected")}>Reject</button></>}
                          {(user?.role === "distributor" || user?.role === "admin") && item.status === "accepted" && <button className="btn small" onClick={() => updateOrder(item.id, "shipped")}>Ship</button>}
                          {(user?.role === "distributor" || user?.role === "admin") && item.status === "shipped" && <button className="btn small" onClick={() => updateOrder(item.id, "completed")}>Complete</button>}
                          {user?.role === "farmer" && item.status === "pending" && <button className="btn small danger" onClick={() => updateOrder(item.id, "cancelled")}>Cancel</button>}
                        </div></td>
                      </tr>
                    )) : <tr><td colSpan="6" className="empty-row">No input orders found.</td></tr>}
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
