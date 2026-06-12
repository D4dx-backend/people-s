import { api } from '@/lib/api';

export interface NotificationRecipient {
  user?: string;
  beneficiary?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  readAt?: string;
}

export interface NotificationEntity {
  application?: {
    _id: string;
    applicationNumber?: string;
    status?: string;
  };
  project?: {
    _id: string;
    name?: string;
  };
  scheme?: {
    _id: string;
    name?: string;
  };
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  htmlContent?: string;
  images?: { url: string; key?: string; caption?: string }[];
  linkUrl?: string;
  linkLabel?: string;
  type: 'sms' | 'email' | 'push' | 'in_app' | 'whatsapp';
  category: 'application_status' | 'payment' | 'reminder' | 'announcement' | 'alert' | 'system' | 'marketing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  recipients: NotificationRecipient[];
  relatedEntities?: NotificationEntity;
  targeting?: {
    userRoles?: string[];
    regions?: string[];
  };
  delivery?: {
    status?: string;
    totalRecipients?: number;
    sentCount?: number;
    readCount?: number;
  };
  createdBy?: {
    _id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastPayload {
  title: string;
  message: string;
  htmlContent?: string;
  images?: { url: string; key?: string; caption?: string }[];
  linkUrl?: string;
  linkLabel?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  targeting: {
    userRoles: string[];
    locationIds?: string[];
  };
}

export interface RecipientStats {
  total: number;
  read: number;
  unread: number;
}


export interface NotificationFilters {
  type?: string;
  category?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

// Get current user's notifications
export const getMyNotifications = async (filters: NotificationFilters = {}): Promise<Notification[]> => {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.category) params.append('category', filters.category);
  if (filters.unreadOnly) params.append('unreadOnly', 'true');
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.offset) params.append('offset', String(filters.offset));

  const queryStr = params.toString();
  const url = `/notifications/me${queryStr ? `?${queryStr}` : ''}`;
  const response = await api.request<{ notifications: Notification[] }>(url);
  return response.data?.notifications || [];
};

// Get unread notification count
export const getUnreadCount = async (): Promise<number> => {
  const response = await api.request<{ count: number }>('/notifications/me/count');
  return response.data?.count || 0;
};

// Mark a single notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  await api.request(`/notifications/${notificationId}/read`, { method: 'PATCH' });
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (): Promise<void> => {
  await api.request('/notifications/read-all', { method: 'PATCH' });
};

// Delete a notification
export const deleteNotification = async (notificationId: string): Promise<void> => {
  await api.request(`/notifications/${notificationId}`, { method: 'DELETE' });
};

// ── Admin broadcast management ──

// Create a broadcast (announcement) targeted at roles
export const createBroadcast = async (
  payload: BroadcastPayload,
): Promise<{ notification: Notification; recipientCount: number }> => {
  const response = await api.request<{ notification: Notification; recipientCount: number }>(
    '/notifications',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return response.data as { notification: Notification; recipientCount: number };
};

// List sent broadcasts
export const getSentNotifications = async (
  filters: { limit?: number; offset?: number } = {},
): Promise<Notification[]> => {
  const params = new URLSearchParams();
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.offset) params.append('offset', String(filters.offset));
  const queryStr = params.toString();
  const response = await api.request<{ notifications: Notification[] }>(
    `/notifications/sent${queryStr ? `?${queryStr}` : ''}`,
  );
  return response.data?.notifications || [];
};

// Get a single broadcast with stats
export const getNotificationById = async (
  id: string,
): Promise<{ notification: Notification; stats: RecipientStats } | null> => {
  const response = await api.request<{ notification: Notification; stats: RecipientStats }>(
    `/notifications/sent/${id}`,
  );
  return response.data ?? null;
};

// Update a broadcast
export const updateNotification = async (
  id: string,
  payload: Partial<BroadcastPayload>,
): Promise<Notification | null> => {
  const response = await api.request<{ notification: Notification }>(
    `/notifications/sent/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  );
  return response.data?.notification ?? null;
};

// Delete a broadcast for everyone
export const deleteSentNotification = async (id: string): Promise<void> => {
  await api.request(`/notifications/sent/${id}`, { method: 'DELETE' });
};


// Helper: get readable time ago string
export const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return date.toLocaleDateString('en-IN');
};

// Helper: get notification icon info based on category
export const getNotificationMeta = (category: string, priority: string) => {
  const meta: Record<string, { color: string; icon: string }> = {
    application_status: { color: 'text-blue-500', icon: 'FileText' },
    payment: { color: 'text-green-500', icon: 'CreditCard' },
    reminder: { color: 'text-yellow-500', icon: 'Clock' },
    announcement: { color: 'text-purple-500', icon: 'Megaphone' },
    alert: { color: 'text-red-500', icon: 'AlertTriangle' },
    system: { color: 'text-gray-500', icon: 'Settings' },
    marketing: { color: 'text-pink-500', icon: 'Star' },
  };

  return meta[category] || { color: 'text-gray-500', icon: 'Bell' };
};
