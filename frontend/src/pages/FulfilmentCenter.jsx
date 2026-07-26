import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import Phase5Status from "../components/Phase5Status";

const shipmentTransitions = {
  booked: ["picked_up", "cancelled"],
  picked_up: ["in_transit", "failed"],
  in_transit: ["out_for_delivery", "failed"],
  out_for_delivery: ["delivered", "failed"],
  failed: ["in_transit", "cancelled"],
};

export default function FulfilmentCenter() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shipmentForm, setShipmentForm] = useState({
    order_id: "",
    carrier_name: "",
    tracking_number: "",
    pickup_address: user?.address || "",
    delivery_address: "",
    estimated_delivery: "",
  });
  const [inspectionForm, setInspectionForm] = useState({
    order_id: "",
    note: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const requests = [
        api.get("/fulfilment/shipments"),
        api.get("/fulfilment/inspections"),
      ];
      if (user?.role !== "admin") requests.push(api.get("/orders/my/list"));
      else requests.push(api.get("/admin/orders"));
      const [shipmentRes, inspectionRes, orderRes] = await Promise.all(requests);
      setShipments(shipmentRes.data.shipments || []);
      setInspections(inspectionRes.data.inspections || []);
      setOrders(orderRes.data.orders || []);
    } catch (err) {
      setError(err.response?.data?.message || "Fulfilment center could not be loaded");
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
      setNotice(response.data.message || "Fulfilment record updated");
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || "Fulfilment action failed");
    } finally {
      setBusy("");
    }
  };

  const createShipment = (event) => {
    event.preventDefault();
    if (!shipmentForm.order_id) return setError("Select an accepted order");
    runAction("shipment-create", () =>
      api.post(
        `/fulfilment/orders/${shipmentForm.order_id}/shipments`,
        shipmentForm
      )
    );
  };

  const updateShipment = (shipment, next) => {
    const location = window.prompt(
      "Current location (optional):",
      shipment.current_location || ""
    );
    if (location === null) return;
    const note = window.prompt("Milestone note (optional):", "") ?? "";
    runAction(`shipment-${shipment.id}-${next}`, () =>
      api.patch(`/fulfilment/shipments/${shipment.id}`, {
        status: next,
        location,
        note,
      })
    );
  };

  const requestInspection = (event) => {
    event.preventDefault();
    if (!inspectionForm.order_id) return setError("Select an order");
    runAction("inspection-request", () =>
      api.post(
        `/fulfilment/orders/${inspectionForm.order_id}/inspections`,
        inspectionForm
      )
    );
  };

  const scheduleInspection = (inspection) => {
    const inspectorName = window.prompt("Inspector name:");
    if (!inspectorName?.trim()) return;
    const scheduledDate = window.prompt("Schedule date (YYYY-MM-DD):");
    if (!scheduledDate?.trim()) return;
    runAction(`inspection-${inspection.id}-scheduled`, () =>
      api.patch(`/fulfilment/inspections/${inspection.id}`, {
        status: "scheduled",
        inspector_name: inspectorName,
        scheduled_date: scheduledDate,
      })
    );
  };

  const finishInspection = (inspection, status) => {
    const qualityGrade = window.prompt(
      "Quality grade: A, B, C, Standard or Rejected",
      status === "passed" ? "A" : "Rejected"
    );
    if (!qualityGrade) return;
    const moisture = window.prompt("Moisture percentage (optional):", "");
    if (moisture === null) return;
    const reportNote = window.prompt("Inspection report note:");
    if (!reportNote?.trim()) return;
    runAction(`inspection-${inspection.id}-${status}`, () =>
      api.patch(`/fulfilment/inspections/${inspection.id}`, {
        status,
        quality_grade: qualityGrade,
        moisture_percent: moisture,
        report_note: reportNote,
      })
    );
  };

  if (loading) {
    return <main className="phase-five-page"><div className="phase-five-loading"><div className="loader"></div><p>Loading fulfilment records...</p></div></main>;
  }

  return (
    <main className="phase-five-page">
      <div className="phase-five-container">
        <section className="phase-five-hero compact">
          <div>
            <p className="phase-five-kicker">Fulfilment Center</p>
            <h1>Shipment &amp; Quality <span>Control</span></h1>
            <p>Track every dispatch milestone and keep inspection results tied to the order.</p>
          </div>
          <button className="btn secondary" onClick={fetchData}>Refresh</button>
        </section>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        {(user?.role === "farmer" || user?.role === "admin") && (
          <section className="phase-five-panel split-panel">
            <div>
              <p className="phase-five-eyebrow">Seller dispatch</p>
              <h2>Create tracked shipment</h2>
              <p className="muted-copy">One shipment and one unique tracking number per accepted order.</p>
            </div>
            <form className="phase-five-form" onSubmit={createShipment}>
              <label>Order
                <select value={shipmentForm.order_id} onChange={(event) => setShipmentForm({ ...shipmentForm, order_id: event.target.value })} required>
                  <option value="">Select order</option>
                  {eligibleOrders.map((order) => <option key={order.id} value={order.id}>#{order.id} · {order.crop_name}</option>)}
                </select>
              </label>
              <label>Carrier
                <input value={shipmentForm.carrier_name} onChange={(event) => setShipmentForm({ ...shipmentForm, carrier_name: event.target.value })} required />
              </label>
              <label>Tracking number
                <input value={shipmentForm.tracking_number} onChange={(event) => setShipmentForm({ ...shipmentForm, tracking_number: event.target.value })} required />
              </label>
              <label>Estimated delivery
                <input type="date" value={shipmentForm.estimated_delivery} onChange={(event) => setShipmentForm({ ...shipmentForm, estimated_delivery: event.target.value })} />
              </label>
              <label className="wide">Pickup address
                <textarea value={shipmentForm.pickup_address} onChange={(event) => setShipmentForm({ ...shipmentForm, pickup_address: event.target.value })} required />
              </label>
              <label className="wide">Delivery address
                <textarea value={shipmentForm.delivery_address} onChange={(event) => setShipmentForm({ ...shipmentForm, delivery_address: event.target.value })} required />
              </label>
              <button className="btn" disabled={busy === "shipment-create"}>{busy === "shipment-create" ? "Creating..." : "Create shipment"}</button>
            </form>
          </section>
        )}

        <section className="phase-five-panel">
          <div className="phase-five-section-head">
            <div><p>Delivery operations</p><h2>Shipment tracking</h2></div>
            <span>{shipments.length} shipments</span>
          </div>
          <div className="phase-five-card-grid">
            {shipments.length ? shipments.map((shipment) => (
              <article className="phase-five-record-card" key={shipment.id}>
                <div className="record-card-head">
                  <div><small>{shipment.carrier_name}</small><h3>{shipment.tracking_number}</h3></div>
                  <Phase5Status value={shipment.status} />
                </div>
                <p>Order #{shipment.order_id} · {shipment.crop_name} · {shipment.quantity} {shipment.unit}</p>
                <dl className="phase-five-metrics two">
                  <div><dt>Location</dt><dd>{shipment.current_location || "Not updated"}</dd></div>
                  <div><dt>ETA</dt><dd>{shipment.estimated_delivery ? new Date(shipment.estimated_delivery).toLocaleDateString("en-IN") : "Not set"}</dd></div>
                </dl>
                {(user?.role === "farmer" || user?.role === "admin") && (
                  <div className="phase-five-actions wrap">
                    {(shipmentTransitions[shipment.status] || []).map((next) => (
                      <button key={next} className={next === "failed" || next === "cancelled" ? "btn small danger" : "btn small"} disabled={busy.startsWith(`shipment-${shipment.id}`)} onClick={() => updateShipment(shipment, next)}>
                        {next.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                )}
                <div className="phase-five-timeline">
                  {(shipment.events || []).map((event) => (
                    <div key={event.id}><span></span><p><strong>{event.status.replaceAll("_", " ")}</strong>{event.location && ` · ${event.location}`}<small>{event.note}</small></p></div>
                  ))}
                </div>
              </article>
            )) : <p className="phase-five-empty-text">No shipments created yet.</p>}
          </div>
        </section>

        {user?.role !== "admin" && (
          <section className="phase-five-panel split-panel">
            <div>
              <p className="phase-five-eyebrow">Independent evidence</p>
              <h2>Request quality inspection</h2>
              <p className="muted-copy">Either order participant can request one inspection.</p>
            </div>
            <form className="phase-five-inline-form vertical-mobile" onSubmit={requestInspection}>
              <select value={inspectionForm.order_id} onChange={(event) => setInspectionForm({ ...inspectionForm, order_id: event.target.value })} required>
                <option value="">Select order</option>
                {orders.filter((order) => order.status !== "rejected").map((order) => <option key={order.id} value={order.id}>#{order.id} · {order.crop_name}</option>)}
              </select>
              <input value={inspectionForm.note} onChange={(event) => setInspectionForm({ ...inspectionForm, note: event.target.value })} placeholder="Inspection requirement" />
              <button className="btn" disabled={busy === "inspection-request"}>Request inspection</button>
            </form>
          </section>
        )}

        <section className="phase-five-panel">
          <div className="phase-five-section-head">
            <div><p>Quality assurance</p><h2>Inspection records</h2></div>
            <span>{inspections.length} inspections</span>
          </div>
          <div className="phase-five-table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Parties</th><th>Schedule</th><th>Result</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {inspections.length ? inspections.map((inspection) => (
                  <tr key={inspection.id}>
                    <td>#{inspection.order_id}<small>{inspection.crop_name}</small></td>
                    <td>{inspection.farmer_name}<small>{inspection.distributor_name}</small></td>
                    <td>{inspection.inspector_name || "Not assigned"}<small>{inspection.scheduled_date ? new Date(inspection.scheduled_date).toLocaleDateString("en-IN") : "Not scheduled"}</small></td>
                    <td>{inspection.quality_grade || "Pending"}<small>{inspection.moisture_percent !== null ? `${inspection.moisture_percent}% moisture` : inspection.report_note}</small></td>
                    <td><Phase5Status value={inspection.status} /></td>
                    <td>
                      {user?.role === "admin" && ["requested", "scheduled"].includes(inspection.status) && <div className="phase-five-actions wrap">
                        {inspection.status === "requested" && <button className="btn small secondary" onClick={() => scheduleInspection(inspection)}>Schedule</button>}
                        <button className="btn small" onClick={() => finishInspection(inspection, "passed")}>Pass</button>
                        <button className="btn small danger" onClick={() => finishInspection(inspection, "failed")}>Fail</button>
                      </div>}
                      {user?.role !== "admin" && Number(inspection.requested_by) === Number(user?.id) && inspection.status === "requested" && <button className="btn small danger" onClick={() => runAction(`inspection-${inspection.id}-cancelled`, () => api.patch(`/fulfilment/inspections/${inspection.id}`, { status: "cancelled" }))}>Cancel</button>}
                    </td>
                  </tr>
                )) : <tr><td colSpan="6" className="empty-row">No inspections requested.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
