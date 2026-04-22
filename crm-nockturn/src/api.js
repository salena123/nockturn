import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem("refreshToken");
      
      if (refreshToken) {
        try {
          const response = await axios.post('http://localhost:8000/api/auth/refresh', {
            refresh_token: refreshToken
          });

          const newToken = response.data.access_token;
          localStorage.setItem("token", newToken);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          window.location.reload();
        }
      } else {
        localStorage.removeItem("token");
        window.location.reload();
      }
    }

    return Promise.reject(error);
  }
);

export default api;