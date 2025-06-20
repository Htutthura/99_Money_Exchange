// API utility with authentication support
const API_BASE_URL = 'http://localhost:8000';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Get auth token from localStorage
  getAuthToken() {
    return localStorage.getItem('authToken');
  }

  // Get default headers with authentication
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Token ${token}`;
    }

    return headers;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: this.getHeaders(),
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        // Token might be expired or invalid
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.reload(); // Redirect to login
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // PATCH request
  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // File upload
  async uploadFile(endpoint, formData) {
    const token = this.getAuthToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Token ${token}`;
    }
    // Don't set Content-Type for FormData, let browser set it

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers,
    });
  }
}

// Create and export a singleton instance
const apiClient = new ApiClient();

// Specific API endpoints
export const authAPI = {
  login: (credentials) => apiClient.post('/api/v1/auth/login/', credentials),
  logout: () => apiClient.post('/api/v1/auth/logout/', {}),
  profile: () => apiClient.get('/api/v1/auth/profile/'),
};

export const transactionsAPI = {
  // Updated to use v1 API endpoints
  list: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiClient.get(`/api/v1/transactions/${queryString ? `?${queryString}` : ''}`);
  },
  create: (data) => apiClient.post('/api/v1/transactions/', data),
  update: (id, data) => apiClient.put(`/api/v1/transactions/${id}/`, data),
  delete: (id) => apiClient.delete(`/api/v1/transactions/${id}/`),
  profits: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiClient.get(`/api/v1/transactions/profits/${queryString ? `?${queryString}` : ''}`);
  },
  calculate: () => apiClient.post('/api/v1/transactions/calculate/', {}),
};

export const currenciesAPI = {
  list: () => apiClient.get('/api/v1/currencies/'),
  create: (data) => apiClient.post('/api/v1/currencies/', data),
  update: (id, data) => apiClient.put(`/api/v1/currencies/${id}/`, data),
  delete: (id) => apiClient.delete(`/api/v1/currencies/${id}/`),
};

export const exchangeRatesAPI = {
  list: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiClient.get(`/api/v1/exchange-rates/${queryString ? `?${queryString}` : ''}`);
  },
  latest: () => apiClient.get('/api/v1/exchange-rates/latest/'),
  create: (data) => apiClient.post('/api/v1/exchange-rates/', data),
  update: (id, data) => apiClient.put(`/api/v1/exchange-rates/${id}/`, data),
  delete: (id) => apiClient.delete(`/api/v1/exchange-rates/${id}/`),
};

// Legacy transaction API for backward compatibility
export const legacyTransactionsAPI = {
  list: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiClient.get(`/api/transactions/list/${queryString ? `?${queryString}` : ''}`);
  },
  calculateProfits: () => apiClient.post('/api/transactions/calculate_profits/', {}),
  export: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiClient.get(`/api/transactions/export/${queryString ? `?${queryString}` : ''}`);
  },
  currencies: () => apiClient.get('/api/transactions/currencies/'),
};

export default apiClient; 