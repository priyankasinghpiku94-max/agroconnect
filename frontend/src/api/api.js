import axios from "axios";

/* =========================================================
   API BASE URL
========================================================= */

const ENV_API_URL = import.meta.env.VITE_API_URL?.trim();

const API_BASE_URL = (
  ENV_API_URL ||
  "https://agroconnect-backend-9nvp.onrender.com/api"
).replace(/\/+$/, "");

/* =========================================================
   AXIOS INSTANCE
========================================================= */

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,

  headers: {
    "Content-Type": "application/json",
  },

  withCredentials: true,
});

/* =========================================================
   REQUEST INTERCEPTOR
========================================================= */

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/* =========================================================
   RESPONSE INTERCEPTOR
========================================================= */

api.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    /* ---------------------------------------------
       401 - UNAUTHORIZED
    --------------------------------------------- */

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.dispatchEvent(
        new Event("agroconnect:unauthorized")
      );
    }

    return Promise.reject(error);
  }
);

/* =========================================================
   DEBUG
========================================================= */

console.log(
  "🌐 AgroConnect API:",
  API_BASE_URL
);

export default api;