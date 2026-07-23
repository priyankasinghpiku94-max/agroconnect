import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const emptyDemand = {
  crop_name: "",
  category: "Vegetables",
  quantity: "",
  unit: "kg",
  target_price: "",
  quality_grade: "Any",
  delivery_city: "",
  delivery_state: "Bihar",
  needed_by: "",
  description: "",
};

const normalizeCropName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .trim();

const cropMatches = (productName, demandName) => {
  const product = normalizeCropName(productName);
  const demand = normalizeCropName(demandName);
  return Boolean(product && demand) &&
    (product === demand || product.includes(demand) || demand.includes(product));
};

export default function DemandBoard() {
  const { user } = useAuth();
  const [demands, setDemands] = useState([]);
  const [products, setProducts] = useState([]);
  const [demandForm, setDemandForm] = useState(() => ({
    ...emptyDemand,
    delivery_city: user?.city || "",
    delivery_state: user?.state || "Bihar",
  }));
  const [filters, setFilters] = useState({ search: "", category: "" });
  const [quoteDemandId, setQuoteDemandId] = useState(null);
  const [quoteForm, setQuoteForm] = useState({
    product_id: "",
    quantity: "",
    unit_price: "",
    message: "",
  });
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const verified = user?.verification_status === "verified";

  const fetchData = async () => {
    if (!verified) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      if (user.role === "distributor") {
        const res = await api.get("/demands/my");
        setDemands(res.data.demands || []);
      } else {
        const [demandRes, productRes] = await Promise.all([
          api.get("/demands", { params: filters }),
          api.get("/products/my"),
        ]);
        setDemands(demandRes.data.demands || []);
        setProducts(productRes.data.products || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load demand board");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.role, verified]);

  const createDemand = async (e) => {
    e.preventDefault();
    try {
      setActionId("create");
      setError("");
      setMessage("");
      await api.post("/demands", demandForm);
      setDemandForm({
        ...emptyDemand,
        delivery_city: user.city || "",
        delivery_state: user.state || "Bihar",
      });
      setMessage("Purchase demand published successfully.");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to publish demand");
    } finally {
      setActionId(null);
    }
  };

  const closeDemand = async (id) => {
    if (!window.confirm("Close this demand and reject its active quotations?")) return;
    try {
      setActionId(`close-${id}`);
      setError("");
      await api.patch(`/demands/${id}/close`);
      setMessage("Demand closed successfully.");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to close demand");
    } finally {
      setActionId(null);
    }
  };

  const openQuote = (demand) => {
    setQuoteDemandId(demand.id);
    setQuoteForm({
      product_id: "",
      quantity: demand.quantity,
      unit_price: demand.target_price || "",
      message: "",
    });
    setMessage("");
    setError("");
  };

  const submitQuote = async (e, demandId) => {
    e.preventDefault();
    try {
      setActionId(`quote-${demandId}`);
      setError("");
      setMessage("");
      await api.post(`/quotations/demand/${demandId}`, quoteForm);
      setQuoteDemandId(null);
      setMessage("Quotation submitted. Track it in Negotiations.");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit quotation");
    } finally {
      setActionId(null);
    }
  };

  const eligibleProducts = useMemo(() => {
    const demand = demands.find((item) => item.id === quoteDemandId);
    return products.filter(
      (product) =>
        product.status === "available" &&
        Number(product.quantity) > 0 &&
        (!demand ||
          (product.unit === demand.unit &&
            product.category === demand.category &&
            cropMatches(product.crop_name, demand.crop_name)))
    );
  }, [products, demands, quoteDemandId]);

  if (!verified) {
    return (
      <main className="phase-two-page">
        <div className="phase-two-container">
          <section className="phase-two-empty">
            <div className="empty-icon">🔐</div>
            <h1>Business verification required</h1>
            <p>Complete KYC verification before using the B2B demand board.</p>
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
            <p className="phase-two-badge">📣 Phase 2 Procurement</p>
            <h1>
              Distributor <span>Demand Board</span>
            </h1>
            <p>
              {user.role === "distributor"
                ? "Publish verified purchase requirements and receive competitive farmer quotations."
                : "Discover verified bulk requirements and quote using your available crop inventory."}
            </p>
          </div>
          <Link className="btn secondary" to="/negotiations">
            Open Negotiations
          </Link>
        </section>

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        {user.role === "distributor" && (
          <form className="demand-create-card" onSubmit={createDemand}>
            <div className="admin-section-head">
              <div><p>New Requirement</p><h2>Publish Purchase Demand</h2></div>
            </div>
            <div className="grid three demand-form-grid">
              <div>
                <label>Crop Name</label>
                <input
                  value={demandForm.crop_name}
                  onChange={(e) => setDemandForm({ ...demandForm, crop_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Category</label>
                <select
                  value={demandForm.category}
                  onChange={(e) => setDemandForm({ ...demandForm, category: e.target.value })}
                >
                  <option>Vegetables</option><option>Fruits</option>
                  <option>Grains</option><option>Pulses</option>
                  <option>Spices</option><option>Other</option>
                </select>
              </div>
              <div>
                <label>Required Quantity</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={demandForm.quantity}
                  onChange={(e) => setDemandForm({ ...demandForm, quantity: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Unit</label>
                <select
                  value={demandForm.unit}
                  onChange={(e) => setDemandForm({ ...demandForm, unit: e.target.value })}
                >
                  <option value="kg">kg</option><option value="quintal">quintal</option>
                  <option value="ton">ton</option><option value="box">box</option>
                  <option value="piece">piece</option>
                </select>
              </div>
              <div>
                <label>Target Price / Unit</label>
                <input
                  type="number" min="0.01" step="0.01"
                  value={demandForm.target_price}
                  onChange={(e) => setDemandForm({ ...demandForm, target_price: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label>Quality Grade</label>
                <select
                  value={demandForm.quality_grade}
                  onChange={(e) => setDemandForm({ ...demandForm, quality_grade: e.target.value })}
                >
                  <option value="Any">Any grade</option><option value="A">Grade A</option>
                  <option value="B">Grade B</option><option value="C">Grade C</option>
                  <option value="Standard">Standard</option>
                </select>
              </div>
              <div>
                <label>Delivery City</label>
                <input
                  value={demandForm.delivery_city}
                  onChange={(e) => setDemandForm({ ...demandForm, delivery_city: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Delivery State</label>
                <input
                  value={demandForm.delivery_state}
                  onChange={(e) => setDemandForm({ ...demandForm, delivery_state: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Required By</label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={demandForm.needed_by}
                  onChange={(e) => setDemandForm({ ...demandForm, needed_by: e.target.value })}
                  required
                />
              </div>
              <div className="full-width">
                <label>Requirement Details</label>
                <textarea
                  value={demandForm.description}
                  onChange={(e) => setDemandForm({ ...demandForm, description: e.target.value })}
                  maxLength="2000"
                />
              </div>
            </div>
            <button className="btn" disabled={actionId === "create"}>
              {actionId === "create" ? "Publishing..." : "Publish Demand"}
            </button>
          </form>
        )}

        {user.role === "farmer" && (
          <form
            className="demand-filter-card"
            onSubmit={(e) => {
              e.preventDefault();
              fetchData();
            }}
          >
            <input
              placeholder="Search crop requirement"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All categories</option>
              <option>Vegetables</option><option>Fruits</option><option>Grains</option>
              <option>Pulses</option><option>Spices</option><option>Other</option>
            </select>
            <button className="btn">Search</button>
          </form>
        )}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading demands...</p></div>
        ) : demands.length === 0 ? (
          <section className="phase-two-empty">
            <div className="empty-icon">🌾</div>
            <h2>No purchase demands found</h2>
            <p>{user.role === "distributor" ? "Publish your first bulk requirement." : "New verified requirements will appear here."}</p>
          </section>
        ) : (
          <section className="demand-grid">
            {demands.map((demand) => (
              <article className="demand-card" key={demand.id}>
                <div className="demand-card-head">
                  <div>
                    <span className="badge">{demand.category}</span>
                    <h2>{demand.crop_name}</h2>
                  </div>
                  <span className={`deal-status ${demand.status}`}>{demand.status}</span>
                </div>
                <div className="demand-metrics">
                  <div><span>Quantity</span><strong>{demand.quantity} {demand.unit}</strong></div>
                  <div><span>Target</span><strong>{demand.target_price ? `₹${demand.target_price}/${demand.unit}` : "Open price"}</strong></div>
                  <div><span>Quality</span><strong>{demand.quality_grade}</strong></div>
                  <div><span>Required by</span><strong>{String(demand.needed_by).slice(0, 10)}</strong></div>
                </div>
                <p className="demand-location">📍 {demand.delivery_location}</p>
                <p className="demand-description">{demand.description || "No additional details."}</p>
                <div className="demand-card-footer">
                  <div>
                    <strong>{demand.distributor_business || demand.distributor_name}</strong>
                    <span>{demand.quote_count || 0} quotations</span>
                  </div>
                  {user.role === "farmer" && demand.status === "open" && (
                    <button className="btn small" onClick={() => openQuote(demand)}>
                      Submit Quote
                    </button>
                  )}
                  {user.role === "distributor" && demand.status === "open" && (
                    <button
                      className="btn small danger"
                      onClick={() => closeDemand(demand.id)}
                      disabled={actionId === `close-${demand.id}`}
                    >
                      Close Demand
                    </button>
                  )}
                </div>

                {quoteDemandId === demand.id && (
                  <form className="inline-quote-form" onSubmit={(e) => submitQuote(e, demand.id)}>
                    <h3>Quote for {demand.crop_name}</h3>
                    {eligibleProducts.length ? (
                      <>
                        <label>Your Matching Product</label>
                        <select
                          value={quoteForm.product_id}
                          onChange={(e) => setQuoteForm({ ...quoteForm, product_id: e.target.value })}
                          required
                        >
                          <option value="">Select inventory product</option>
                          {eligibleProducts.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.crop_name} · {product.quantity} {product.unit} available
                            </option>
                          ))}
                        </select>
                        <div className="grid two">
                          <div>
                            <label>Quantity ({demand.unit})</label>
                            <input
                              type="number" min="0.01" step="0.01"
                              value={quoteForm.quantity}
                              onChange={(e) => setQuoteForm({ ...quoteForm, quantity: e.target.value })}
                              required
                            />
                          </div>
                          <div>
                            <label>Your Price / {demand.unit}</label>
                            <input
                              type="number" min="0.01" step="0.01"
                              value={quoteForm.unit_price}
                              onChange={(e) => setQuoteForm({ ...quoteForm, unit_price: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <label>Offer Message</label>
                        <textarea
                          value={quoteForm.message}
                          onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })}
                        />
                        <div className="table-actions">
                          <button className="btn small" disabled={actionId === `quote-${demand.id}`}>Send Quotation</button>
                          <button type="button" className="btn small secondary" onClick={() => setQuoteDemandId(null)}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <div className="alert error">
                        Add an available product using the same {demand.unit} unit before quoting.
                      </div>
                    )}
                  </form>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
