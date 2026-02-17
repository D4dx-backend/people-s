import { api } from '@/lib/api';
import type { ApiResponse, PaginatedResponse } from '@/lib/api';
import type { 
  DonorFollowUp, 
  FollowUpDashboardStats, 
  FollowUpFilters, 
  CreateFollowUpData 
} from '@/types/donorFollowUp';

class DonorFollowUpService {
  private baseUrl = '/donor-followups';

  // Dashboard stats
  async getDashboardStats(): Promise<ApiResponse<{ stats: FollowUpDashboardStats }>> {
    const response = await api.request(`${this.baseUrl}/dashboard`);
    return response.data || response;
  }

  // Get all follow-ups with filters
  async getAll(filters?: FollowUpFilters): Promise<PaginatedResponse<DonorFollowUp>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    const queryString = params.toString();
    const response = await api.request(`${this.baseUrl}${queryString ? `?${queryString}` : ''}`);
    return response.data || response;
  }

  // Get upcoming follow-ups
  async getUpcoming(days: number = 7): Promise<ApiResponse<{ followUps: DonorFollowUp[] }>> {
    const response = await api.request(`${this.baseUrl}/upcoming?days=${days}`);
    return response.data || response;
  }

  // Get overdue follow-ups
  async getOverdue(): Promise<ApiResponse<{ followUps: DonorFollowUp[] }>> {
    const response = await api.request(`${this.baseUrl}/overdue`);
    return response.data || response;
  }

  // Get lapsed donors
  async getLapsed(): Promise<ApiResponse<{ followUps: DonorFollowUp[] }>> {
    const response = await api.request(`${this.baseUrl}/lapsed`);
    return response.data || response;
  }

  // Get single follow-up
  async getById(id: string): Promise<ApiResponse<{ followUp: DonorFollowUp }>> {
    const response = await api.request(`${this.baseUrl}/${id}`);
    return response.data || response;
  }

  // Get follow-ups for a donor
  async getByDonor(donorId: string): Promise<ApiResponse<{ followUps: DonorFollowUp[] }>> {
    const response = await api.request(`${this.baseUrl}/by-donor/${donorId}`);
    return response.data || response;
  }

  // Create a follow-up
  async create(data: CreateFollowUpData): Promise<ApiResponse<{ followUp: DonorFollowUp }>> {
    const response = await api.request(this.baseUrl, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data || response;
  }

  // Update a follow-up
  async update(id: string, data: Partial<CreateFollowUpData>): Promise<ApiResponse<{ followUp: DonorFollowUp }>> {
    const response = await api.request(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data || response;
  }

  // Assign to staff
  async assign(id: string, assignedTo: string): Promise<ApiResponse<{ followUp: DonorFollowUp }>> {
    const response = await api.request(`${this.baseUrl}/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignedTo }),
    });
    return response.data || response;
  }

  // Mark as completed
  async complete(id: string, notes?: string): Promise<ApiResponse<{ followUp: DonorFollowUp }>> {
    const response = await api.request(`${this.baseUrl}/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
    return response.data || response;
  }

  // Cancel a follow-up
  async cancel(id: string, reason?: string): Promise<ApiResponse<{ followUp: DonorFollowUp }>> {
    const response = await api.request(`${this.baseUrl}/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    return response.data || response;
  }

  // Add a note
  async addNote(id: string, note: string): Promise<ApiResponse<{ followUp: DonorFollowUp }>> {
    const response = await api.request(`${this.baseUrl}/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    return response.data || response;
  }

  // Send a manual reminder
  async sendReminder(id: string, templateType?: string): Promise<ApiResponse<any>> {
    const response = await api.request(`${this.baseUrl}/${id}/send-reminder`, {
      method: 'POST',
      body: JSON.stringify({ templateType }),
    });
    return response.data || response;
  }

  // Send manual reminder to a donor (from donor page)
  async sendDonorReminder(donorId: string, templateType?: string): Promise<ApiResponse<any>> {
    const response = await api.request(`/donors/${donorId}/send-reminder`, {
      method: 'POST',
      body: JSON.stringify({ templateType }),
    });
    return response.data || response;
  }

  // Trigger manual processing
  async triggerProcessing(): Promise<ApiResponse<any>> {
    const response = await api.request(`${this.baseUrl}/process-reminders`, {
      method: 'POST',
    });
    return response.data || response;
  }
}

export const donorFollowUpService = new DonorFollowUpService();
