import { useState } from "react";
import api from "../api/api";
import { Link } from "../router";

export default function ScaleIntelligence() {
  const [crop, setCrop] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [price, setPrice] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const getPrice = async (e) => {
    e.preventDefault();
    if (!crop && !category) return setError("Enter a crop or select a category.");
    try {
      setLoading("price"); setError("");
      const res = await api.get("/scale/price-recommendation", {
        params: { crop, category, city, target_price: targetPrice || undefined },
      });
      setPrice(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to calculate price recommendation.");
    } finally { setLoading(""); }
  };

  const getForecast = async () => {
    if (!crop) return setError("Enter a crop for the demand forecast.");
    try {
      setLoading("forecast"); setError("");
      const res = await api.get("/scale/demand-forecast", { params: { crop, weeks: 8 } });
      setForecast(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to calculate demand forecast.");
    } finally { setLoading(""); }
  };

  return (
    <main className="scale-page">
      <div className="scale-container">
        <section className="scale-hero">
          <div>
            <p className="scale-kicker">🚀 AgroConnect Priority 3</p>
            <h1>Scale <span>Intelligence</span></h1>
            <p>Use live marketplace activity to support pricing, demand planning and expansion decisions.</p>
          </div>
          <div className="scale-actions">
            <Link className="btn secondary" to="/expansion/smart-market">Smart Market</Link>
            <Link className="btn secondary" to="/business/analytics">Business Analytics</Link>
          </div>
        </section>

        {error && <div className="alert error">{error}</div>}

        <section className="scale-grid">
          <article className="scale-panel">
            <div className="scale-panel-head"><span>01</span><div><p>Explainable pricing</p><h2>Price Recommendation</h2></div></div>
            <form className="scale-form" onSubmit={getPrice}>
              <input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="Crop e.g. Tomato" />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Category</option><option>Vegetables</option><option>Fruits</option><option>Grains</option><option>Pulses</option><option>Spices</option><option>Other</option>
              </select>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City (optional)" />
              <input type="number" min="0" step="0.01" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="Your target price (optional)" />
              <button className="btn" disabled={loading === "price"}>{loading === "price" ? "Calculating…" : "Calculate Price"}</button>
            </form>
            {price && (
              price.available ? <div className="scale-result">
                <div><span>Suggested</span><strong>₹{Number(price.suggested_price).toLocaleString()} / {price.unit}</strong></div>
                <div><span>Indicative range</span><b>₹{price.range.low} – ₹{price.range.high}</b></div>
                <div><span>Live listings</span><b>{price.sample_size}</b></div>
                <small>{price.methodology}</small>
              </div> : <div className="scale-empty">{price.message}</div>
            )}
          </article>

          <article className="scale-panel">
            <div className="scale-panel-head"><span>02</span><div><p>Demand signal</p><h2>Next-Week Estimate</h2></div></div>
            <div className="forecast-cta">
              <p>Estimate demand from completed orders for the selected crop.</p>
              <button className="btn" onClick={getForecast} disabled={loading === "forecast"}>{loading === "forecast" ? "Calculating…" : "Forecast Demand"}</button>
            </div>
            {forecast && <div className="forecast-result">
              <div className={`forecast-signal ${forecast.demand_signal}`}><strong>{forecast.demand_signal}</strong><span>{forecast.trend_percent > 0 ? "+" : ""}{forecast.trend_percent}% trend</span></div>
              <div className="forecast-number"><span>Estimated weekly quantity</span><strong>{Number(forecast.next_week_estimate).toLocaleString()}</strong></div>
              <div className="forecast-history">
                {(forecast.history || []).map((row) => <div key={row.week_key}><span>{row.week_label}</span><b>{Number(row.quantity).toLocaleString()}</b><small>{row.orders} orders</small></div>)}
              </div>
              <small>{forecast.methodology}</small>
            </div>}
          </article>
        </section>

        <section className="scale-roadmap">
          <div><strong>🌐 Location intelligence</strong><span>Use city/state filters today; map and route optimization can be added after pilot data.</span></div>
          <div><strong>🌍 Multi-language</strong><span>Existing Hindi/English voice navigation can be extended to onboarding and key workflows.</span></div>
          <div><strong>📊 Scale safely</strong><span>Recommendations are explicitly labelled as indicative signals, not guaranteed market forecasts.</span></div>
        </section>
      </div>
    </main>
  );
}
