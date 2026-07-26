import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import Phase5Status from "../components/Phase5Status";

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function FinanceCenter() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    order_id: "",
    amount: "",
    payment_method: "upi",
    transaction_reference: "",
    proof_note: "",
  });
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan_code: "starter",
    payment_reference: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const requests = [
        api.get("/finance/invoices"),
        api.get("/finance/payments"),
      ];
      if (user?.role !== "admin") requests.push(api.get("/orders/my/list"));
      if (user?.role !== "farmer") requests.push(api.get("/finance/subscriptions"));
      const responses = await Promise.all(requests);
      setInvoices(responses[0].data.invoices || []);
      setPayments(responses[1].data.payments || []);
      let cursor = 2;
      if (user?.role !== "admin") {
        setOrders(responses[cursor].data.orders || []);
        cursor += 1;
      }
      if (user?.role !== "farmer") {
        setPlans(responses[cursor].data.plans || []);
        setSubscriptions(responses[cursor].data.subscriptions || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Finance center could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const eligibleOrders = useMemo(
    () => orders.filter((order) => ["accepted", "completed"].includes(order.status)),
    [orders]
  );

  const runAction = async (key, request) => {
    try {
      setBusy(key);
      setError("");
      setNotice("");
      const response = await request();
      setNotice(response.data.message || "Finance record updated");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Finance action failed");
    } finally {
      setBusy("");
    }
  };

  const createInvoice = (orderId) =>
    runAction(`invoice-${orderId}`, () =>
      api.post(`/finance/orders/${orderId}/invoice`)
    );

  const submitPayment = (event) => {
    event.preventDefault();
    if (!paymentForm.order_id) return setError("Select an accepted order");
    runAction("payment", () =>
      api.post(`/finance/orders/${paymentForm.order_id}/payments`, paymentForm)
    );
  };

  const requestSubscription = (event) => {
    event.preventDefault();
    runAction("subscription", () =>
      api.post("/finance/subscriptions", subscriptionForm)
    );
  };

  const downloadInvoice = (invoice) => {
    const lines = [
      "AGROCONNECT BUSINESS INVOICE",
      `Invoice: ${invoice.invoice_number}`,
      `Order: #${invoice.order_id}`,
      `Issued: ${new Date(invoice.issued_at).toLocaleString("en-IN")}`,
      "",
      `Seller: ${invoice.seller_name}${invoice.seller_business ? ` (${invoice.seller_business})` : ""}`,
      `Buyer: ${invoice.buyer_name}${invoice.buyer_business ? ` (${invoice.buyer_business})` : ""}`,
      "",
      `${invoice.crop_name}: ${invoice.quantity} ${invoice.unit} x ${money(invoice.unit_price)}`,
      `Subtotal: ${money(invoice.subtotal)}`,
      `Platform fee (${invoice.platform_fee_percent}%): ${money(invoice.platform_fee)}`,
      `Invoice total: ${money(invoice.total_amount)}`,
      `Seller net: ${money(invoice.seller_net_amount)}`,
      `Verified payment: ${money(invoice.paid_amount)}`,
      `Status: ${String(invoice.status).replaceAll("_", " ")}`,
      "",
      "Payment records are verified by AgroConnect admin. This file is not a tax invoice.",
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoice.invoice_number}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <main className="phase-five-page"><div className="phase-five-loading"><div className="loader"></div><p>Loading finance records...</p></div></main>;
  }

  return (
    <main className="phase-five-page">
      <div className="phase-five-container">
        <section className="phase-five-hero compact">
          <div>
            <p className="phase-five-kicker">Finance Center</p>
            <h1>Invoices, Payments &amp; <span>Revenue</span></h1>
            <p>Order-linked records with commission snapshots and admin verification.</p>
          </div>
          <button className="btn secondary" onClick={fetchData}>Refresh</button>
        </section>

        <div className="phase-five-callout">
          <strong>Payment mode:</strong> This version records UPI, bank, cash or
          cheque references for admin verification. It does not process money online.
        </div>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        {user?.role !== "admin" && (
          <section className="phase-five-panel">
            <div className="phase-five-section-head">
              <div><p>Accepted business</p><h2>Generate invoice</h2></div>
              <span>{eligibleOrders.length} eligible orders</span>
            </div>
            <div className="phase-five-order-strip">
              {eligibleOrders.length ? eligibleOrders.map((order) => (
                <article key={order.id}>
                  <div>
                    <strong>#{order.id} · {order.crop_name}</strong>
                    <span>{order.quantity} {order.unit} · {money(order.total_price)}</span>
                  </div>
                  <button className="btn small" disabled={busy === `invoice-${order.id}`} onClick={() => createInvoice(order.id)}>
                    {busy === `invoice-${order.id}` ? "Working..." : "Create / View"}
                  </button>
                </article>
              )) : <p className="phase-five-empty-text">Accepted or completed orders will appear here.</p>}
            </div>
          </section>
        )}

        <section className="phase-five-panel">
          <div className="phase-five-section-head">
            <div><p>Commercial documents</p><h2>Invoices</h2></div>
            <span>{invoices.length} records</span>
          </div>
          <div className="phase-five-card-grid">
            {invoices.length ? invoices.map((invoice) => (
              <article className="phase-five-record-card" key={invoice.id}>
                <div className="record-card-head">
                  <div><small>Invoice</small><h3>{invoice.invoice_number}</h3></div>
                  <Phase5Status value={invoice.status} />
                </div>
                <p>Order #{invoice.order_id} · {invoice.crop_name} · {invoice.quantity} {invoice.unit}</p>
                <dl className="phase-five-metrics">
                  <div><dt>Total</dt><dd>{money(invoice.total_amount)}</dd></div>
                  <div><dt>Verified</dt><dd>{money(invoice.paid_amount)}</dd></div>
                  <div><dt>Fee</dt><dd>{invoice.platform_fee_percent}%</dd></div>
                  <div><dt>Seller net</dt><dd>{money(invoice.seller_net_amount)}</dd></div>
                </dl>
                <button className="btn secondary small" onClick={() => downloadInvoice(invoice)}>Download Invoice</button>
              </article>
            )) : <p className="phase-five-empty-text">No invoices generated yet.</p>}
          </div>
        </section>

        {user?.role === "distributor" && (
          <section className="phase-five-panel split-panel">
            <div>
              <p className="phase-five-eyebrow">Buyer payment record</p>
              <h2>Submit payment reference</h2>
              <p className="muted-copy">Admin will verify it before the invoice is marked paid.</p>
            </div>
            <form className="phase-five-form" onSubmit={submitPayment}>
              <label>Order
                <select value={paymentForm.order_id} onChange={(event) => setPaymentForm({ ...paymentForm, order_id: event.target.value })} required>
                  <option value="">Select order</option>
                  {eligibleOrders.map((order) => <option key={order.id} value={order.id}>#{order.id} · {order.crop_name}</option>)}
                </select>
              </label>
              <label>Amount
                <input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} required />
              </label>
              <label>Method
                <select value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })}>
                  <option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option>
                </select>
              </label>
              <label>Transaction reference
                <input value={paymentForm.transaction_reference} onChange={(event) => setPaymentForm({ ...paymentForm, transaction_reference: event.target.value })} placeholder="Optional for cash" />
              </label>
              <label className="wide">Proof note
                <textarea value={paymentForm.proof_note} onChange={(event) => setPaymentForm({ ...paymentForm, proof_note: event.target.value })} placeholder="Bank, date or receipt details" />
              </label>
              <button className="btn" disabled={busy === "payment"}>{busy === "payment" ? "Submitting..." : "Submit for verification"}</button>
            </form>
          </section>
        )}

        <section className="phase-five-panel">
          <div className="phase-five-section-head">
            <div><p>Payment ledger</p><h2>Payment records</h2></div>
            <span>{payments.length} entries</span>
          </div>
          <div className="phase-five-table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Parties</th><th>Amount</th><th>Reference</th><th>Status</th>{user?.role === "admin" && <th>Review</th>}</tr></thead>
              <tbody>
                {payments.length ? payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.invoice_number}<small>Order #{payment.order_id}</small></td>
                    <td>{payment.payer_name}<small>to {payment.payee_name}</small></td>
                    <td>{money(payment.amount)}</td>
                    <td>{payment.transaction_reference || "Cash / no reference"}<small>{payment.payment_method.replaceAll("_", " ")}{payment.proof_note ? ` · ${payment.proof_note}` : ""}</small></td>
                    <td><Phase5Status value={payment.status} /></td>
                    {user?.role === "admin" && <td>
                      {payment.status === "submitted" ? <div className="phase-five-actions">
                        <button className="btn small" onClick={() => runAction(`pay-${payment.id}-verified`, () => api.patch(`/finance/payments/${payment.id}/status`, { status: "verified" }))}>Verify</button>
                        <button className="btn small danger" onClick={() => runAction(`pay-${payment.id}-rejected`, () => api.patch(`/finance/payments/${payment.id}/status`, { status: "rejected" }))}>Reject</button>
                      </div> : "Reviewed"}
                    </td>}
                  </tr>
                )) : <tr><td colSpan={user?.role === "admin" ? 6 : 5} className="empty-row">No payment records.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {user?.role !== "farmer" && (
          <section className="phase-five-panel">
            <div className="phase-five-section-head">
              <div><p>Platform revenue</p><h2>Subscription plans</h2></div>
              <span>{plans.length} plans</span>
            </div>
            <div className="phase-five-plan-grid">
              {plans.map((plan) => (
                <article key={plan.code}>
                  <h3>{plan.name}</h3>
                  <strong>{money(plan.monthly_price)}<small>/30 days</small></strong>
                  <p>{plan.commission_percent}% platform fee</p>
                  <span>{plan.features}</span>
                </article>
              ))}
            </div>
            {user?.role === "distributor" && (
              <form className="phase-five-inline-form" onSubmit={requestSubscription}>
                <select value={subscriptionForm.plan_code} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, plan_code: event.target.value })}>
                  {plans.map((plan) => <option value={plan.code} key={plan.code}>{plan.name}</option>)}
                </select>
                <input value={subscriptionForm.payment_reference} onChange={(event) => setSubscriptionForm({ ...subscriptionForm, payment_reference: event.target.value })} placeholder="Paid-plan payment reference" />
                <button className="btn" disabled={busy === "subscription"}>Request plan</button>
              </form>
            )}
            <div className="phase-five-table-wrap">
              <table>
                <thead><tr><th>Distributor</th><th>Plan</th><th>Period</th><th>Status</th>{user?.role === "admin" && <th>Review</th>}</tr></thead>
                <tbody>
                  {subscriptions.length ? subscriptions.map((subscription) => (
                    <tr key={subscription.id}>
                      <td>{subscription.distributor_name || user?.name}<small>{subscription.business_name}</small></td>
                      <td>{subscription.plan_name}<small>{subscription.commission_percent}% fee{subscription.payment_reference ? ` · Ref: ${subscription.payment_reference}` : ""}</small></td>
                      <td>{subscription.starts_at ? `${new Date(subscription.starts_at).toLocaleDateString("en-IN")} – ${new Date(subscription.ends_at).toLocaleDateString("en-IN")}` : "Awaiting review"}</td>
                      <td><Phase5Status value={subscription.status} /></td>
                      {user?.role === "admin" && <td><div className="phase-five-actions">
                        {subscription.status === "pending" && <>
                          <button className="btn small" onClick={() => runAction(`sub-${subscription.id}-active`, () => api.patch(`/finance/subscriptions/${subscription.id}/status`, { status: "active" }))}>Activate</button>
                          <button className="btn small danger" onClick={() => runAction(`sub-${subscription.id}-rejected`, () => api.patch(`/finance/subscriptions/${subscription.id}/status`, { status: "rejected" }))}>Reject</button>
                        </>}
                        {subscription.status === "active" && <button className="btn small danger" onClick={() => runAction(`sub-${subscription.id}-cancelled`, () => api.patch(`/finance/subscriptions/${subscription.id}/status`, { status: "cancelled" }))}>Cancel</button>}
                      </div></td>}
                    </tr>
                  )) : <tr><td colSpan={user?.role === "admin" ? 5 : 4} className="empty-row">No subscriptions.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
