import { useEffect, useState } from "react";
import api from "../api/api";
import { Link } from "../router";
import { useAuth } from "../context/AuthContext";

const today = () => new Date().toISOString().slice(0, 10);
const emptyListing = {
  name: "",
  category: "tractor",
  description: "",
  city: "",
  state: "Bihar",
  rate_per_day: "",
  security_deposit: 0,
  total_units: 1,
  available_from: today(),
  available_until: "",
};
const emptyBooking = {
  start_date: today(),
  end_date: "",
  units: 1,
  delivery_address: "",
  notes: "",
};

export default function EquipmentRental() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [listing, setListing] = useState(emptyListing);
  const [booking, setBooking] = useState(emptyBooking);
  const [bookingItem, setBookingItem] = useState(null);
  const [showListing, setShowListing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [listingRes, bookingRes] = await Promise.all([
        api.get("/equipment"),
        api.get("/equipment/bookings"),
      ]);
      setEquipment(listingRes.data.equipment || []);
      setBookings(bookingRes.data.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load equipment rental");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const submitListing = async (event) => {
    event.preventDefault();
    try {
      setAction("listing");
      setError("");
      const response = await api.post("/equipment", listing);
      setMessage(response.data.message);
      setListing({ ...emptyListing, city: user?.city || "" });
      setShowListing(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to publish equipment");
    } finally {
      setAction("");
    }
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    try {
      setAction(`book-${bookingItem.id}`);
      setError("");
      const response = await api.post(
        `/equipment/${bookingItem.id}/bookings`,
        booking
      );
      setMessage(response.data.message);
      setBookingItem(null);
      setBooking(emptyBooking);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to request rental");
    } finally {
      setAction("");
    }
  };

  const updateListing = async (item, status) => {
    try {
      setAction(`equipment-${item.id}`);
      const response = await api.patch(`/equipment/${item.id}`, { status });
      setMessage(response.data.message);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update equipment");
    } finally {
      setAction("");
    }
  };

  const updateBooking = async (id, status) => {
    try {
      setAction(`booking-${id}`);
      const response = await api.patch(`/equipment/bookings/${id}/status`, {
        status,
      });
      setMessage(response.data.message);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update rental");
    } finally {
      setAction("");
    }
  };

  const canManage = (item) =>
    user?.role === "admin" || Number(item.owner_id) === Number(user?.id);

  return (
    <main className="phase-four-page">
      <div className="phase-four-container">
        <section className="phase-four-page-head">
          <div>
            <p className="phase-four-kicker">🚜 Shared machinery network</p>
            <h1>Equipment Rental</h1>
            <p>Book verified machinery without buying expensive equipment.</p>
          </div>
          <div className="table-actions">
            {user?.role !== "admin" && (
              <button className="btn" onClick={() => setShowListing(!showListing)}>
                {showListing ? "Close Form" : "List Equipment"}
              </button>
            )}
            <Link className="btn secondary" to="/expansion">Expansion Hub</Link>
          </div>
        </section>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        {user?.role !== "admin" &&
          user?.verification_status !== "verified" && (
            <div className="alert warning">
              KYC verification is required to list or rent equipment.
            </div>
          )}

        {showListing && user?.role !== "admin" && (
          <form className="phase-four-form" onSubmit={submitListing}>
            <div className="phase-four-section-title">
              <div><span>Owner desk</span><h2>Publish machinery</h2></div>
            </div>
            <div className="grid three">
              <div><label>Equipment Name</label><input value={listing.name} onChange={(e) => setListing({ ...listing, name: e.target.value })} required /></div>
              <div><label>Category</label><select value={listing.category} onChange={(e) => setListing({ ...listing, category: e.target.value })}><option value="tractor">Tractor</option><option value="harvester">Harvester</option><option value="rotavator">Rotavator</option><option value="sprayer">Sprayer</option><option value="irrigation">Irrigation</option><option value="transport">Transport</option><option value="other">Other</option></select></div>
              <div><label>Total Units</label><input type="number" min="1" max="100" value={listing.total_units} onChange={(e) => setListing({ ...listing, total_units: e.target.value })} required /></div>
              <div><label>City</label><input value={listing.city} onChange={(e) => setListing({ ...listing, city: e.target.value })} required /></div>
              <div><label>State</label><input value={listing.state} onChange={(e) => setListing({ ...listing, state: e.target.value })} required /></div>
              <div><label>Rate / day (₹)</label><input type="number" min="1" value={listing.rate_per_day} onChange={(e) => setListing({ ...listing, rate_per_day: e.target.value })} required /></div>
              <div><label>Security deposit (₹)</label><input type="number" min="0" value={listing.security_deposit} onChange={(e) => setListing({ ...listing, security_deposit: e.target.value })} /></div>
              <div><label>Available from</label><input type="date" min={today()} value={listing.available_from} onChange={(e) => setListing({ ...listing, available_from: e.target.value })} required /></div>
              <div><label>Available until</label><input type="date" min={listing.available_from} value={listing.available_until} onChange={(e) => setListing({ ...listing, available_until: e.target.value })} required /></div>
              <div className="full-width"><label>Description</label><textarea value={listing.description} onChange={(e) => setListing({ ...listing, description: e.target.value })} /></div>
            </div>
            <button className="btn" disabled={action === "listing"}>Publish Equipment</button>
          </form>
        )}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading machinery network...</p></div>
        ) : (
          <>
            <section className="equipment-grid">
              {equipment.length ? equipment.map((item) => (
                <article className="equipment-card" key={item.id}>
                  <div className="equipment-card-top">
                    <span className="equipment-emoji">🚜</span>
                    <span className={`deal-status ${item.status}`}>{item.status}</span>
                  </div>
                  <p className="phase-four-eyebrow">{item.category.replaceAll("_", " ")}</p>
                  <h2>{item.name}</h2>
                  <p>{item.description || "Verified farm equipment listing."}</p>
                  <div className="equipment-price"><strong>₹{Number(item.rate_per_day).toLocaleString()}</strong><span>/day</span></div>
                  <div className="phase-four-meta">
                    <span>📍 {item.city}, {item.state}</span>
                    <span>🧰 {item.available_units_today}/{item.total_units} available today</span>
                    <span>🔒 ₹{Number(item.security_deposit).toLocaleString()} deposit</span>
                    <span>👤 {item.owner_name}</span>
                  </div>
                  <div className="table-actions">
                    {!canManage(item) && user?.role !== "admin" && (
                      <button className="btn small" onClick={() => { setBookingItem(item); setBooking({ ...emptyBooking, delivery_address: user?.address || "" }); }}>Request Rental</button>
                    )}
                    {canManage(item) && (
                      <>
                        <button className="btn small secondary" disabled={action === `equipment-${item.id}`} onClick={() => updateListing(item, item.status === "active" ? "inactive" : "active")}>
                          Mark {item.status === "active" ? "Inactive" : "Active"}
                        </button>
                        {item.status === "active" && <button className="btn small secondary" onClick={() => updateListing(item, "maintenance")}>Maintenance</button>}
                      </>
                    )}
                  </div>
                  {bookingItem?.id === item.id && (
                    <form className="inline-booking-form" onSubmit={submitBooking}>
                      <div className="grid two">
                        <div><label>Start Date</label><input type="date" min={today()} value={booking.start_date} onChange={(e) => setBooking({ ...booking, start_date: e.target.value })} required /></div>
                        <div><label>End Date</label><input type="date" min={booking.start_date} value={booking.end_date} onChange={(e) => setBooking({ ...booking, end_date: e.target.value })} required /></div>
                        <div><label>Units</label><input type="number" min="1" max={item.total_units} value={booking.units} onChange={(e) => setBooking({ ...booking, units: e.target.value })} required /></div>
                        <div><label>Delivery Address</label><input value={booking.delivery_address} onChange={(e) => setBooking({ ...booking, delivery_address: e.target.value })} required /></div>
                        <div className="full-width"><label>Notes</label><textarea value={booking.notes} onChange={(e) => setBooking({ ...booking, notes: e.target.value })} /></div>
                      </div>
                      <div className="table-actions"><button className="btn small" disabled={action === `book-${item.id}`}>Submit</button><button type="button" className="btn small secondary" onClick={() => setBookingItem(null)}>Cancel</button></div>
                    </form>
                  )}
                </article>
              )) : <div className="phase-four-empty">No equipment is listed yet.</div>}
            </section>

            <section className="phase-four-panel">
              <div className="phase-four-section-title"><div><span>Transaction desk</span><h2>Rental Bookings</h2></div><b>{bookings.length} records</b></div>
              <div className="phase-four-table-wrap">
                <table>
                  <thead><tr><th>Rental</th><th>Parties</th><th>Dates</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {bookings.length ? bookings.map((item) => {
                      const owner = Number(item.owner_id) === Number(user?.id);
                      const renter = Number(item.renter_id) === Number(user?.id);
                      return (
                        <tr key={item.id}>
                          <td><strong>#{item.id} {item.equipment_name}</strong><small>{item.units} unit(s) · {item.rental_days} days</small></td>
                          <td><span>Owner: {item.owner_name}</span><small>Renter: {item.renter_name}</small></td>
                          <td>{String(item.start_date).slice(0, 10)}<small>to {String(item.end_date).slice(0, 10)}</small></td>
                          <td>₹{Number(item.total_amount).toLocaleString()}</td>
                          <td><span className={`deal-status ${item.status}`}>{item.status}</span></td>
                          <td><div className="table-actions">
                            {(owner || user?.role === "admin") && item.status === "requested" && <><button className="btn small" onClick={() => updateBooking(item.id, "approved")}>Approve</button><button className="btn small danger" onClick={() => updateBooking(item.id, "rejected")}>Reject</button></>}
                            {(owner || user?.role === "admin") && item.status === "approved" && <button className="btn small" onClick={() => updateBooking(item.id, "active")}>Start</button>}
                            {(owner || user?.role === "admin") && item.status === "active" && <button className="btn small" onClick={() => updateBooking(item.id, "completed")}>Complete</button>}
                            {renter && ["requested", "approved"].includes(item.status) && <button className="btn small danger" onClick={() => updateBooking(item.id, "cancelled")}>Cancel</button>}
                          </div></td>
                        </tr>
                      );
                    }) : <tr><td colSpan="6" className="empty-row">No rental bookings found.</td></tr>}
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
