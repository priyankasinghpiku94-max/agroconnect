import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function Negotiations() {
  const { user } = useAuth();
  const verified = user?.verification_status === "verified";
  const [quotations, setQuotations] = useState([]);
  const [history, setHistory] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [counterId, setCounterId] = useState(null);
  const [counter, setCounter] = useState({ quantity: "", unit_price: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchQuotations = async () => {
    if (!verified) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.get("/quotations");
      setQuotations(res.data.quotations || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load negotiations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [verified]);

  const toggleHistory = async (id) => {
    if (expandedId === id) return setExpandedId(null);
    try {
      setExpandedId(id);
      if (!history[id]) {
        const res = await api.get(`/quotations/${id}/history`);
        setHistory({ ...history, [id]: res.data.history || [] });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load history");
    }
  };

  const runAction = async (key, request, success) => {
    try {
      setActionId(key);
      setError("");
      setMessage("");
      await request();
      setMessage(success);
      setCounterId(null);
      setExpandedId(null);
      setHistory({});
      await fetchQuotations();
    } catch (err) {
      setError(err.response?.data?.message || "Negotiation action failed");
    } finally {
      setActionId("");
    }
  };

  const startCounter = (quote) => {
    setCounterId(quote.id);
    setCounter({
      quantity: quote.quantity,
      unit_price: quote.unit_price,
      message: "",
    });
  };

  const submitCounter = (e, id) => {
    e.preventDefault();
    runAction(
      `counter-${id}`,
      () => api.post(`/quotations/${id}/counter`, counter),
      "Counter-offer sent successfully."
    );
  };

  const accept = (id) =>
    runAction(
      `accept-${id}`,
      () => api.post(`/quotations/${id}/accept`, { message: "Offer accepted" }),
      "Offer accepted and confirmed order created."
    );

  const reject = (id) => {
    const reason = window.prompt("Optional rejection reason:") || "Offer rejected";
    runAction(
      `reject-${id}`,
      () => api.post(`/quotations/${id}/reject`, { message: reason }),
      "Offer rejected."
    );
  };

  if (!verified) {
    return (
      <main className="phase-two-page">
        <div className="phase-two-container">
          <section className="phase-two-empty">
            <div className="empty-icon">🔐</div>
            <h1>Business verification required</h1>
            <p>Complete KYC verification before starting price negotiations.</p>
            <Link className="btn" to="/profile">Open Profile & KYC</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="phase-two-page">
      <div className="phase-two-container">
        <section className="phase-two-hero">
          <div>
            <p className="phase-two-badge">🤝 Price Negotiation</p>
            <h1>
              Quotations & <span>Counter-Offers</span>
            </h1>
            <p>
              Review the complete offer history, negotiate one turn at a time,
              and convert an accepted quotation into a confirmed order.
            </p>
          </div>
          <Link className="btn secondary" to="/demands">Demand Board</Link>
        </section>

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading negotiations...</p></div>
        ) : quotations.length === 0 ? (
          <section className="phase-two-empty">
            <div className="empty-icon">💬</div>
            <h2>No quotations yet</h2>
            <p>Demand-board quotations will appear here.</p>
          </section>
        ) : (
          <section className="negotiation-list">
            {quotations.map((quote) => {
              const active = ["submitted", "countered"].includes(quote.status);
              const waitingForMe = active && quote.current_offer_by !== user.role;
              const partner =
                user.role === "farmer"
                  ? quote.distributor_business || quote.distributor_name
                  : quote.farmer_business || quote.farmer_name;

              return (
                <article className="negotiation-card" key={quote.id}>
                  <div className="negotiation-head">
                    <div>
                      <span className="phase-two-eyebrow">Quote #{quote.id} · Demand #{quote.demand_id}</span>
                      <h2>{quote.crop_name}</h2>
                      <p>Negotiating with <strong>{partner}</strong></p>
                    </div>
                    <span className={`deal-status ${quote.status}`}>{quote.status}</span>
                  </div>

                  <div className="offer-summary">
                    <div><span>Current Quantity</span><strong>{quote.quantity} {quote.unit}</strong></div>
                    <div><span>Current Price</span><strong>₹{quote.unit_price}/{quote.unit}</strong></div>
                    <div><span>Offer Value</span><strong>₹{(Number(quote.quantity) * Number(quote.unit_price)).toFixed(2)}</strong></div>
                    <div><span>Offer Sent By</span><strong>{quote.current_offer_by}</strong></div>
                  </div>

                  {quote.message && <p className="offer-message">“{quote.message}”</p>}

                  <div className="negotiation-actions">
                    <button className="btn small secondary" onClick={() => toggleHistory(quote.id)}>
                      {expandedId === quote.id ? "Hide History" : `Offer History (${quote.history_count})`}
                    </button>
                    {waitingForMe && (
                      <>
                        <button className="btn small" onClick={() => accept(quote.id)} disabled={actionId === `accept-${quote.id}`}>Accept</button>
                        <button className="btn small secondary" onClick={() => startCounter(quote)}>Counter</button>
                        <button className="btn small danger" onClick={() => reject(quote.id)} disabled={actionId === `reject-${quote.id}`}>Reject</button>
                      </>
                    )}
                    {active && !waitingForMe && (
                      <span className="waiting-chip">Waiting for {user.role === "farmer" ? "distributor" : "farmer"}</span>
                    )}
                    {quote.status === "accepted" && (
                      <Link className="btn small" to="/orders">View Confirmed Order</Link>
                    )}
                  </div>

                  {counterId === quote.id && (
                    <form className="counter-form" onSubmit={(e) => submitCounter(e, quote.id)}>
                      <div>
                        <label>Counter Quantity ({quote.unit})</label>
                        <input type="number" min="0.01" step="0.01" value={counter.quantity} onChange={(e) => setCounter({ ...counter, quantity: e.target.value })} required />
                      </div>
                      <div>
                        <label>Counter Price / {quote.unit}</label>
                        <input type="number" min="0.01" step="0.01" value={counter.unit_price} onChange={(e) => setCounter({ ...counter, unit_price: e.target.value })} required />
                      </div>
                      <div className="full-width">
                        <label>Message</label>
                        <textarea value={counter.message} onChange={(e) => setCounter({ ...counter, message: e.target.value })} />
                      </div>
                      <div className="table-actions full-width">
                        <button className="btn small" disabled={actionId === `counter-${quote.id}`}>Send Counter-Offer</button>
                        <button type="button" className="btn small secondary" onClick={() => setCounterId(null)}>Cancel</button>
                      </div>
                    </form>
                  )}

                  {expandedId === quote.id && (
                    <div className="offer-timeline">
                      {(history[quote.id] || []).map((event) => (
                        <div className="offer-event" key={event.id}>
                          <span className={`timeline-dot ${event.action}`}></span>
                          <div>
                            <strong>{event.actor_name} · {event.action}</strong>
                            {event.quantity && (
                              <p>{event.quantity} {quote.unit} at ₹{event.unit_price}/{quote.unit}</p>
                            )}
                            {event.message && <small>{event.message}</small>}
                            <time>{new Date(event.created_at).toLocaleString()}</time>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
