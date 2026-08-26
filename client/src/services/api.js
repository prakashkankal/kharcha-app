const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const getAuthToken = () => {
  return localStorage.getItem('kharcha_token');
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('kharcha_token', token);
  } else {
    localStorage.removeItem('kharcha_token');
  }
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If payload is FormData, let browser set Content-Type
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Session expired or invalid token
    setAuthToken(null);
  }

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    if (typeof data === 'object') {
      errorMsg = data.message || data.error || data.msg || JSON.stringify(data);
    } else if (typeof data === 'string' && data.length > 0 && data.length < 300) {
      errorMsg = data;
    }
    throw new Error(errorMsg);
  }

  return data;
};
