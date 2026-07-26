import { useEffect, useState } from "react";
import api from "../api/api";
import { Link } from "../router";
import { useAuth } from "../context/AuthContext";

const today = () => new Date().toISOString().slice(0, 10);
const emptyCentre = {
  name: "",
  operator_name: "",
  phone: "",
  city: "",
  state: "Bihar",
  address: "",
  service_type: "full_service",
  daily_capacity: "",
  capacity_unit: "ton",
  fee_per_unit: "",
};
const emptyBooking = {
  quantity: "",
  scheduled_date: today(),
  requested_service: "full_service",
  product_id: "",
  order_id: "",
  notes: "",
};

export default function CollectionCentres() {
  const { user } = useAuth();
  const [centres, setCentres] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [centreForm, setCentreForm] = useState(emptyCentre);
  const [bookingForm, setBookingForm] = useState(emptyBooking);
  const [selected, setSelected] = useState(null);
  const [showCentreForm, setShowCentreForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [centreRes, bookingRes] = await Promise.all([
        api.get("/collection-centres"),
        api.get("/collection-centres/bookings"),
      ]);
      setCentres(centreRes.data.centres || []);
      setBookings(bookingRes.data.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load collection centres");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createCentre = async (event) => {
    event.preventDefault();
    try {
      setAction("centre");
      const response = await api.post("/collection-centres", centreForm);
      setMessage(response.data.message);
      setCentreForm(emptyCentre);
      setShowCentreForm(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create centre");
    } finally {
      setAction("");
    }
  };

  const createBooking = async (event) => {
    event.preventDefault();
    try {
      setAction(`book-${selected.id}`);
      const response = await api.post(
        `/collection-centres/${selected.id}/bookings`,
        bookingForm
      );
      setMessage(response.data.message);
      setBookingForm(emptyBooking);
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to request slot");
    } finally {
      setAction("");
    }
  };

  const toggleCentre = async (centre) => {
    try {
      setAction(`centre-${centre.id}`);
      const response = await api.patch(`/collection-centres/${centre.id}`, {
        status: centre.status === "active" ? "inactive" : "active",
      });
      setMessage(response.data.message);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update centre");
    } finally {
      setAction("");
    }
  };

  const updateBooking = async (id, status) => {
    try {
      setAction(`booking-${id}`);
      const response = await api.patch(
        `/collection-centres/bookings/${id}/status`,
        { status }
      );
      setMessage(response.data.message);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update booking");
    } finally {
      setAction("");
    }
  };

  return (
    <main className="phase-four-page">
      <div className="phase-four-container">
        <section className="phase-four-page-head">
          <div>
            <p className="phase-four-kicker">🏪 Last-mile rural infrastructure</p>
            <h1>Collection Centres</h1>
            <p>Aggregate, quality-check and dispatch produce through local hubs.</p>
          </div>
          <div className="table-actions">
            {user?.role === "admin" && (
              <button className="btn" onClick={() => setShowCentreForm(!showCentreForm)}>
                {showCentreForm ? "Close Form" : "Add Centre"}
              </button>
            )}
            <Link className="btn secondary" to="/expansion">Expansion Hub</Link>
          </div>
        </section>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        {showCentreForm && user?.role === "admin" && (
          <form className="phase-four-form" onSubmit={createCentre}>
            <div className="phase-four-section-title"><div><span>Admin operations</span><h2>Add collection centre</h2></div></div>
            <div className="grid three">
              <div><label>Centre Name</label><input value={centreForm.name} onChange={(e) => setCentreForm({ ...centreForm, name: e.target.value })} required /></div>
              <div><label>Operator</label><input value={centreForm.operator_name} onChange={(e) => setCentreForm({ ...centreForm, operator_name: e.target.value })} required /></div>
              <div><label>Phone</label><input value={centreForm.phone} onChange={(e) => setCentreForm({ ...centreForm, phone: e.target.value })} /></div>
              <div><label>City</label><input value={centreForm.city} onChange={(e) => setCentreForm({ ...centreForm, city: e.target.value })} required /></div>
              <div><label>State</label><input value={centreForm.state} onChange={(e) => setCentreForm({ ...centreForm, state: e.target.value })} required /></div>
              <div><label>Service</label><select value={centreForm.service_type} onChange={(e) => setCentreForm({ ...centreForm, service_type: e.target.value })}><option value="full_service">Full service</option><option value="aggregation">Aggregation</option><option value="quality_check">Quality check</option><option value="dispatch">Dispatch</option></select></div>
              <div><label>Daily Capacity</label><input type="number" min="0.01" step="0.01" value={centreForm.daily_capacity} onChange={(e) => setCentreForm({ ...centreForm, daily_capacity: e.target.value })} required /></div>
              <div><label>Capacity Unit</label><select value={centreForm.capacity_unit} onChange={(e) => setCentreForm({ ...centreForm, capacity_unit: e.target.value })}><option value="kg">kg</option><option value="quintal">quintal</option><option value="ton">ton</option></select></div>
              <div><label>Fee / unit (₹)</label><input type="number" min="0" step="0.01" value={centreForm.fee_per_unit} onChange={(e) => setCentreForm({ ...centreForm, fee_per_unit: e.target.value })} required /></div>
              <div className="full-width"><label>Address</label><textarea value={centreForm.address} onChange={(e) => setCentreForm({ ...centreForm, address: e.target.value })} required /></div>
            </div>
            <button className="btn" disabled={action === "centre"}>Add Collection Centre</button>
          </form>
        )}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading collection network...</p></div>
        ) : (
          <>
            <section className="collection-grid">
              {centres.length ? centres.map((centre) => (
                <article className="collection-card" key={centre.id}>
                  <div className="collection-map-pin">📍</div>
                  <div className="equipment-card-top"><span className="phase-four-eyebrow">Centre #{centre.id}</span><span className={`deal-status ${centre.status}`}>{centre.status}</span></div>
                  <h2>{centre.name}</h2>
                  <p>{centre.address}</p>
                  <div className="phase-four-meta">
                    <span>🏙️ {centre.city}, {centre.state}</span>
                    <span>⚙️ {centre.service_type.replaceAll("_", " ")}</span>
                    <span>📦 {centre.daily_capacity} {centre.capacity_unit}/day</span>
                    <span>💰 ₹{centre.fee_per_unit}/{centre.capacity_unit}</span>
                    <span>👤 {centre.operator_name} · {centre.phone || "No phone"}</span>
                  </div>
                  {user?.role === "admin" ? (
                    <button className="btn small secondary" disabled={action === `centre-${centre.id}`} onClick={() => toggleCentre(centre)}>
                      Mark {centre.status === "active" ? "Inactive" : "Active"}
                    </button>
                  ) : (
                    <button className="btn small" onClick={() => { setSelected(centre); setBookingForm({ ...emptyBooking, requested_service: centre.service_type }); }}>Request Slot</button>
                  )}
                  {selected?.id === centre.id && (
                    <form className="inline-booking-form" onSubmit={createBooking}>
                      <div className="grid two">
                        <div><label>Quantity ({centre.capacity_unit})</label><input type="number" min="0.01" max={centre.daily_capacity} step="0.01" value={bookingForm.quantity} onChange={(e) => setBookingForm({ ...bookingForm, quantity: e.target.value })} required /></div>
                        <div><label>Schedule Date</label><input type="date" min={today()} value={bookingForm.scheduled_date} onChange={(e) => setBookingForm({ ...bookingForm, scheduled_date: e.target.value })} required /></div>
                        <div><label>Service</label><select value={bookingForm.requested_service} onChange={(e) => setBookingForm({ ...bookingForm, requested_service: e.target.value })} disabled={centre.service_type !== "full_service"}><option value="full_service">Full service</option><option value="aggregation">Aggregation</option><option value="quality_check">Quality check</option><option value="dispatch">Dispatch</option></select></div>
                        <div><label>Product ID</label><input type="number" min="1" value={bookingForm.product_id} onChange={(e) => setBookingForm({ ...bookingForm, product_id: e.target.value })} placeholder="Optional, farmer-owned" /></div>
                        <div><label>Order ID</label><input type="number" min="1" value={bookingForm.order_id} onChange={(e) => setBookingForm({ ...bookingForm, order_id: e.target.value })} placeholder="Optional" /></div>
                        <div><label>Notes</label><input value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} /></div>
                      </div>
                      <p className="order-estimate">Estimated service fee: ₹{(Number(bookingForm.quantity || 0) * Number(centre.fee_per_unit)).toLocaleString()}</p>
                      <div className="table-actions"><button className="btn small" disabled={action === `book-${centre.id}`}>Submit Request</button><button type="button" className="btn small secondary" onClick={() => setSelected(null)}>Cancel</button></div>
                    </form>
                  )}
                </article>
              )) : <div className="phase-four-empty">No collection centres configured yet.</div>}
            </section>

            <section className="phase-four-panel">
              <div className="phase-four-section-title"><div><span>{user?.role === "admin" ? "Approval queue" : "My slots"}</span><h2>Collection Bookings</h2></div><b>{bookings.length} records</b></div>
              <div className="phase-four-table-wrap">
                <table>
                  <thead><tr><th>Booking</th><th>Customer / Centre</th><th>Schedule</th><th>Quantity & Fee</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {bookings.length ? bookings.map((item) => (
                      <tr key={item.id}>
                        <td><strong>#{item.id} {item.requested_service.replaceAll("_", " ")}</strong><small>{item.product_name || (item.order_id ? `Order #${item.order_id}` : "General collection")}</small></td>
                        <td>{user?.role === "admin" ? item.customer_name : item.centre_name}<small>{user?.role === "admin" ? item.customer_role : `${item.city}, ${item.state}`}</small></td>
                        <td>{String(item.scheduled_date).slice(0, 10)}</td>
                        <td>{item.quantity} {item.capacity_unit}<small>₹{Number(item.total_fee).toLocaleString()}</small></td>
                        <td><span className={`deal-status ${item.status}`}>{item.status}</span></td>
                        <td><div className="table-actions">
                          {user?.role === "admin" && item.status === "requested" && <><button className="btn small" onClick={() => updateBooking(item.id, "confirmed")}>Confirm</button><button className="btn small danger" onClick={() => updateBooking(item.id, "rejected")}>Reject</button></>}
                          {user?.role === "admin" && item.status === "confirmed" && <button className="btn small" onClick={() => updateBooking(item.id, "received")}>Mark Received</button>}
                          {user?.role === "admin" && item.status === "received" && <button className="btn small" onClick={() => updateBooking(item.id, "completed")}>Complete</button>}
                          {user?.role !== "admin" && ["requested", "confirmed"].includes(item.status) && <button className="btn small danger" onClick={() => updateBooking(item.id, "cancelled")}>Cancel</button>}
                        </div></td>
                      </tr>
                    )) : <tr><td colSpan="6" className="empty-row">No collection bookings found.</td></tr>}
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
