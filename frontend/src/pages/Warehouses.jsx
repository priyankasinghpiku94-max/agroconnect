import { useEffect, useState } from "react";
import { Link } from "../router";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const emptyWarehouse = {
  name: "",
  operator_name: "",
  phone: "",
  city: "",
  state: "Bihar",
  address: "",
  total_capacity: "",
  capacity_unit: "ton",
  rate_per_unit_day: "",
  min_booking_days: 1,
};

const emptyBooking = {
  quantity: "",
  start_date: "",
  end_date: "",
  order_id: "",
  notes: "",
};

export default function Warehouses() {
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouse);
  const [bookingWarehouse, setBookingWarehouse] = useState(null);
  const [bookingForm, setBookingForm] = useState(emptyBooking);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [warehouseRes, bookingRes] = await Promise.all([
        api.get("/warehouses"),
        api.get("/warehouses/bookings"),
      ]);
      setWarehouses(warehouseRes.data.warehouses || []);
      setBookings(bookingRes.data.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load warehouse workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addWarehouse = async (event) => {
    event.preventDefault();
    try {
      setAction("create-warehouse");
      await api.post("/warehouses", warehouseForm);
      setWarehouseForm(emptyWarehouse);
      setMessage("Warehouse added successfully.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add warehouse");
    } finally {
      setAction("");
    }
  };

  const toggleWarehouse = async (warehouse) => {
    try {
      setAction(`warehouse-${warehouse.id}`);
      await api.patch(`/warehouses/${warehouse.id}`, {
        status: warehouse.status === "active" ? "inactive" : "active",
        rate_per_unit_day: warehouse.rate_per_unit_day,
      });
      setMessage("Warehouse status updated.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update warehouse");
    } finally {
      setAction("");
    }
  };

  const openBooking = (warehouse) => {
    setBookingWarehouse(warehouse);
    setBookingForm(emptyBooking);
    setError("");
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    try {
      setAction(`book-${bookingWarehouse.id}`);
      await api.post(`/warehouses/${bookingWarehouse.id}/bookings`, bookingForm);
      setBookingWarehouse(null);
      setBookingForm(emptyBooking);
      setMessage("Warehouse booking request submitted.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit booking");
    } finally {
      setAction("");
    }
  };

  const updateBooking = async (id, status) => {
    try {
      setAction(`${status}-${id}`);
      await api.patch(`/warehouses/bookings/${id}/status`, { status });
      setMessage(`Booking updated to ${status}.`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update booking");
    } finally {
      setAction("");
    }
  };

  return (
    <main className="phase-three-page">
      <div className="phase-three-container">
        <section className="phase-three-hero compact">
          <div>
            <p className="phase-three-kicker">🏬 Verified Storage Network</p>
            <h1>Warehouse <span>Booking</span></h1>
            <p>
              {user?.role === "admin"
                ? "Manage storage partners, capacity and booking approvals."
                : "Reserve crop storage with transparent capacity and estimated pricing."}
            </p>
          </div>
          <Link className="btn secondary" to="/business">Business Hub</Link>
        </section>

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        {user?.role === "admin" && (
          <form className="phase-three-panel warehouse-create-form" onSubmit={addWarehouse}>
            <div className="phase-three-section-head"><div><p>Storage Network</p><h2>Add Warehouse</h2></div></div>
            <div className="grid three">
              <div><label>Warehouse Name</label><input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} required /></div>
              <div><label>Operator Name</label><input value={warehouseForm.operator_name} onChange={(e) => setWarehouseForm({ ...warehouseForm, operator_name: e.target.value })} required /></div>
              <div><label>Phone</label><input value={warehouseForm.phone} onChange={(e) => setWarehouseForm({ ...warehouseForm, phone: e.target.value })} /></div>
              <div><label>City</label><input value={warehouseForm.city} onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })} required /></div>
              <div><label>State</label><input value={warehouseForm.state} onChange={(e) => setWarehouseForm({ ...warehouseForm, state: e.target.value })} required /></div>
              <div><label>Total Capacity</label><input type="number" min="0.01" step="0.01" value={warehouseForm.total_capacity} onChange={(e) => setWarehouseForm({ ...warehouseForm, total_capacity: e.target.value })} required /></div>
              <div><label>Capacity Unit</label><select value={warehouseForm.capacity_unit} onChange={(e) => setWarehouseForm({ ...warehouseForm, capacity_unit: e.target.value })}><option value="kg">kg</option><option value="quintal">quintal</option><option value="ton">ton</option></select></div>
              <div><label>Rate / Unit / Day</label><input type="number" min="0.01" step="0.01" value={warehouseForm.rate_per_unit_day} onChange={(e) => setWarehouseForm({ ...warehouseForm, rate_per_unit_day: e.target.value })} required /></div>
              <div><label>Minimum Days</label><input type="number" min="1" max="365" value={warehouseForm.min_booking_days} onChange={(e) => setWarehouseForm({ ...warehouseForm, min_booking_days: e.target.value })} required /></div>
              <div className="full-width"><label>Full Address</label><input value={warehouseForm.address} onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })} required /></div>
            </div>
            <button className="btn" disabled={action === "create-warehouse"}>Add Verified Warehouse</button>
          </form>
        )}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading warehouse network...</p></div>
        ) : (
          <>
            <section className="warehouse-grid">
              {warehouses.map((warehouse) => {
                const used = Number(warehouse.total_capacity) - Number(warehouse.available_capacity);
                const utilization = Number(warehouse.total_capacity)
                  ? Math.round((used / Number(warehouse.total_capacity)) * 100)
                  : 0;
                return (
                  <article className="warehouse-card" key={warehouse.id}>
                    <div className="warehouse-card-head">
                      <div><span className="phase-three-eyebrow">Storage #{warehouse.id}</span><h2>{warehouse.name}</h2><p>📍 {warehouse.city}, {warehouse.state}</p></div>
                      <span className={`deal-status ${warehouse.status}`}>{warehouse.status}</span>
                    </div>
                    <p className="warehouse-address">{warehouse.address}</p>
                    <div className="capacity-row"><span style={{ width: `${Math.min(100, utilization)}%` }}></span></div>
                    <div className="warehouse-metrics">
                      <div><span>Available</span><strong>{warehouse.available_capacity} {warehouse.capacity_unit}</strong></div>
                      <div><span>Utilized</span><strong>{utilization}%</strong></div>
                      <div><span>Rate</span><strong>₹{warehouse.rate_per_unit_day}/{warehouse.capacity_unit}/day</strong></div>
                      <div><span>Minimum</span><strong>{warehouse.min_booking_days} days</strong></div>
                    </div>
                    <p className="warehouse-operator">Managed by {warehouse.operator_name} · {warehouse.phone || "phone unavailable"}</p>
                    {user?.role === "admin" ? (
                      <button className="btn small secondary" disabled={action === `warehouse-${warehouse.id}`} onClick={() => toggleWarehouse(warehouse)}>
                        Mark {warehouse.status === "active" ? "Inactive" : "Active"}
                      </button>
                    ) : (
                      <button className="btn small" onClick={() => openBooking(warehouse)}>Request Storage</button>
                    )}

                    {bookingWarehouse?.id === warehouse.id && (
                      <form className="warehouse-booking-form" onSubmit={submitBooking}>
                        <div className="grid two">
                          <div><label>Quantity ({warehouse.capacity_unit})</label><input type="number" min="0.01" max={warehouse.available_capacity} step="0.01" value={bookingForm.quantity} onChange={(e) => setBookingForm({ ...bookingForm, quantity: e.target.value })} required /></div>
                          <div><label>Related Order ID</label><input type="number" min="1" value={bookingForm.order_id} onChange={(e) => setBookingForm({ ...bookingForm, order_id: e.target.value })} placeholder="Optional" /></div>
                          <div><label>Start Date</label><input type="date" min={new Date().toISOString().slice(0, 10)} value={bookingForm.start_date} onChange={(e) => setBookingForm({ ...bookingForm, start_date: e.target.value })} required /></div>
                          <div><label>End Date</label><input type="date" min={bookingForm.start_date || new Date().toISOString().slice(0, 10)} value={bookingForm.end_date} onChange={(e) => setBookingForm({ ...bookingForm, end_date: e.target.value })} required /></div>
                          <div className="full-width"><label>Storage Notes</label><textarea value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} /></div>
                        </div>
                        <div className="table-actions">
                          <button className="btn small" disabled={action === `book-${warehouse.id}`}>Submit Request</button>
                          <button type="button" className="btn small secondary" onClick={() => setBookingWarehouse(null)}>Cancel</button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="phase-three-panel">
              <div className="phase-three-section-head">
                <div><p>{user?.role === "admin" ? "Approval Queue" : "My Storage"}</p><h2>Warehouse Bookings</h2></div>
                <span>{bookings.length} records</span>
              </div>
              <div className="phase-three-table-wrap">
                <table>
                  <thead><tr><th>Booking</th><th>{user?.role === "admin" ? "Customer" : "Warehouse"}</th><th>Capacity</th><th>Period</th><th>Estimated Total</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {bookings.length ? bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td><strong>#{booking.id}</strong><small>{booking.order_id ? `Order #${booking.order_id}` : "No linked order"}</small></td>
                        <td>{user?.role === "admin" ? <><strong>{booking.customer_name}</strong><small>{booking.customer_role}</small></> : <><strong>{booking.warehouse_name}</strong><small>{booking.city}, {booking.state}</small></>}</td>
                        <td>{booking.quantity} {booking.capacity_unit}</td>
                        <td>{String(booking.start_date).slice(0, 10)} to {String(booking.end_date).slice(0, 10)}<small>{booking.booking_days} days</small></td>
                        <td>₹{Number(booking.total_amount).toLocaleString()}</td>
                        <td><span className={`deal-status ${booking.status}`}>{booking.status}</span></td>
                        <td>
                          <div className="table-actions">
                            {user?.role === "admin" && booking.status === "requested" && <>
                              <button className="btn small" onClick={() => updateBooking(booking.id, "approved")}>Approve</button>
                              <button className="btn small danger" onClick={() => updateBooking(booking.id, "rejected")}>Reject</button>
                            </>}
                            {user?.role === "admin" && booking.status === "approved" && <button className="btn small secondary" onClick={() => updateBooking(booking.id, "completed")}>Complete</button>}
                            {user?.role !== "admin" && ["requested", "approved"].includes(booking.status) && <button className="btn small danger" onClick={() => updateBooking(booking.id, "cancelled")}>Cancel</button>}
                            {!((user?.role === "admin" && ["requested", "approved"].includes(booking.status)) || (user?.role !== "admin" && ["requested", "approved"].includes(booking.status))) && "—"}
                          </div>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="7" className="empty-row">No warehouse bookings found.</td></tr>}
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
