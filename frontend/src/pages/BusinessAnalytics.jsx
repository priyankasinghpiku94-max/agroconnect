import { useEffect, useMemo, useState } from "react";
import { Link } from "../router";
import api from "../api/api";

const labels = {
  products: "Products",
  inventory_value: "Inventory Value",
  orders: "Orders",
  completed_revenue: "Completed Revenue",
  quotations: "Quotations",
  accepted_quotations: "Accepted Quotes",
  active_contracts: "Active Contracts",
  fpo_memberships: "FPO Memberships",
  demands: "Purchase Demands",
  open_demands: "Open Demands",
  completed_spend: "Completed Spend",
  active_negotiations: "Active Negotiations",
  warehouse_bookings: "Storage Bookings",
  active_users: "Active Users",
  active_fpos: "Active FPOs",
  completed_gmv: "Completed GMV",
  pending_warehouse_bookings: "Pending Storage",
  warehouse_utilization: "Warehouse Utilization",
};

const moneyKeys = new Set([
  "inventory_value",
  "completed_revenue",
  "completed_spend",
  "completed_gmv",
]);

const formatValue = (key, value) => {
  const number = Number(value || 0);
  if (moneyKeys.has(key)) return `₹${number.toLocaleString()}`;
  if (key === "warehouse_utilization") return `${number}%`;
  return number.toLocaleString();
};

export default function BusinessAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get("/analytics/overview");
        setAnalytics(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const maxMonthly = useMemo(
    () =>
      Math.max(
        1,
        ...(analytics?.monthly || []).map((item) =>
          Number(item.completed_value || 0)
        )
      ),
    [analytics]
  );

  const exportCsv = async (type) => {
    try {
      setExporting(type);
      setError("");
      const res = await api.get("/analytics/export", {
        params: { type },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `agroconnect-${type}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export CSV");
    } finally {
      setExporting("");
    }
  };

  return (
    <main className="phase-three-page">
      <div className="phase-three-container">
        <section className="phase-three-hero compact">
          <div>
            <p className="phase-three-kicker">📈 Decision Intelligence</p>
            <h1>Business <span>Analytics</span></h1>
            <p>Role-based performance, order value and business-data exports.</p>
          </div>
          <Link className="btn secondary" to="/business">Business Hub</Link>
        </section>

        {error && <div className="alert error">{error}</div>}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Calculating analytics...</p></div>
        ) : analytics ? (
          <>
            <section className="analytics-metric-grid">
              {Object.entries(analytics.metrics || {}).map(([key, value]) => (
                <article key={key}>
                  <span>{labels[key] || key.replaceAll("_", " ")}</span>
                  <strong>{formatValue(key, value)}</strong>
                </article>
              ))}
            </section>

            <section className="analytics-layout">
              <article className="phase-three-panel analytics-chart-card">
                <div className="phase-three-section-head">
                  <div><p>Recent Performance</p><h2>Completed Order Value</h2></div>
                </div>
                {analytics.monthly?.length ? (
                  <div className="analytics-bars">
                    {analytics.monthly.map((item) => (
                      <div className="analytics-bar-item" key={item.month}>
                        <div className="analytics-bar-track">
                          <span style={{ height: `${Math.max(8, (Number(item.completed_value) / maxMonthly) * 100)}%` }}>
                            <em>₹{Number(item.completed_value).toLocaleString()}</em>
                          </span>
                        </div>
                        <strong>{item.month}</strong>
                        <small>{item.order_count} orders</small>
                      </div>
                    ))}
                  </div>
                ) : <div className="analytics-no-data">Completed order data will appear here.</div>}
              </article>

              <article className="phase-three-panel category-card">
                <div className="phase-three-section-head">
                  <div><p>Product Mix</p><h2>Category Performance</h2></div>
                </div>
                <div className="category-performance-list">
                  {(analytics.category_breakdown || []).map((item) => (
                    <div key={item.category}>
                      <span><strong>{item.category}</strong><small>{item.order_count} orders</small></span>
                      <b>₹{Number(item.completed_value || 0).toLocaleString()}</b>
                    </div>
                  ))}
                  {!analytics.category_breakdown?.length && <p>No category data yet.</p>}
                </div>
              </article>
            </section>

            <section className="phase-three-panel export-panel">
              <div>
                <p>Portable Business Records</p>
                <h2>CSV Data Export</h2>
                <span>Download role-scoped records for accounting or reporting.</span>
              </div>
              <div className="export-actions">
                <button className="btn" disabled={Boolean(exporting)} onClick={() => exportCsv("orders")}>{exporting === "orders" ? "Preparing..." : "Export Orders"}</button>
                <button className="btn secondary" disabled={Boolean(exporting)} onClick={() => exportCsv("contracts")}>{exporting === "contracts" ? "Preparing..." : "Export Contracts"}</button>
                <button className="btn secondary" disabled={Boolean(exporting)} onClick={() => exportCsv("warehouse")}>{exporting === "warehouse" ? "Preparing..." : "Export Warehouses"}</button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
