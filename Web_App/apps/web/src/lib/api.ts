const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

class ApiClient {
  private getHeaders(customHeaders: Record<string, string> = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('hrms_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const activeCompanyId = localStorage.getItem('hrms_active_company_id');
      if (activeCompanyId) {
        headers['x-company-id'] = activeCompanyId;
      }
    }

    return headers;
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          url.searchParams.append(key, String(params[key]));
        }
      });
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(res);
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(res);
  }

  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(res);
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(res);
  }

  async delete<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(res);
  }

  async download(endpoint: string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Download failed with status ${res.status}`);
    }

    return res.blob();
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = json?.message || json?.error || `Request failed with status ${res.status}`;
      throw new Error(Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg);
    }

    return (json?.data !== undefined ? json.data : json) as T;
  }
}

export const api = new ApiClient();
