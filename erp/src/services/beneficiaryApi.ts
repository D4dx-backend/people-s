const API_BASE_URL = import.meta.env.VITE_API_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_URL environment variable is required');
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

interface OTPResponse {
  message: string;
  phone: string;
  expiresIn: number;
  developmentOTP?: string;
  developmentNote?: string;
  staticOTP?: string;
  note?: string;
}

interface LoginResponse {
  user: {
    id: string;
    name: string;
    phone: string;
    role: string;
    isVerified: boolean;
    profile: any;
  };
  token: string;
  message: string;
}

interface Scheme {
  _id: string;
  name: string;
  description: string;
  category: string;
  priority: string;
  project: {
    _id: string;
    name: string;
  };
  benefitType: string;
  maxAmount: number;
  benefitFrequency: string;
  benefitDescription: string;
  applicationDeadline: string;
  daysRemaining: number;
  requiresInterview: boolean;
  allowMultipleApplications: boolean;
  eligibilityCriteria: string[];
  beneficiariesCount: number;
  totalApplications: number;
  successRate: number;
  hasApplied: boolean;
  existingApplicationId?: string;
  existingApplicationStatus?: string;
  hasFormConfiguration: boolean;
  isUrgent: boolean;
  isPopular: boolean;
  isNew: boolean;
}

interface Application {
  _id: string;
  applicationId: string;
  scheme: {
    _id: string;
    name: string;
    category: string;
    maxAmount: number;
  };
  status: string;
  submittedAt: string;
  formData: any;
}

