import { useEffect, useState } from "react";
import { Link } from "../router";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";

const emptyFpo = {
  name: "",
  registration_number: "",
  district: "",
  state: "Bihar",
  address: "",
  description: "",
};

export default function FpoWorkspace() {
  const { user } = useAuth();
  const [fpo, setFpo] = useState(null);
  const [members, setMembers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [form, setForm] = useState(() => ({
    ...emptyFpo,
    district: user?.city || "",
    state: user?.state || "Bihar",
  }));
  const [inviteEmail, setInviteEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/fpos/my");
      setFpo(res.data.fpo || null);
      setMembers(res.data.members || []);
      setInventory(res.data.inventory || []);
      setInvitations(res.data.invitations || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load FPO workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const createFpo = async (event) => {
    event.preventDefault();
    try {
      setAction("create");
      setError("");
      await api.post("/fpos", form);
      setMessage("FPO workspace created successfully.");
      await loadWorkspace();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create FPO");
    } finally {
      setAction("");
    }
  };

  const respond = async (id, response) => {
    try {
      setAction(`invitation-${id}`);
      setError("");
      await api.patch(`/fpos/invitations/${id}`, { response });
      setMessage(`Invitation ${response === "accept" ? "accepted" : "declined"}.`);
      await loadWorkspace();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update invitation");
    } finally {
      setAction("");
    }
  };

  const invite = async (event) => {
    event.preventDefault();
    try {
      setAction("invite");
      setError("");
      await api.post(`/fpos/${fpo.id}/members`, { email: inviteEmail });
      setInviteEmail("");
      setMessage("Verified farmer invitation sent.");
      await loadWorkspace();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to invite farmer");
    } finally {
      setAction("");
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm("Remove this farmer from the FPO workspace?")) return;
    try {
      setAction(`remove-${userId}`);
      await api.delete(`/fpos/${fpo.id}/members/${userId}`);
      setMessage("Farmer removed from FPO.");
      await loadWorkspace();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member");
    } finally {
      setAction("");
    }
  };

  if (user?.verification_status !== "verified") {
    return (
      <main className="phase-three-page">
        <section className="phase-three-empty">
          <h1>Business verification required</h1>
          <p>Complete KYC verification before joining or managing an FPO.</p>
          <Link className="btn" to="/profile">Open Profile & KYC</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="phase-three-page">
      <div className="phase-three-container">
        <section className="phase-three-hero compact">
          <div>
            <p className="phase-three-kicker">👥 Farmer Collective</p>
            <h1>FPO <span>Workspace</span></h1>
            <p>Aggregate verified farmers, inventory and business capacity.</p>
          </div>
          <Link className="btn secondary" to="/business">Business Hub</Link>
        </section>

        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert error">{error}</div>}

        {invitations.length > 0 && (
          <section className="phase-three-panel invitation-panel">
            <div className="phase-three-section-head">
              <div><p>Pending Requests</p><h2>FPO Invitations</h2></div>
            </div>
            {invitations.map((item) => (
              <div className="invitation-row" key={item.id}>
                <div>
                  <strong>{item.fpo_name}</strong>
                  <span>{item.district}, {item.state} · invited by {item.invited_by}</span>
                </div>
                <div className="table-actions">
                  <button className="btn small" disabled={action === `invitation-${item.id}`} onClick={() => respond(item.id, "accept")}>Accept</button>
                  <button className="btn small secondary" disabled={action === `invitation-${item.id}`} onClick={() => respond(item.id, "decline")}>Decline</button>
                </div>
              </div>
            ))}
          </section>
        )}

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Loading FPO workspace...</p></div>
        ) : !fpo ? (
          <form className="phase-three-panel fpo-create-form" onSubmit={createFpo}>
            <div className="phase-three-section-head">
              <div><p>Start a Collective</p><h2>Create FPO Workspace</h2></div>
            </div>
            <div className="grid three">
              <div><label>FPO Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label>Registration Number</label><input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} required /></div>
              <div><label>District</label><input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required /></div>
              <div><label>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required /></div>
              <div className="full-width"><label>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="full-width"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <button className="btn" disabled={action === "create"}>{action === "create" ? "Creating..." : "Create FPO Workspace"}</button>
          </form>
        ) : (
          <>
            <section className="fpo-overview">
              <article className="fpo-identity-card">
                <span className="phase-three-status">{fpo.plan} plan</span>
                <h2>{fpo.name}</h2>
                <p>{fpo.registration_number}</p>
                <small>📍 {fpo.district}, {fpo.state}</small>
              </article>
              <article><span>Active Members</span><strong>{fpo.summary?.active_members || 0}</strong></article>
              <article><span>Available Products</span><strong>{fpo.summary?.active_products || 0}</strong></article>
              <article><span>Inventory Value</span><strong>₹{Number(fpo.summary?.inventory_value || 0).toLocaleString()}</strong></article>
            </section>

            {fpo.my_role === "manager" && (
              <form className="phase-three-panel member-invite-form" onSubmit={invite}>
                <div>
                  <p>Grow the collective</p>
                  <h2>Invite Verified Farmer</h2>
                </div>
                <input type="email" placeholder="farmer@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                <button className="btn" disabled={action === "invite"}>Send Invitation</button>
              </form>
            )}

            <section className="phase-three-panel">
              <div className="phase-three-section-head"><div><p>Collective Team</p><h2>FPO Members</h2></div><span>{members.length} records</span></div>
              <div className="phase-three-table-wrap">
                <table>
                  <thead><tr><th>Farmer</th><th>Business</th><th>Location</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.membership_id}>
                        <td><strong>{member.name}</strong><small>{member.email}</small></td>
                        <td>{member.business_name || "Independent farmer"}</td>
                        <td>{member.city || "-"}, {member.state || "-"}</td>
                        <td>{member.member_role}</td>
                        <td><span className={`deal-status ${member.status}`}>{member.status}</span></td>
                        <td>
                          {fpo.my_role === "manager" && member.member_role !== "manager" ? (
                            <button className="btn small danger" disabled={action === `remove-${member.user_id}`} onClick={() => removeMember(member.user_id)}>Remove</button>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="phase-three-panel">
              <div className="phase-three-section-head"><div><p>Aggregated Supply</p><h2>Member Inventory</h2></div><span>{inventory.length} products</span></div>
              <div className="phase-three-table-wrap">
                <table>
                  <thead><tr><th>Crop</th><th>Farmer</th><th>Stock</th><th>Price</th><th>Grade</th><th>Status</th></tr></thead>
                  <tbody>
                    {inventory.length ? inventory.map((product) => (
                      <tr key={product.id}>
                        <td><strong>{product.crop_name}</strong><small>{product.category}</small></td>
                        <td>{product.farmer_name}</td>
                        <td>{product.quantity} {product.unit}</td>
                        <td>₹{product.price_per_unit}/{product.unit}</td>
                        <td>{product.quality_grade}</td>
                        <td><span className={`deal-status ${product.status}`}>{product.status}</span></td>
                      </tr>
                    )) : <tr><td colSpan="6" className="empty-row">No collective inventory yet.</td></tr>}
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
