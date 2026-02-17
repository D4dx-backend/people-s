import { api } from '@/lib/api';

export interface ErrorLog {
  _id: string;
  errorType: string;
  message: string;
  stack?: string;
  statusCode: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  request?: {
    method: string;
    url: string;
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  };
  userId?: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  } | null;
  ipAddress?: string;
  userAgent?: string;
  fingerprint: string;
  occurrenceCount: number;
  firstOccurrence: string;
  lastOccurrence: string;
  isResolved: boolean;
  resolvedBy?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  resolvedAt?: string;
  resolutionNote?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  timestamp: string;
}

export interface ErrorLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  errorType?: string;
  severity?: string;
  statusCode?: string;
  isResolved?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface ErrorStats {
  totalErrors: number;
  totalOccurrences: number;
  unresolvedCount: number;
  resolvedCount: number;
  resolutionRate: string | number;
  byType: Array<{ _id: string; count: number; unique: number }>;
  bySeverity: Array<{ _id: string; count: number; unique: number }>;
  byStatus: Array<{ _id: number; count: number }>;
  dailyTrends: Array<{ _id: string; total: number; unique: number }>;
  topErrors: Array<{
    _id: string;
    message: string;
    errorType: string;
    severity: string;
    statusCode: number;
    occurrenceCount: number;
    firstOccurrence: string;
    lastOccurrence: string;
    request?: { url: string };
    isResolved: boolean;
  }>;
}

class ErrorLogService {
  private baseUrl = '/error-logs';

  async getErrorLogs(filters: ErrorLogFilters = {}): Promise<{ data: { errors: ErrorLog[]; pagination: { page: number; limit: number; total: number; pages: number } } }> {
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
      console.error('Failed to fetch error logs:', error);
      throw error;
    }
  }

  async getErrorStats(filters: Partial<ErrorLogFilters> = {}): Promise<{ data: ErrorStats }> {
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
      console.error('Failed to fetch error stats:', error);
      throw error;
    }
  }

  async getGroupedErrors(filters: Partial<ErrorLogFilters> = {}): Promise<{ data: { groups: any[] } }> {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      const response = await api.request<any>(`${this.baseUrl}/grouped?${queryParams.toString()}`);
      return { data: response.data };
    } catch (error) {
      console.error('Failed to fetch grouped errors:', error);
      throw error;
    }
  }

  async getErrorById(id: string) {
    try {
      const response = await api.request(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch error log:', error);
      throw error;
    }
  }

  async markResolved(id: string, note = '') {
    try {
      const response = await api.request(`${this.baseUrl}/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ note })
      });
      return response.data;
    } catch (error) {
      console.error('Failed to mark error as resolved:', error);
      throw error;
    }
  }

  async exportLogs(filters: ErrorLogFilters & { format?: 'json' | 'csv' } = {}) {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) throw new Error('VITE_API_URL environment variable is required');

      const response = await fetch(`${API_BASE_URL}/error-logs/export?${queryParams.toString()}`, {
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
        link.download = `error_logs_${new Date().toISOString().split('T')[0]}.csv`;
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
        link.download = `error_logs_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export error logs:', error);
      throw error;
    }
  }

  async cleanOldLogs(daysToKeep = 90) {
    try {
      const response = await api.request(`${this.baseUrl}/cleanup`, {
        method: 'DELETE',
        body: JSON.stringify({ daysToKeep })
      });
      return response.data;
    } catch (error) {
      console.error('Failed to clean old error logs:', error);
      throw error;
    }
  }
}

export const errorLogService = new ErrorLogService();
