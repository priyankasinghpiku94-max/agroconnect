import { db } from "../config/db.js";
import { buildWeatherAdvisory } from "../utils/weatherAdvisory.js";

const weatherBase =
  process.env.OPEN_METEO_FORECAST_URL || "https://api.open-meteo.com/v1";
const geocodingBase =
  process.env.OPEN_METEO_GEOCODING_URL ||
  "https://geocoding-api.open-meteo.com/v1";
const weatherApiKey = String(process.env.OPEN_METEO_API_KEY || "").trim();

const providerUrl = (base, path, parameters) => {
  const query = new URLSearchParams(parameters);
  if (weatherApiKey) query.set("apikey", weatherApiKey);
  return `${base}${path}?${query}`;
};

const fetchJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AgroConnect/1.0" },
    });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const jsonValue = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const searchLocations = async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();
    const language = req.query.language === "hi" ? "hi" : "en";
    if (query.length < 2 || query.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Enter at least 2 characters for location search",
      });
    }
    const data = await fetchJson(providerUrl(geocodingBase, "/search", {
      name: query,
      count: "8",
      language,
      format: "json",
    }));
    const locations = (data.results || []).map((item) => ({
      id: item.id,
      name: item.name,
      state: item.admin1 || "",
      country: item.country || "",
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone,
    }));
    res.json({ success: true, locations });
  } catch (error) {
    console.error("Location search error:", error);
    res.status(502).json({
      success: false,
      message: "Location service is temporarily unavailable",
    });
  }
};

export const getWeatherAdvisory = async (req, res) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const language = req.query.language === "hi" ? "hi" : "en";
    const label = String(req.query.label || "").trim().slice(0, 160);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required",
      });
    }
    const [cached] = await db.query(
      `
      SELECT *
      FROM weather_advisories
      WHERE userId = ?
        AND ABS(latitude - ?) < 0.001
        AND ABS(longitude - ?) < 0.001
        AND preferredLanguage = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
      ORDER BY id DESC
      LIMIT 1
      `,
      [req.user.id, latitude, longitude, language]
    );
    if (cached.length) {
      return res.json({
        success: true,
        cached: true,
        source: cached[0].source,
        observed_at: cached[0].observedAt,
        location_label: cached[0].locationLabel,
        weather: jsonValue(cached[0].weatherPayload),
        advisory: jsonValue(cached[0].advisoryPayload),
      });
    }

    try {
      const parameters = {
        latitude: String(latitude),
        longitude: String(longitude),
        current:
          "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        daily:
          "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
        timezone: "auto",
        forecast_days: "4",
      };
      const weather = await fetchJson(
        providerUrl(weatherBase, "/forecast", parameters)
      );
      if (!weather.current || !weather.daily) {
        throw new Error("Weather response is incomplete");
      }
      const advisory = buildWeatherAdvisory(weather, language);
      const observedAt = weather.current.time
        ? new Date(weather.current.time)
        : new Date();
      const safeObservedAt = Number.isNaN(observedAt.getTime())
        ? new Date()
        : observedAt;
      const [result] = await db.query(
        `
        INSERT INTO weather_advisories
        (
          userId, locationLabel, latitude, longitude, preferredLanguage,
          weatherPayload, advisoryPayload, source, observedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Open-Meteo', ?)
        `,
        [
          req.user.id,
          label || null,
          latitude,
          longitude,
          language,
          JSON.stringify(weather),
          JSON.stringify(advisory),
          safeObservedAt,
        ]
      );
      return res.json({
        success: true,
        cached: false,
        advisory_id: result.insertId,
        source: "Open-Meteo",
        observed_at: safeObservedAt,
        location_label: label,
        weather,
        advisory,
      });
    } catch (providerError) {
      const [fallback] = await db.query(
        `
        SELECT *
        FROM weather_advisories
        WHERE userId = ?
          AND ABS(latitude - ?) < 0.01
          AND ABS(longitude - ?) < 0.01
          AND preferredLanguage = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)
        ORDER BY id DESC
        LIMIT 1
        `,
        [req.user.id, latitude, longitude, language]
      );
      if (fallback.length) {
        return res.json({
          success: true,
          cached: true,
          stale: true,
          source: fallback[0].source,
          observed_at: fallback[0].observedAt,
          location_label: fallback[0].locationLabel,
          weather: jsonValue(fallback[0].weatherPayload),
          advisory: jsonValue(fallback[0].advisoryPayload),
        });
      }
      throw providerError;
    }
  } catch (error) {
    console.error("Weather advisory error:", error);
    res.status(502).json({
      success: false,
      message: "Weather advisory is temporarily unavailable",
    });
  }
};

export const getAdvisoryHistory = async (req, res) => {
  try {
    const [history] = await db.query(
      `
      SELECT
        id,
        locationLabel AS location_label,
        latitude,
        longitude,
        preferredLanguage AS preferred_language,
        advisoryPayload AS advisory,
        source,
        observedAt AS observed_at,
        created_at
      FROM weather_advisories
      WHERE userId = ?
      ORDER BY id DESC
      LIMIT 10
      `,
      [req.user.id]
    );
    res.json({
      success: true,
      history: history.map((item) => ({
        ...item,
        advisory: jsonValue(item.advisory),
      })),
    });
  } catch (error) {
    console.error("Advisory history error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch advisory history" });
  }
};
