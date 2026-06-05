import axios from "axios";

const api = axios.create({
  baseURL: "https://megatools-v1.onrender.com/api",
  withCredentials: true,
  timeout: 15000,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Session expired for:', error.config?.url);
    }
    if (error.response?.status === 500) {
      console.error('Server error:', error.response?.data?.message || 'Unknown');
    }
    return Promise.reject(error);
  }
);

export default api;