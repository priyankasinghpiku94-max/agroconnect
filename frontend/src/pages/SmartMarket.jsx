import { useEffect, useMemo, useState } from "react";
import api from "../api/api";
import { Link, useNavigate } from "../router";

const emptyAlert = {
  crop_name: "",
  category: "",
  city: "",
  direction: "below",
  target_price: "",
};

export default function SmartMarket() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [prices, setPrices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertForm, setAlertForm] = useState(emptyAlert);
  const [search, setSearch] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("hi-IN");
  const [voiceText, setVoiceText] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [matchRes, priceRes, alertRes] = await Promise.all([
        api.get("/intelligence/matches"),
        api.get("/intelligence/prices"),
        api.get("/intelligence/alerts"),
      ]);
      setMatches(matchRes.data.matches || []);
      setPrices(priceRes.data.insights || []);
      setAlerts(alertRes.data.alerts || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load smart market");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredPrices = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return prices;
    return prices.filter(
      (item) =>
        item.crop_name?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
    );
  }, [prices, search]);

  const createAlert = async (event) => {
    event.preventDefault();
    try {
      setAction("create-alert");
      const response = await api.post("/intelligence/alerts", alertForm);
      setMessage(response.data.message);
      setAlertForm(emptyAlert);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create alert");
    } finally {
      setAction("");
    }
  };

  const toggleAlert = async (alert) => {
    try {
      setAction(`alert-${alert.id}`);
      await api.patch(`/intelligence/alerts/${alert.id}`, {
        is_active: !Boolean(alert.is_active),
      });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update alert");
    } finally {
      setAction("");
    }
  };

  const deleteAlert = async (id) => {
    try {
      setAction(`alert-${id}`);
      await api.delete(`/intelligence/alerts/${id}`);
      setMessage("Price alert deleted");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete alert");
    } finally {
      setAction("");
    }
  };

  const interpretVoiceCommand = (transcript) => {
    const command = transcript.toLowerCase();
    const routes = [
      [["dashboard", "डैशबोर्ड"], "/dashboard"],
      [["marketplace", "बाजार", "मार्केट"], "/marketplace"],
      [["equipment", "tractor", "मशीन", "ट्रैक्टर"], "/expansion/equipment"],
      [["input", "seed", "fertilizer", "बीज", "खाद"], "/expansion/inputs"],
      [["collection", "कलेक्शन", "संग्रह"], "/expansion/collection-centres"],
      [["warehouse", "गोदाम"], "/business/warehouses"],
      [["order", "ऑर्डर"], "/orders"],
      [["demand", "मांग"], "/demands"],
      [["analytics", "रिपोर्ट", "एनालिटिक्स"], "/business/analytics"],
    ];
    const route = routes.find(([keywords]) =>
      keywords.some((keyword) => command.includes(keyword))
    );
    if (route) {
      setMessage(`Opening ${route[1]}`);
      navigate(route[1]);
      return;
    }

    const priceWords = ["price", "rate", "भाव", "कीमत"];
    if (priceWords.some((word) => command.includes(word))) {
      const ignored = [
        "price", "rate", "show", "check", "crop", "ka", "ki", "के", "का",
        "भाव", "कीमत", "दिखाओ", "बताओ",
      ];
      const crop = command
        .split(/\s+/)
        .filter((word) => !ignored.includes(word))
        .join(" ")
        .trim();
      setSearch(crop);
      setMessage(crop ? `Showing price data for “${crop}”` : "Showing market prices");
      document.getElementById("market-prices")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setMessage("Command heard. Try: “wheat price”, “open equipment” or “dashboard”.");
  };

  const startVoiceAssistant = () => {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice recognition is not supported in this browser. Use Chrome or Edge.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = voiceLanguage;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setListening(true);
      setError("");
      setVoiceText("Listening…");
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceText(transcript);
      interpretVoiceCommand(transcript);
    };
    recognition.onerror = (event) => {
      setError(`Voice assistant error: ${event.error}`);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <main className="phase-four-page smart-market-page">
      <div className="phase-four-container">
        <section className="phase-four-page-head">
          <div>
            <p className="phase-four-kicker">✨ Explainable market intelligence</p>
            <h1>Smart Market Assistant</h1>
            <p>Matches, market price trends, alerts and Hindi/English voice navigation.</p>
          </div>
          <Link className="btn secondary" to="/expansion">Expansion Hub</Link>
        </section>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <section className="voice-assistant-card">
          <div className={`voice-orb ${listening ? "listening" : ""}`}>🎙️</div>
          <div>
            <p className="phase-four-eyebrow">AgroSathi Voice</p>
            <h2>{listening ? "I’m listening…" : "Ask in Hindi or English"}</h2>
            <p>{voiceText || "Try “गेहूं का भाव”, “open equipment” or “dashboard”."}</p>
          </div>
          <select value={voiceLanguage} onChange={(e) => setVoiceLanguage(e.target.value)}>
            <option value="hi-IN">Hindi</option>
            <option value="en-IN">English (India)</option>
          </select>
          <button className="btn" onClick={startVoiceAssistant} disabled={listening}>
            {listening ? "Listening…" : "Start Voice"}
          </button>
        </section>

        {loading ? (
          <div className="phase-two-loading"><div className="loader"></div><p>Calculating smart matches...</p></div>
        ) : (
          <>
            <section className="phase-four-panel">
              <div className="phase-four-section-title">
                <div><span>Explainable recommendations</span><h2>Your Best Matches</h2></div>
                <b>{matches.length} suggestions</b>
              </div>
              <div className="smart-match-grid">
                {matches.length ? matches.map((match) => (
                  <article className="smart-match-card" key={match.id}>
                    <div className="match-score"><strong>{match.score}</strong><span>% match</span></div>
                    <p className="phase-four-eyebrow">{match.type.replaceAll("_", " ")}</p>
                    <h3>{match.title}</h3>
                    <p>{match.subtitle}</p>
                    {match.partner_name && <span className="match-partner">👤 {match.partner_name}</span>}
                    {match.location && <span className="match-partner">📍 {match.location}</span>}
                    <ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    <Link className="btn small" to={match.action_url}>View Opportunity</Link>
                  </article>
                )) : <div className="phase-four-empty">Add products or demands to receive smart matches.</div>}
              </div>
            </section>

            <section className="phase-four-two-column" id="market-prices">
              <div className="phase-four-panel">
                <div className="phase-four-section-title"><div><span>90-day snapshots</span><h2>Market Prices</h2></div></div>
                <input className="phase-four-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search crop or category" />
                <div className="price-insight-list">
                  {filteredPrices.length ? filteredPrices.map((item) => (
                    <article key={`${item.crop_name}-${item.unit}`}>
                      <div><strong>{item.crop_name}</strong><span>{item.category} · {item.sample_count} sample(s)</span></div>
                      <div className="price-main">₹{Number(item.current_average).toLocaleString()}<small>/{item.unit}</small></div>
                      <span className={`price-trend ${item.trend}`}>{item.trend === "rising" ? "↗" : item.trend === "falling" ? "↘" : "→"} {Math.abs(Number(item.trend_percent))}%</span>
                      <small>Range ₹{Number(item.lowest_price).toLocaleString()}–₹{Number(item.highest_price).toLocaleString()}</small>
                    </article>
                  )) : <div className="phase-four-empty">No matching price snapshots.</div>}
                </div>
              </div>

              <div className="phase-four-panel">
                <div className="phase-four-section-title"><div><span>Automatic notifications</span><h2>Price Alerts</h2></div></div>
                <form className="price-alert-form" onSubmit={createAlert}>
                  <div className="grid two">
                    <div><label>Crop Name</label><input value={alertForm.crop_name} onChange={(e) => setAlertForm({ ...alertForm, crop_name: e.target.value })} placeholder="Wheat" /></div>
                    <div><label>Category</label><select value={alertForm.category} onChange={(e) => setAlertForm({ ...alertForm, category: e.target.value })}><option value="">Any category</option><option>Vegetables</option><option>Fruits</option><option>Grains</option><option>Pulses</option><option>Spices</option></select></div>
                    <div><label>Notify when</label><select value={alertForm.direction} onChange={(e) => setAlertForm({ ...alertForm, direction: e.target.value })}><option value="below">Price falls below</option><option value="above">Price rises above</option></select></div>
                    <div><label>Target Price (₹)</label><input type="number" min="0.01" step="0.01" value={alertForm.target_price} onChange={(e) => setAlertForm({ ...alertForm, target_price: e.target.value })} required /></div>
                    <div className="full-width"><label>City (optional)</label><input value={alertForm.city} onChange={(e) => setAlertForm({ ...alertForm, city: e.target.value })} /></div>
                  </div>
                  <button className="btn small" disabled={action === "create-alert"}>Create Alert</button>
                </form>
                <div className="price-alert-list">
                  {alerts.map((alert) => (
                    <article key={alert.id}>
                      <div><strong>{alert.crop_name || alert.category}</strong><span>{alert.direction} ₹{alert.target_price}{alert.city ? ` · ${alert.city}` : ""}</span></div>
                      <span className={`deal-status ${alert.is_active ? "active" : "paused"}`}>{alert.is_active ? "active" : "paused"}</span>
                      <div className="table-actions">
                        <button className="btn small secondary" disabled={action === `alert-${alert.id}`} onClick={() => toggleAlert(alert)}>{alert.is_active ? "Pause" : "Activate"}</button>
                        <button className="btn small danger" disabled={action === `alert-${alert.id}`} onClick={() => deleteAlert(alert.id)}>Delete</button>
                      </div>
                    </article>
                  ))}
                  {!alerts.length && <div className="phase-four-empty">No price alerts created yet.</div>}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
