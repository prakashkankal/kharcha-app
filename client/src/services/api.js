const rawApiUrl = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = rawApiUrl.endsWith('/api')
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/+$/, '')}/api`;

export const getReceiptUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const backendHost = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${backendHost}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const getAuthToken = () => {
  return localStorage.getItem('kharcha_token');
};

export const getRefreshToken = () => {
  return localStorage.getItem('kharcha_refresh_token');
};

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('kharcha_token', token);
  } else {
    localStorage.removeItem('kharcha_token');
  }
};

export const setRefreshToken = (token) => {
  if (token) {
    localStorage.setItem('kharcha_refresh_token', token);
  } else {
    localStorage.removeItem('kharcha_refresh_token');
  }
};

let refreshPromise = null;

const refreshSession = async (failedToken, signal) => {
  const currentToken = getAuthToken();
  if (currentToken && currentToken !== failedToken) return currentToken;
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshPromise = (async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal,
    });

    if (response.status === 401 || response.status === 403) {
      setAuthToken(null);
      setRefreshToken(null);
      return null;
    }
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.token || !data.refreshToken) {
      throw new Error('The server returned an invalid session refresh response');
    }

    setAuthToken(data.token);
    setRefreshToken(data.refreshToken);
    return data.token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
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

  const { timeoutMs, ...fetchOptions } = options;

  let controller = null;
  let timerId = null;

  if (timeoutMs) {
    controller = new AbortController();
    timerId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  try {
    const requestOptions = {
      ...fetchOptions,
      headers,
      signal: controller ? controller.signal : fetchOptions.signal,
    };

    let response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
    const canRefreshSession =
      token &&
      response.status === 401 &&
      (endpoint === '/auth/me' || !endpoint.startsWith('/auth/'));

    if (canRefreshSession) {
      const refreshedToken = await refreshSession(
        token,
        controller ? controller.signal : fetchOptions.signal
      );

      if (refreshedToken) {
        requestOptions.headers = {
          ...requestOptions.headers,
          Authorization: `Bearer ${refreshedToken}`,
        };
        response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
        if (response.status === 401) {
          setAuthToken(null);
          setRefreshToken(null);
        }
      }
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
  } finally {
    if (timerId) clearTimeout(timerId);
  }
};
