import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import Phase5Status from "../components/Phase5Status";

export default function TrustCenter() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({});
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewForm, setReviewForm] = useState({
    order_id: "",
    rating: "5",
    comment: "",
  });
  const [disputeForm, setDisputeForm] = useState({
    order_id: "",
    category: "quality",
    subject: "",
    description: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const requests = [
        api.get("/trust/reviews"),
        api.get("/trust/disputes"),
      ];
      if (user?.role !== "admin") requests.push(api.get("/orders/my/list"));
      const responses = await Promise.all(requests);
      setReviews(responses[0].data.reviews || []);
      setSummary(responses[0].data.summary || {});
      setDisputes(responses[1].data.disputes || []);
      if (user?.role !== "admin") setOrders(responses[2].data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || "Trust center could not be loaded");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const reviewedOrderIds = useMemo(
    () =>
      new Set(
        reviews
          .filter((review) => Number(review.reviewer_id) === Number(user?.id))
          .map((review) => Number(review.order_id))
      ),
    [reviews, user]
  );

  const reviewableOrders = orders.filter(
    (order) => order.status === "completed" && !reviewedOrderIds.has(Number(order.id))
  );
  const disputableOrders = orders.filter((order) => order.status !== "rejected");

  const runAction = async (key, request) => {
    try {
      setBusy(key);
      setError("");
      setNotice("");
      const response = await request();
      setNotice(response.data.message || "Trust record updated");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Trust action failed");
    } finally {
      setBusy("");
    }
  };

  const createReview = (event) => {
    event.preventDefault();
    if (!reviewForm.order_id) return setError("Select a completed order");
    runAction("review-create", () =>
      api.post(`/trust/orders/${reviewForm.order_id}/reviews`, {
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      })
    );
  };

  const createDispute = (event) => {
    event.preventDefault();
    if (!disputeForm.order_id) return setError("Select an order");
    runAction("dispute-create", () =>
      api.post(`/trust/orders/${disputeForm.order_id}/disputes`, disputeForm)
    );
  };

  const addMessage = (dispute, isInternal = false) => {
    const message = window.prompt(
      isInternal ? "Internal admin note:" : "Add dispute message:"
    );
    if (!message?.trim()) return;
    runAction(`message-${dispute.id}`, () =>
      api.post(`/trust/disputes/${dispute.id}/messages`, {
        message,
        is_internal: isInternal,
      })
    );
  };

  const updateDispute = (dispute, status) => {
    let resolution = "";
    if (["resolved", "rejected"].includes(status)) {
      resolution = window.prompt("Enter the resolution / decision note:") || "";
      if (resolution.trim().length < 5) return;
    }
    runAction(`dispute-${dispute.id}-${status}`, () =>
      api.patch(`/trust/disputes/${dispute.id}`, { status, resolution })
    );
  };

  if (loading) {
    return <main className="phase-five-page"><div className="phase-five-loading"><div className="loader"></div><p>Loading trust records...</p></div></main>;
  }

  return (
    <main className="phase-five-page">
      <div className="phase-five-container">
        <section className="phase-five-hero compact">
          <div>
            <p className="phase-five-kicker">Trust Center</p>
            <h1>Reviews &amp; Dispute <span>Resolution</span></h1>
            <p>Verified-order feedback and a private, auditable support workflow.</p>
          </div>
          <div className="trust-rating-summary">
            <strong>{Number(summary.average_rating || 0).toFixed(1)} ★</strong>
            <span>{summary.review_count || 0} {user?.role === "admin" ? "platform reviews" : "reviews received"}</span>
          </div>
        </section>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        {user?.role !== "admin" && (
          <div className="phase-five-two-column">
            <section className="phase-five-panel">
              <p className="phase-five-eyebrow">Verified transaction feedback</p>
              <h2>Review a completed order</h2>
              <form className="phase-five-form single-column" onSubmit={createReview}>
                <label>Completed order
                  <select value={reviewForm.order_id} onChange={(event) => setReviewForm({ ...reviewForm, order_id: event.target.value })} required>
                    <option value="">Select order</option>
                    {reviewableOrders.map((order) => <option key={order.id} value={order.id}>#{order.id} · {order.crop_name}</option>)}
                  </select>
                </label>
                <label>Rating
                  <select value={reviewForm.rating} onChange={(event) => setReviewForm({ ...reviewForm, rating: event.target.value })}>
                    <option value="5">5 — Excellent</option><option value="4">4 — Good</option>
                    <option value="3">3 — Average</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option>
                  </select>
                </label>
                <label>Comment
                  <textarea value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} placeholder="Describe the transaction experience" />
                </label>
                <button className="btn" disabled={busy === "review-create"}>Publish review</button>
              </form>
            </section>

            <section className="phase-five-panel">
              <p className="phase-five-eyebrow">Structured support case</p>
              <h2>Open an order dispute</h2>
              <form className="phase-five-form single-column" onSubmit={createDispute}>
                <label>Order
                  <select value={disputeForm.order_id} onChange={(event) => setDisputeForm({ ...disputeForm, order_id: event.target.value })} required>
                    <option value="">Select order</option>
                    {disputableOrders.map((order) => <option key={order.id} value={order.id}>#{order.id} · {order.crop_name}</option>)}
                  </select>
                </label>
                <label>Category
                  <select value={disputeForm.category} onChange={(event) => setDisputeForm({ ...disputeForm, category: event.target.value })}>
                    <option value="quality">Quality</option><option value="payment">Payment</option>
                    <option value="delivery">Delivery</option><option value="quantity">Quantity</option><option value="other">Other</option>
                  </select>
                </label>
                <label>Subject
                  <input value={disputeForm.subject} onChange={(event) => setDisputeForm({ ...disputeForm, subject: event.target.value })} minLength="5" required />
                </label>
                <label>Details
                  <textarea value={disputeForm.description} onChange={(event) => setDisputeForm({ ...disputeForm, description: event.target.value })} minLength="10" required />
                </label>
                <button className="btn" disabled={busy === "dispute-create"}>Open dispute</button>
              </form>
            </section>
          </div>
        )}

        <section className="phase-five-panel">
          <div className="phase-five-section-head">
            <div><p>Reputation</p><h2>Verified reviews</h2></div>
            <span>{reviews.length} reviews</span>
          </div>
          <div className="phase-five-review-grid">
            {reviews.length ? reviews.map((review) => (
              <article key={review.id}>
                <div className="review-stars">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
                <p>{review.comment || "Rating submitted without a comment."}</p>
                <footer>
                  <span><strong>{review.reviewer_name}</strong> reviewed {review.reviewed_user_name}<small>Order #{review.order_id} · {review.crop_name}</small></span>
                  {user?.role === "admin" && <button className="btn small secondary" onClick={() => runAction(`review-${review.id}`, () => api.patch(`/trust/reviews/${review.id}/visibility`, { is_visible: !Boolean(review.is_visible) }))}>{review.is_visible ? "Hide" : "Restore"}</button>}
                </footer>
              </article>
            )) : <p className="phase-five-empty-text">No completed-order reviews yet.</p>}
          </div>
        </section>

        <section className="phase-five-panel">
          <div className="phase-five-section-head">
            <div><p>Case management</p><h2>Disputes</h2></div>
            <span>{disputes.length} cases</span>
          </div>
          <div className="phase-five-dispute-list">
            {disputes.length ? disputes.map((dispute) => (
              <article key={dispute.id}>
                <div className="record-card-head">
                  <div>
                    <small>Case #{dispute.id} · Order #{dispute.order_id} · {dispute.category}</small>
                    <h3>{dispute.subject}</h3>
                  </div>
                  <Phase5Status value={dispute.status} />
                </div>
                <p>{dispute.description}</p>
                <div className="dispute-parties">
                  Opened by <strong>{dispute.opened_by_name}</strong> against <strong>{dispute.against_user_name}</strong>
                  {dispute.assigned_to_name && <> · Admin: <strong>{dispute.assigned_to_name}</strong></>}
                </div>
                {dispute.resolution && <div className="phase-five-resolution"><strong>Resolution</strong>{dispute.resolution}</div>}
                <div className="dispute-message-list">
                  {(dispute.messages || []).map((item) => (
                    <div className={item.is_internal ? "internal" : ""} key={item.id}>
                      <strong>{item.sender_name} <span>{item.sender_role}</span></strong>
                      <p>{item.message}</p>
                      <time>{new Date(item.created_at).toLocaleString("en-IN")}{item.is_internal ? " · Internal note" : ""}</time>
                    </div>
                  ))}
                </div>
                <div className="phase-five-actions wrap">
                  {!["resolved", "rejected", "closed"].includes(dispute.status) && <button className="btn small secondary" onClick={() => addMessage(dispute)}>Add message</button>}
                  {user?.role === "admin" && <>
                    <button className="btn small secondary" onClick={() => addMessage(dispute, true)}>Internal note</button>
                    {dispute.status === "open" && <button className="btn small" onClick={() => updateDispute(dispute, "under_review")}>Start review</button>}
                    {["open", "under_review"].includes(dispute.status) && <>
                      <button className="btn small" onClick={() => updateDispute(dispute, "resolved")}>Resolve</button>
                      <button className="btn small danger" onClick={() => updateDispute(dispute, "rejected")}>Reject</button>
                    </>}
                    {dispute.status !== "closed" && <button className="btn small secondary" onClick={() => updateDispute(dispute, "closed")}>Close</button>}
                  </>}
                </div>
              </article>
            )) : <p className="phase-five-empty-text">No disputes found.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