class BeneficiaryApiService {
  private getFranchiseSlug(): string {
    // Read the same env var that api.ts uses
    return (import.meta.env.VITE_FRANCHISE_SLUG as string | undefined) || '';
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('beneficiary_token');
    console.log('🔑 BeneficiaryApi - Getting auth headers');
    console.log('- Token exists:', !!token);
    
    if (!token) {
      console.error('❌ No token found in localStorage!');
      console.log('- All localStorage keys:', Object.keys(localStorage));
    } else {
      console.log('✅ Token found (first 30 chars):', token.substring(0, 30) + '...');
    }
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Always send franchise slug so the backend can identify the tenant
    const slug = this.getFranchiseSlug();
    if (slug) {
      headers['X-Franchise-Slug'] = slug;
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('✅ Authorization header will be:', `Bearer ${token.substring(0, 30)}...`);
    }
    
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'API request failed');
    }
    
    return data.data;
  }

  // Authentication methods
  async sendOTP(phone: string): Promise<OTPResponse> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ phone })
    });

    return this.handleResponse<OTPResponse>(response);
  }

  async verifyOTP(phone: string, otp: string): Promise<LoginResponse> {
    console.log('🔐 BeneficiaryApi - Verifying OTP');
    console.log('- Phone:', phone);
    console.log('- OTP:', otp);
    console.log('- API URL:', `${API_BASE_URL}/beneficiary/auth/verify-otp`);
    
    const response = await fetch(`${API_BASE_URL}/beneficiary/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ phone, otp })
    });

    console.log('- Response status:', response.status);
    console.log('- Response ok:', response.ok);
    
    const rawData = await response.json();
    console.log('- Raw response:', rawData);
    
    if (!response.ok) {
      throw new Error(rawData.message || `HTTP error! status: ${response.status}`);
    }
    
    if (!rawData.success) {
      throw new Error(rawData.message || 'API request failed');
    }
    
    const data = rawData.data;
    
    console.log('🔑 BeneficiaryApi - verifyOTP response:', {
      hasToken: !!data.token,
      tokenLength: data.token?.length,
      tokenPreview: data.token ? data.token.substring(0, 50) + '...' : 'null',
      user: data.user
    });
    
    // Store token and user data in localStorage
    if (data.token) {
      localStorage.setItem('beneficiary_token', data.token);
      localStorage.setItem('beneficiary_user', JSON.stringify(data.user));
      localStorage.setItem('user_role', 'beneficiary');
      localStorage.setItem('user_phone', phone);
      
      console.log('✅ Token and user data saved to localStorage');
      console.log('- Stored token (first 50 chars):', data.token.substring(0, 50) + '...');
      console.log('- Verify stored token:', localStorage.getItem('beneficiary_token')?.substring(0, 50) + '...');
    } else {
      console.error('❌ No token in response!');
    }
    
    return data;
  }

  async resendOTP(phone: string): Promise<OTPResponse> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    return this.handleResponse<OTPResponse>(response);
  }

  async getProfile(): Promise<{ user: any }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/auth/profile`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<{ user: any }>(response);
  }

  async updateProfile(profileData: any): Promise<{ user: any }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/auth/profile`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(profileData)
    });

    return this.handleResponse<{ user: any }>(response);
  }

  // Scheme methods
  async getAvailableSchemes(params?: {
    category?: string;
    search?: string;
  }): Promise<{ 
    schemes: Scheme[]; 
    total: number; 
    categories: string[];
    summary: {
      totalActive: number;
      notApplied: number;
      urgent: number;
      requireInterview: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.search) queryParams.append('search', params.search);

    const url = `${API_BASE_URL}/beneficiary/schemes?${queryParams.toString()}`;
    console.log('🔍 BeneficiaryApi - getAvailableSchemes');
    console.log('- URL:', url);
    console.log('- Headers:', this.getAuthHeaders());

    const response = await fetch(url, { headers: this.getAuthHeaders() });
    
    console.log('- Response status:', response.status);
    console.log('- Response ok:', response.ok);

    return this.handleResponse<{ 
      schemes: Scheme[]; 
      total: number; 
      categories: string[];
      summary: {
        totalActive: number;
        notApplied: number;
        urgent: number;
        requireInterview: number;
      };
    }>(response);
  }

  async getSchemeDetails(schemeId: string): Promise<{ scheme: Scheme & { hasApplied: boolean; existingApplicationId?: string } }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/schemes/${schemeId}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<{ scheme: Scheme & { hasApplied: boolean; existingApplicationId?: string } }>(response);
  }

  // Application methods
  async submitApplication(applicationData: {
    schemeId: string;
    formData: any;
    documents?: any[];
  }): Promise<{ application: Application }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(applicationData)
    });

    return this.handleResponse<{ application: Application }>(response);
  }

  // Draft methods
  async saveDraft(data: {
    schemeId: string;
    formData: any;
    documents?: any[];
    currentPage?: number;
    autoSave?: boolean;
  }): Promise<{ draft: { _id: string; applicationNumber: string; lastSavedAt: string } }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/draft`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  async updateDraft(draftId: string, data: {
    formData: any;
    documents?: any[];
    currentPage?: number;
    autoSave?: boolean;
  }): Promise<{ draft: { _id: string; applicationNumber: string; lastSavedAt: string } }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/draft/${draftId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse(response);
  }

  async getDraftForScheme(schemeId: string): Promise<{ draft: {
    _id: string;
    applicationNumber: string;
    formData: any;
    documents: any[];
    draftMetadata: { lastSavedAt: string; currentPage: number; completedPages: number[]; autoSaved: boolean };
    scheme: any;
    createdAt: string;
    updatedAt: string;
  } | null }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/draft/scheme/${schemeId}`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async deleteDraft(draftId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/draft/${draftId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    return this.handleResponse(response);
  }

  async getMyApplications(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    applications: Application[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = `${API_BASE_URL}/beneficiary/applications?${queryParams.toString()}`;
    const headers = this.getAuthHeaders();
    
    console.log('📋 BeneficiaryApi - getMyApplications');
    console.log('- URL:', url);
    console.log('- Headers:', headers);

    const response = await fetch(url, { headers });
    
    console.log('- Response status:', response.status);
    console.log('- Response ok:', response.ok);

    return this.handleResponse<{
      applications: Application[];
      pagination: {
        current: number;
        pages: number;
        total: number;
        limit: number;
      };
    }>(response);
  }

  async getApplicationDetails(applicationId: string): Promise<{ application: Application }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/${applicationId}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<{ application: Application }>(response);
  }

  async trackApplication(applicationId: string): Promise<{ application: Application }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/track/${applicationId}`, {
      headers: this.getAuthHeaders()
    });

    return this.handleResponse<{ application: Application }>(response);
  }

  async cancelApplication(applicationId: string, reason?: string): Promise<{ application: Application }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/${applicationId}/cancel`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason })
    });

    return this.handleResponse<{ application: Application }>(response);
  }

  async getApplicationStats(): Promise<{
    stats: {
      total: number;
      submitted: number;
      under_review: number;
      approved: number;
      rejected: number;
      completed: number;
      cancelled: number;
      totalApprovedAmount: number;
    };
  }> {
    const url = `${API_BASE_URL}/beneficiary/stats`;
    const headers = this.getAuthHeaders();
    
    console.log('📊 BeneficiaryApi - getApplicationStats');
    console.log('- URL:', url);
    console.log('- Headers:', headers);

    const response = await fetch(url, { headers });
    
    console.log('- Response status:', response.status);
    console.log('- Response ok:', response.ok);

    return this.handleResponse<{
      stats: {
        total: number;
        submitted: number;
        under_review: number;
        approved: number;
        rejected: number;
        completed: number;
        cancelled: number;
        totalApprovedAmount: number;
      };
    }>(response);
  }

  // Location methods
  async getLocations(params?: {
    type?: 'district' | 'area' | 'unit';
    parent?: string;
  }): Promise<{ locations: Array<{ _id: string; name: string; code: string; type: string; parent?: string }> }> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.parent) queryParams.append('parent', params.parent);

    const url = `${API_BASE_URL}/beneficiary/auth/locations?${queryParams.toString()}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() }
    });

    return this.handleResponse<{ locations: Array<{ _id: string; name: string; code: string; type: string; parent?: string }> }>(response);
  }

  // Utility methods
  async deleteAccount(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/auth/account`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    await this.handleResponse<void>(response);
    // Clear local session after successful deletion
    this.logout();
  }

  logout(): void {
    localStorage.removeItem('beneficiary_token');
    localStorage.removeItem('beneficiary_user');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_phone');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('beneficiary_token');
  }

  getCurrentUser(): any {
    const userStr = localStorage.getItem('beneficiary_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  // Renewal methods
  async getRenewalDueApplications(): Promise<{ applications: any[]; total: number }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/renewal-due`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse<{ applications: any[]; total: number }>(response);
  }

  async getRenewalForm(applicationId: string): Promise<{
    formConfiguration: any;
    prefillData: any;
    parentApplication: any;
    scheme: any;
  }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/${applicationId}/renewal-form`, {
      headers: this.getAuthHeaders()
    });
    return this.handleResponse<{
      formConfiguration: any;
      prefillData: any;
      parentApplication: any;
      scheme: any;
    }>(response);
  }

  async submitRenewal(applicationId: string, data: {
    formData: any;
    documents?: any[];
  }): Promise<{ application: any }> {
    const response = await fetch(`${API_BASE_URL}/beneficiary/applications/${applicationId}/renew`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return this.handleResponse<{ application: any }>(response);
  }
}

export const beneficiaryApi = new BeneficiaryApiService();
export default beneficiaryApi;