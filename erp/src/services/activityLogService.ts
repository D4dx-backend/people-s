import { api } from '@/lib/api';

export interface ActivityLogFilters {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  resource?: string;
  status?: string;
  severity?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  ipAddress?: string;
}

export interface ActivityLog {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  action: string;
  resource: string;
  resourceId?: string;
  description: string;
  details: any;
  ipAddress: string;
  userAgent?: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  status: 'success' | 'failed' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: {
    endpoint: string;
    method: string;
    statusCode: number;
    duration: number;
  };
  timestamp: string;
}

export interface ActivityLogResponse {
  success: boolean;
  message: string;
  data: {
    logs: ActivityLog[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface ActivityStats {
  totalLogs: number;
  actionStats: Array<{
    _id: string;
    count: number;
    lastActivity: string;
  }>;
  resourceStats: Array<{
    _id: string;
    count: number;
    lastActivity: string;
  }>;
  statusStats: Array<{
    _id: string;
    count: number;
  }>;
  severityStats: Array<{
    _id: string;
    count: number;
  }>;
  recentActivity: ActivityLog[];
}

export interface FilterOptions {
  actions: string[];
  resources: string[];
  statuses: string[];
  severities: string[];
}

class ActivityLogService {
  private baseUrl = '/activity-logs';

  /**
   * Get activity logs with filters and pagination
   */
  async getActivityLogs(filters: ActivityLogFilters = {}): Promise<ActivityLogResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await api.request(`${this.baseUrl}?${queryParams.toString()}`);
      return response as unknown as ActivityLogResponse;
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(filters: Partial<ActivityLogFilters> = {}): Promise<{ success: boolean; data: ActivityStats }> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await api.request(`${this.baseUrl}/stats?${queryParams.toString()}`);
      return response as unknown as { success: boolean; data: ActivityStats };
    } catch (error) {
      console.error('Failed to fetch activity stats:', error);
      throw error;
    }
  }

  /**
   * Get activity trends for charts
   */
  async getActivityTrends(period: string = '7d', groupBy: string = 'day'): Promise<any> {
    try {
      const response = await api.request(`${this.baseUrl}/trends?period=${period}&groupBy=${groupBy}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch activity trends:', error);
      throw error;
    }
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit: number = 10): Promise<{ success: boolean; data: ActivityLog[] }> {
    try {
      const response = await api.request(`${this.baseUrl}/recent?limit=${limit}`);
      return response as unknown as { success: boolean; data: ActivityLog[] };
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
      throw error;
    }
  }

  /**
   * Get filter options
   */
  async getFilterOptions(): Promise<{ success: boolean; data: FilterOptions }> {
    try {
      const response = await api.request(`${this.baseUrl}/filters`);
      return response as unknown as { success: boolean; data: FilterOptions };
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
      throw error;
    }
  }

  /**
   * Get activity log by ID
   */
  async getActivityLogById(id: string): Promise<{ success: boolean; data: ActivityLog }> {
    try {
      const response = await api.request(`${this.baseUrl}/${id}`);
      return response as unknown as { success: boolean; data: ActivityLog };
    } catch (error) {
      console.error('Failed to fetch activity log:', error);
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId: string, days: number = 30): Promise<any> {
    try {
      const response = await api.request(`${this.baseUrl}/users/${userId}/summary?days=${days}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch user activity summary:', error);
      throw error;
    }
  }

  /**
   * Export activity logs
   */
  async exportLogs(filters: ActivityLogFilters & { format?: 'json' | 'csv' } = {}): Promise<void> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) {
        throw new Error('VITE_API_URL environment variable is required');
      }
      const response = await fetch(`${API_BASE_URL}/activity-logs/export?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      if (filters.format === 'csv') {
        // Handle CSV download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        // Handle JSON download
        const data = await response.json();
        const dataStr = JSON.stringify(data.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `activity_logs_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export activity logs:', error);
      throw error;
    }
  }

  /**
   * Clean old logs (admin only)
   */
  async cleanOldLogs(daysToKeep: number = 365): Promise<any> {
    try {
      const response = await api.request(`${this.baseUrl}/cleanup`, {
        method: 'DELETE',
        body: JSON.stringify({ daysToKeep })
      });
      return response;
    } catch (error) {
      console.error('Failed to clean old logs:', error);
      throw error;
    }
  }
}

export const activityLogService = new ActivityLogService();