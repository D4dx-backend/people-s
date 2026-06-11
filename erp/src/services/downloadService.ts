import { api } from '@/lib/api';

export interface DownloadTargeting {
  userRoles: string[];
  locationIds?: string[];
}

export interface DownloadItem {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  fileUrl: string;
  fileKey: string;
  fileName: string;
  mimetype?: string;
  size?: number;
  targeting?: DownloadTargeting;
  downloadCount?: number;
  isActive: boolean;
  createdBy?: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDownloadPayload {
  title: string;
  description?: string;
  category?: string;
  fileUrl: string;
  fileKey: string;
  fileName: string;
  mimetype?: string;
  size?: number;
  targeting: DownloadTargeting;
}

// Admin: list all downloads in the franchise
export const getDownloads = async (): Promise<DownloadItem[]> => {
  const response = await api.request<{ downloads: DownloadItem[] }>('/downloads');
  return response.data?.downloads || [];
};

// Files available to the current user (role/location gated)
export const getAvailableDownloads = async (): Promise<DownloadItem[]> => {
  const response = await api.request<{ downloads: DownloadItem[] }>('/downloads/available');
  return response.data?.downloads || [];
};

export const createDownload = async (payload: CreateDownloadPayload): Promise<DownloadItem | null> => {
  const response = await api.request<{ download: DownloadItem }>('/downloads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.data?.download ?? null;
};

export const updateDownload = async (
  id: string,
  payload: Partial<CreateDownloadPayload> & { isActive?: boolean },
): Promise<DownloadItem | null> => {
  const response = await api.request<{ download: DownloadItem }>(`/downloads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return response.data?.download ?? null;
};

export const deleteDownload = async (id: string): Promise<void> => {
  await api.request(`/downloads/${id}`, { method: 'DELETE' });
};

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};
