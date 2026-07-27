import { useEffect, useState } from "react";
import api from "../api/api";

const weatherIcon = (code) => {
  if ([0].includes(Number(code))) return "☀️";
  if ([1, 2, 3].includes(Number(code))) return "⛅";
  if ([45, 48].includes(Number(code))) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(Number(code))) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(Number(code))) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(Number(code))) return "❄️";
  if ([95, 96, 99].includes(Number(code))) return "⛈️";
  return "🌤️";
};

export default function WeatherAdvisory() {
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [language, setLanguage] = useState("en");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    try {
      const response = await api.get("/advisory/history");
      setHistory(response.data.history || []);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const searchLocation = async (event) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/advisory/locations", {
        params: { query: query.trim(), language },
      });
      setLocations(response.data.locations || []);
    } catch (err) {
      setError(err.response?.data?.message || "Location search failed");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvisory = async (location) => {
    try {
      setLoading(true);
      setError("");
      setSelected(location);
      setLocations([]);
      const label = [location.name, location.state, location.country]
        .filter(Boolean)
        .join(", ");
      const response = await api.get("/advisory/weather", {
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
          label,
          language,
        },
      });
      setResult(response.data);
      await loadHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Weather advisory failed");
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser. Search your city instead.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        fetchAdvisory({
          name: "Current location",
          state: "",
          country: "",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setError("Location permission was not granted. Search your city instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const daily = result?.weather?.daily;
  const summary = result?.advisory?.summary;

  return (
    <main className="phase-six-page">
      <div className="phase-six-container">
        <section className="phase-six-page-head weather-head">
          <div>
            <p className="phase-six-kicker">Live, explainable decision support</p>
            <h1>Weather &amp; Crop Advisory</h1>
            <p>Search a city or use browser location for a live forecast and cached fallback.</p>
          </div>
          <div className="weather-language">
            <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
            <button className={language === "hi" ? "active" : ""} onClick={() => setLanguage("hi")}>हिन्दी</button>
          </div>
        </section>

        <section className="weather-search-panel">
          <form onSubmit={searchLocation}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search city, e.g. Patna" />
            <button className="btn" disabled={loading}>Search</button>
          </form>
          <button className="btn secondary" onClick={useCurrentLocation} disabled={locating}>
            {locating ? "Locating…" : "Use Current Location"}
          </button>
          {locations.length > 0 && (
            <div className="weather-location-results">
              {locations.map((location) => (
                <button key={`${location.id}-${location.latitude}`} onClick={() => fetchAdvisory(location)}>
                  <strong>{location.name}</strong>
                  <span>{[location.state, location.country].filter(Boolean).join(", ")}</span>
                </button>
              ))}
            </div>
          )}
        </section>
        <div className="weather-privacy-note">
          Coordinates are sent to Open-Meteo for the forecast. Production
          commercial usage must use an appropriate provider plan and credentials.
        </div>
        {error && <div className="alert error">{error}</div>}

        {loading && !result ? (
          <div className="phase-six-loading"><div className="loader"></div><p>Reading forecast and preparing advisory...</p></div>
        ) : result && (
          <>
            <section className="weather-overview">
              <article className="weather-current-card">
                <div>
                  <span className="weather-main-icon">{weatherIcon(result.weather?.current?.weather_code)}</span>
                  <div>
                    <p>{result.location_label || selected?.name}</p>
                    <strong>{summary?.temperature_c ?? "—"}°C</strong>
                  </div>
                </div>
                <span className="weather-source">
                  {result.stale ? "Cached fallback" : result.cached ? "Cached forecast" : "Live forecast"} · {result.source}
                </span>
              </article>
              <article><span>Humidity</span><strong>{summary?.humidity_percent ?? "—"}%</strong></article>
              <article><span>Wind</span><strong>{summary?.wind_kmh ?? "—"} km/h</strong></article>
              <article><span>3-day rain</span><strong>{summary?.next_3_days_rain_mm ?? "—"} mm</strong></article>
            </section>

            <section className="weather-advisory-layout">
              <div className="phase-six-panel">
                <div className="phase-six-section-head"><div><p>Risk assessment</p><h2>Field Alerts</h2></div></div>
                <div className="weather-alert-list">
                  {(result.advisory?.alerts || []).map((alert, index) => (
                    <article className={`risk-${alert.level}`} key={`${alert.title}-${index}`}>
                      <span>{alert.level === "high" ? "!" : alert.level === "medium" ? "•" : "✓"}</span>
                      <div><h3>{alert.title}</h3><p>{alert.body}</p></div>
                    </article>
                  ))}
                </div>
                <div className="crop-suggestion">
                  <span>🌱</span>
                  <div><strong>{language === "hi" ? "फसल सुझाव" : "Crop planning signal"}</strong><p>{result.advisory?.crop_suggestion}</p></div>
                </div>
                <p className="advisory-disclaimer">{result.advisory?.disclaimer}</p>
              </div>

              <div className="phase-six-panel">
                <div className="phase-six-section-head"><div><p>Four-day outlook</p><h2>Forecast</h2></div></div>
                <div className="daily-forecast-list">
                  {(daily?.time || []).map((date, index) => (
                    <article key={date}>
                      <div><span>{weatherIcon(daily.weather_code?.[index])}</span><strong>{new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</strong></div>
                      <p>{daily.temperature_2m_min?.[index]}° – {daily.temperature_2m_max?.[index]}°</p>
                      <small>Rain {daily.precipitation_sum?.[index]} mm · Wind {daily.wind_speed_10m_max?.[index]} km/h</small>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        <section className="phase-six-panel advisory-history-panel">
          <div className="phase-six-section-head"><div><p>Recent checks</p><h2>Advisory History</h2></div><span>{history.length} records</span></div>
          <div className="advisory-history-list">
            {history.map((item) => (
              <article key={item.id}>
                <div><strong>{item.location_label || `${item.latitude}, ${item.longitude}`}</strong><small>{new Date(item.created_at).toLocaleString("en-IN")} · {item.preferred_language.toUpperCase()}</small></div>
                <span>{item.advisory?.alerts?.[0]?.title || "Weather advisory"}</span>
              </article>
            ))}
            {!history.length && <p className="phase-six-empty">Your recent weather checks will appear here.</p>}
          </div>
        </section>
        <p className="weather-attribution">
          Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>.
        </p>
      </div>
    </main>
  );
}
