import { api } from '@/lib/api';

export interface LoginLog {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  } | null;
  userType: 'admin' | 'beneficiary';
  action: string;
  status: 'success' | 'failed';
  phone: string;
  ipAddress: string;
  userAgent?: string;
  device?: {
    type: string;
    os: string;
    osVersion: string;
    browser: string;
    browserVersion: string;
    deviceModel: string;
    deviceVendor: string;
  };
  location?: {
    country: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  failureReason?: string;
  otpDetails?: {
    requestedAt: string;
    verifiedAt: string;
    attempts: number;
    channel: string;
    purpose: string;
  };
  sessionId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface LoginLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  status?: string;
  userType?: string;
  userId?: string;
  phone?: string;
  ipAddress?: string;
  startDate?: string;
  endDate?: string;
  failureReason?: string;
  deviceType?: string;
}

export interface LoginStats {
  totalLogs: number;
  actionStats: Array<{
    _id: string;
    total: number;
    success: number;
    failed: number;
  }>;
  statusOverview: Array<{
    _id: string;
    count: number;
  }>;
  hourlyDistribution: Array<{
    _id: number;
    count: number;
    success: number;
    failed: number;
  }>;
  dailyTrends: Array<{
    _id: string;
    total: number;
    success: number;
    failed: number;
  }>;
}

export interface SuspiciousActivity {
  failedByIP: Array<{
    _id: string;
    count: number;
    failCount: number;
    phones: string[];
    lastAttempt: string;
    reasons: string[];
  }>;
  failedByPhone: Array<{
    _id: string;
    count: number;
    failCount: number;
    ips: string[];
    lastAttempt: string;
    reasons: string[];
  }>;
  otpAbuse: Array<{
    _id: string;
    count: number;
    lastRequest: string;
    ips: string[];
  }>;
  rapidOTPRequests: Array<{
    _id: { phone: string; hour: string };
    count: number;
    ips: string[];
  }>;
  summary: {
    suspiciousIPs: number;
    suspiciousPhones: number;
    rapidOTPAbuse: number;
    totalSuspicious: number;
  };
}

export interface DeviceBreakdown {
  byType: Array<{ _id: string; count: number }>;
  byOS: Array<{ _id: string; count: number }>;
  byBrowser: Array<{ _id: string; count: number }>;
}

export interface LocationBreakdown {
  byCountry: Array<{ _id: string; count: number }>;
  byCity: Array<{ _id: { city: string; country: string }; count: number }>;
}

class LoginLogService {
  private baseUrl = '/login-logs';

  async getLoginLogs(filters: LoginLogFilters = {}): Promise<{ data: { logs: LoginLog[]; pagination: { page: number; limit: number; total: number; pages: number } } }> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      const response = await api.request<any>(`${this.baseUrl}?${queryParams.toString()}`);
      return { data: response.data };
    } catch (error) {
      console.error('Failed to fetch login logs:', error);
      throw error;
    }
  }

  async getLoginStats(filters: Partial<LoginLogFilters> = {}): Promise<{ data: LoginStats }> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      const response = await api.request<any>(`${this.baseUrl}/stats?${queryParams.toString()}`);
      return { data: response.data };
    } catch (error) {
      console.error('Failed to fetch login stats:', error);
      throw error;
    }
  }

  async getSuspiciousActivity(params: { hours?: number; threshold?: number } = {}): Promise<{ data: SuspiciousActivity }> {
    try {
      const { hours = 24, threshold = 5 } = params;
      const response = await api.request<any>(`${this.baseUrl}/suspicious?hours=${hours}&failThreshold=${threshold}`);
      return { data: response.data };
    } catch (error) {
      console.error('Failed to fetch suspicious activity:', error);
      throw error;
    }
  }

  async getDeviceBreakdown(filters: Partial<LoginLogFilters> = {}): Promise<{ data: { breakdown: any[] } }> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      const response = await api.request<any>(`${this.baseUrl}/devices?${queryParams.toString()}`);
      return { data: response.data };
    } catch (error) {
      console.error('Failed to fetch device breakdown:', error);
      throw error;
    }
  }

  async getLocationBreakdown(filters: Partial<LoginLogFilters> = {}): Promise<{ data: { breakdown: any[] } }> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      const response = await api.request<any>(`${this.baseUrl}/locations?${queryParams.toString()}`);
      return { data: response.data };
    } catch (error) {
      console.error('Failed to fetch location breakdown:', error);
      throw error;
    }
  }

  async getOTPStats(filters: Partial<LoginLogFilters> = {}): Promise<{ data: any }> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      const response = await api.request<any>(`${this.baseUrl}/otp-stats?${queryParams.toString()}`);
      return { data: response.data };
    } catch (error) {
      console.error('Failed to fetch OTP stats:', error);
      throw error;
    }
  }

  async getUserLoginHistory(userId: string, page = 1, limit = 50) {
    try {
      const response = await api.request(`${this.baseUrl}/users/${userId}/history?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user login history:', error);
      throw error;
    }
  }

  async exportLogs(filters: LoginLogFilters & { format?: 'json' | 'csv' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) throw new Error('VITE_API_URL environment variable is required');

      const response = await fetch(`${API_BASE_URL}/login-logs/export?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);

      if (filters.format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `login_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        const dataStr = JSON.stringify(data.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `login_logs_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export login logs:', error);
      throw error;
    }
  }
}

export const loginLogService = new LoginLogService();
