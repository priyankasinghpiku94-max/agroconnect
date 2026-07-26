import { useEffect, useState } from "react";
import { Link } from "../router";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

export default function ProcurementContracts() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadContracts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/contracts");
      setContracts(res.data.contracts || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load contracts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const generateOrder = async (id) => {
    try {
      setAction(`generate-${id}`);
      setError("");
      await api.post(`/contracts/${id}/generate-order`);
      setMessage("Next scheduled order generated successfully.");
      await loadContracts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate order");
    } finally {
      setAction("");
    }
  };

  const changeStatus = async (id, status) => {
    if (status === "cancelled" && !window.confirm("Cancel this procurement contract?")) return;
    try {
      setAction(`${status}-${id}`);
      setError("");
      await api.patch(`/contracts/${id}/status`, { status });
      setMessage(`Contract updated to ${status}.`);
      await loadContracts();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update contract");
    } finally {
      setAction("");
    }
  };

  return (
    <main className="phase-three-page">
      <div className="phase-three-container">
        <section className="phase-three-hero compact">
          <div>
            <p className="phase-three-kicker">🏛️ Institutional Procurement</p>
            <h1>Recurring <span>Supply Contracts</span></h1>
            <p>
              Accepted recurring quotations become scheduled procurement
              agreements with fixed quantity, price and frequency.
            </p>
          </div>
          <div className="phase-three-hero-actions">
            {user?.role === "distributor" && (
              <Link className="btn" to="/demands">Create Recurring Demand</Link>
            )}
            <Link className="btn secondary" to="/business">Business Hub</Link>
          </div>
        </section>

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading contracts...</p></div>
        ) : contracts.length === 0 ? (
          <section className="phase-three-empty">
            <div className="empty-icon">📑</div>
            <h2>No procurement contracts yet</h2>
            <p>
              A contract is created automatically when a recurring demand
              quotation is accepted.
            </p>
            {user?.role === "distributor" && <Link className="btn" to="/demands">Publish Recurring Demand</Link>}
          </section>
        ) : (
          <section className="contract-grid">
            {contracts.map((contract) => {
              const canManage = ["distributor", "admin"].includes(user?.role);
              return (
                <article className="contract-card" key={contract.id}>
                  <div className="contract-card-head">
                    <div>
                      <span className="phase-three-eyebrow">Contract #{contract.id}</span>
                      <h2>{contract.crop_name}</h2>
                      <p>{contract.institution_name}</p>
                    </div>
                    <span className={`deal-status ${contract.status}`}>{contract.status}</span>
                  </div>

                  <div className="contract-metrics">
                    <div><span>Scheduled Supply</span><strong>{contract.quantity} {contract.unit}</strong></div>
                    <div><span>Fixed Price</span><strong>₹{contract.unit_price}/{contract.unit}</strong></div>
                    <div><span>Frequency</span><strong>{contract.delivery_frequency}</strong></div>
                    <div><span>Generated Orders</span><strong>{contract.generated_orders}</strong></div>
                  </div>

                  <div className="contract-schedule">
                    <div><span>Start</span><strong>{String(contract.start_date).slice(0, 10)}</strong></div>
                    <div><span>End</span><strong>{String(contract.end_date).slice(0, 10)}</strong></div>
                    <div><span>Next Schedule</span><strong>{contract.next_delivery_date ? String(contract.next_delivery_date).slice(0, 10) : "Schedule complete"}</strong></div>
                  </div>

                  <p className="contract-partner">
                    {user?.role === "farmer"
                      ? `Buyer: ${contract.distributor_business || contract.distributor_name}`
                      : `Farmer: ${contract.farmer_business || contract.farmer_name}`}
                  </p>

                  <div className="contract-actions">
                    {user?.role === "distributor" &&
                      contract.status === "active" &&
                      contract.next_delivery_date && (
                        <button className="btn small" disabled={action === `generate-${contract.id}`} onClick={() => generateOrder(contract.id)}>
                          Generate Next Order
                        </button>
                      )}
                    {canManage && contract.status === "active" && (
                      <button className="btn small secondary" disabled={action === `paused-${contract.id}`} onClick={() => changeStatus(contract.id, "paused")}>Pause</button>
                    )}
                    {canManage && contract.status === "paused" && (
                      <button className="btn small" disabled={action === `active-${contract.id}`} onClick={() => changeStatus(contract.id, "active")}>Resume</button>
                    )}
                    {canManage && ["active", "paused"].includes(contract.status) && (
                      <button className="btn small danger" disabled={action === `cancelled-${contract.id}`} onClick={() => changeStatus(contract.id, "cancelled")}>Cancel</button>
                    )}
                    <Link className="btn small secondary" to="/orders">View Orders</Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
