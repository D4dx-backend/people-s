// API Base URL - must come from environment variable
// No fallback allowed for production safety
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    'VITE_API_URL environment variable is required. ' +
    'Please set it in your .env file or build configuration. ' +
    'No fallback values are allowed for security and configuration clarity.'
  );
}

// Types
export interface User {
  id: string;
  name: string;
  email?: string; // Made optional
  phone: string;
  role: string;
  adminScope?: {
    level: string;
    regions: string[];
    district?: string;  // District reference
    area?: string;      // Area reference (for area_admin and unit_admin)
    unit?: string;      // Unit reference (for unit_admin)
    projects: string[];
    schemes: string[];
  };
  profile?: any;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  priority: string;
  scope: string;
  status: string;
  startDate: string;
  endDate: string;
  budget: {
    total: number;
    allocated: number;
    spent: number;
    currency: string;
  };
  progress: {
    percentage: number;
    milestones: Array<{
      name: string;
      description: string;
      targetDate: string;
      completedDate?: string;
      status: string;
    }>;
  };
  coordinator?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  targetRegions: Array<{
    id: string;
    name: string;
    type: string;
    code: string;
  }>;
  targetBeneficiaries: {
    estimated: number;
    actual: number;
  };
  budgetUtilization: number;
  remainingBudget: number;
  daysRemaining: number;
}

export interface Scheme {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  project: {
    id: string;
    name: string;
    code: string;
    description: string;
  };
  targetRegions: Array<{
    id: string;
    name: string;
    type: string;
    code: string;
  }>;
  eligibility: {
    ageRange?: {
      min?: number;
      max?: number;
    };
    gender?: string;
    incomeLimit?: number;
    familySize?: {
      min?: number;
      max?: number;
    };
    educationLevel?: string;
    employmentStatus?: string;
    documents: Array<{
      type: string;
      required: boolean;
      description: string;
    }>;
  };
  budget: {
    total: number;
    allocated: number;
    spent: number;
    currency: string;
  };
  benefits: {
    type: string;
    amount?: number;
    frequency: string;
    duration?: number;
    description: string;
  };
  applicationSettings: {
    startDate: string;
    endDate: string;
    maxApplications: number;
    maxBeneficiaries?: number;
    autoApproval: boolean;
    requiresInterview: boolean;
    allowMultipleApplications: boolean;
  };
  distributionTimeline: Array<{
    description: string;
    percentage: number;
    daysFromApproval: number;
    requiresVerification: boolean;
    notes?: string;
  }>;
  statusStages: Array<{
    name: string;
    description?: string;
    order: number;
    isRequired: boolean;
    allowedRoles: string[];
    autoTransition: boolean;
    transitionConditions?: string;
  }>;
  statistics: {
    totalApplications: number;
    approvedApplications: number;
    rejectedApplications: number;
    pendingApplications: number;
    totalBeneficiaries: number;
    totalAmountDisbursed: number;
  };
  budgetUtilization: number;
  remainingBudget: number;
  successRate: number;
  daysRemainingForApplication: number;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// API Client Class
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token'); // Use 'token' to match useAuth hook
  }

  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Always get the latest token from localStorage (don't rely on cached this.token)
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      this.token = currentToken; // Update cached token
      headers.Authorization = `Bearer ${currentToken}`;
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    const headers = new Headers(this.getHeaders());
    if (options.headers) {
      const optionHeaders = new Headers(options.headers as HeadersInit);
      optionHeaders.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    // If sending FormData, let the browser set the correct multipart boundary.
    // Keeping 'Content-Type: application/json' causes the backend to try JSON parsing and fail.
    if (options.body instanceof FormData) {
      headers.delete('Content-Type');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle authentication errors - but don't clear token automatically
        // Let the calling component decide what to do
        if (response.status === 401 || response.status === 403) {
          const error = new Error(data.message || 'Authentication failed. Please login again.');
          (error as any).status = response.status;
          (error as any).isAuthError = true;
          throw error;
        }
        
        // Handle validation errors with detailed messages
        if (response.status === 400 && data.errors && Array.isArray(data.errors)) {
          const validationMessages = data.errors.map((err: any) => 
            `${err.field}: ${err.message}`
          ).join(', ');
          const error = new Error(validationMessages || data.message || 'Validation failed');
          (error as any).validationErrors = data.errors;
          throw error;
        }
        
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Authentication Methods
  async requestOTP(phone: string, purpose: string = 'login'): Promise<ApiResponse<{
    expiresAt: string;
    attemptsRemaining: number;
    developmentOTP?: string;
  }>> {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose }),
    });
  }

  async verifyOTP(phone: string, otp: string, purpose: string = 'login'): Promise<ApiResponse<{
    user: User;
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
    loginMethod: string;
  }>> {
    const response = await this.request<{
      user: User;
      tokens: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };
      loginMethod: string;
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, purpose }),
    });

    if (response.success && response.data) {
      // Handle the nested tokens structure from backend
      const accessToken = response.data.tokens?.accessToken;
      if (accessToken) {
        this.token = accessToken;
        localStorage.setItem('token', this.token); // Use 'token' to match useAuth hook
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
    }

    return response;
  }

  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    return this.request('/auth/me');
  }

  async updateProfile(data: any): Promise<ApiResponse<{ user: User }>> {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string | null, newPassword: string): Promise<ApiResponse<null>> {
    const body: any = { newPassword };
    if (currentPassword) body.currentPassword = currentPassword;
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.token = null;
      // Clear admin tokens
      localStorage.removeItem('token'); // Use 'token' to match useAuth hook
      localStorage.removeItem('user');
      localStorage.removeItem('refreshToken');
      // Also clear any beneficiary data that might be lingering
      localStorage.removeItem('beneficiary_token');
      localStorage.removeItem('beneficiary_user');
      localStorage.removeItem('user_role');
    }
  }

  // Project Methods
  async getProjects(params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
  }): Promise<ApiResponse<{
    projects: Project[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/projects${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async getProject(id: string): Promise<ApiResponse<{ project: Project }>> {
    return this.request(`/projects/${id}`);
  }

  async createProject(projectData: Partial<Project>): Promise<ApiResponse<{ project: Project }>> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async updateProject(id: string, projectData: Partial<Project>): Promise<ApiResponse<{ project: Project }>> {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData),
    });
  }

  async deleteProject(id: string): Promise<ApiResponse<null>> {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async getProjectStats(): Promise<ApiResponse<{
    overview: {
      totalProjects: number;
      totalBudget: number;
      totalAllocated: number;
      totalSpent: number;
      activeProjects: number;
      completedProjects: number;
      totalBeneficiaries: number;
    };
    byCategory: Array<{
      _id: string;
      count: number;
      totalBudget: number;
      totalBeneficiaries: number;
    }>;
    byStatus: Array<{
      _id: string;
      count: number;
    }>;
  }>> {
    return this.request('/projects/stats');
  }

  // Scheme Methods
  async getSchemes(params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    project?: string;
    priority?: string;
    search?: string;
  }): Promise<ApiResponse<{
    schemes: Scheme[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/schemes${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async getScheme(id: string): Promise<ApiResponse<{ scheme: Scheme }>> {
    return this.request(`/schemes/${id}`);
  }

  async createScheme(schemeData: Partial<Scheme>): Promise<ApiResponse<{ scheme: Scheme }>> {
    return this.request('/schemes', {
      method: 'POST',
      body: JSON.stringify(schemeData),
    });
  }

  async updateScheme(id: string, schemeData: Partial<Scheme>): Promise<ApiResponse<{ scheme: Scheme }>> {
    return this.request(`/schemes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(schemeData),
    });
  }

  async deleteScheme(id: string): Promise<ApiResponse<null>> {
    return this.request(`/schemes/${id}`, {
      method: 'DELETE',
    });
  }

  async getSchemeStats(): Promise<ApiResponse<{
    overview: {
      totalSchemes: number;
      totalBudget: number;
      totalAllocated: number;
      totalSpent: number;
      activeSchemes: number;
      totalApplications: number;
      totalBeneficiaries: number;
      totalAmountDisbursed: number;
    };
    byCategory: Array<{
      _id: string;
      count: number;
      totalBudget: number;
      totalBeneficiaries: number;
    }>;
    byStatus: Array<{
      _id: string;
      count: number;
    }>;
  }>> {
    return this.request('/schemes/stats');
  }

  async getActiveSchemes(): Promise<ApiResponse<{ schemes: Scheme[] }>> {
    return this.request('/schemes/active');
  }

  // Form Configuration Methods
  async getFormConfiguration(schemeId: string): Promise<ApiResponse<{ formConfiguration: any; hasConfiguration: boolean }>> {
    return this.request(`/schemes/${schemeId}/form-config`);
  }

  async updateFormConfiguration(schemeId: string, config: any): Promise<ApiResponse<{ formConfiguration: any }>> {
    return this.request(`/schemes/${schemeId}/form-config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // User Methods
  async getUsers(params?: {
    page?: number;
    limit?: number;
    role?: string;
    search?: string;
  }): Promise<ApiResponse<{
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/users${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  // Utility Methods
  isAuthenticated(): boolean {
    // Always check localStorage for the latest token
    const currentToken = this.token || localStorage.getItem('token'); // Use 'token' to match useAuth hook
    return !!currentToken;
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('token', token); // Use 'token' to match useAuth hook
  }

  // Enhanced User Methods
  async getUserStats(): Promise<ApiResponse<{
    overview: {
      totalUsers: number;
      activeUsers: number;
      verifiedUsers: number;
    };
    byRole: Array<{
      _id: string;
      count: number;
      active: number;
    }>;
    byRegion: Array<{
      _id: {
        regionId: string;
        regionName: string;
        regionType: string;
      };
      userCount: number;
    }>;
  }>> {
    return this.request('/users/statistics');
  }

  async getUsersByRole(role: string): Promise<ApiResponse<{ users: User[] }>> {
    return this.request(`/users/role/${role}`);
  }

  async getUserById(id: string): Promise<ApiResponse<{ user: User }>> {
    return this.request(`/users/${id}`);
  }

  async createUser(userData: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<ApiResponse<null>> {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleUserStatus(id: string, isActive: boolean): Promise<ApiResponse<{ user: User }>> {
    return this.request(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  }

  async resetUserPassword(id: string, newPassword: string): Promise<ApiResponse<null>> {
    return this.request(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async assignRole(id: string, role: string, adminScope?: any): Promise<ApiResponse<{ user: User }>> {
    return this.request(`/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role, adminScope }),
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Helper to build export URL with query params
function buildExportUrl(basePath: string, params?: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
  }
  const qs = searchParams.toString();
  return `${basePath}${qs ? `?${qs}` : ''}`;
}

// Export convenience methods
export const auth = {
  requestOTP: (phone: string, purpose?: string) => apiClient.requestOTP(phone, purpose),
  verifyOTP: (phone: string, otp: string, purpose?: string) => apiClient.verifyOTP(phone, otp, purpose),
  getProfile: () => apiClient.getProfile(),
  updateProfile: (data: any) => apiClient.updateProfile(data),
  changePassword: (currentPassword: string | null, newPassword: string) => apiClient.changePassword(currentPassword, newPassword),
  logout: () => apiClient.logout(),
  isAuthenticated: () => apiClient.isAuthenticated(),
  getCurrentUser: () => apiClient.getCurrentUser(),
};

export const projects = {
  getAll: (params?: any) => apiClient.getProjects(params),
  getById: (id: string) => apiClient.getProject(id),
  create: (data: Partial<Project>) => apiClient.createProject(data),
  update: (id: string, data: Partial<Project>) => apiClient.updateProject(id, data),
  delete: (id: string) => apiClient.deleteProject(id),
  getStats: () => apiClient.getProjectStats(),
  export: (params?: any) => extendedApiClient.request(buildExportUrl('/projects/export', params)),
};

export const schemes = {
  getAll: (params?: any) => apiClient.getSchemes(params),
  getById: (id: string) => apiClient.getScheme(id),
  create: (data: Partial<Scheme>) => apiClient.createScheme(data),
  update: (id: string, data: Partial<Scheme>) => apiClient.updateScheme(id, data),
  delete: (id: string) => apiClient.deleteScheme(id),
  getStats: () => apiClient.getSchemeStats(),
  getActive: () => apiClient.getActiveSchemes(),
  getFormConfig: (id: string) => apiClient.getFormConfiguration(id),
  updateFormConfig: (id: string, config: any) => apiClient.updateFormConfiguration(id, config),
  publishForm: (id: string, data: { isPublished: boolean }) => apiClient.request(`/schemes/${id}/form-config/publish`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  // Renewal form config
  getRenewalFormConfig: (schemeId: string) => extendedApiClient.request(`/form-configurations/schemes/${schemeId}/renewal-form-config`),
  updateRenewalFormConfig: (schemeId: string, config: any) => extendedApiClient.request(`/form-configurations/schemes/${schemeId}/renewal-form-config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  }),
  deleteRenewalFormConfig: (schemeId: string) => extendedApiClient.request(`/form-configurations/schemes/${schemeId}/renewal-form-config`, {
    method: 'DELETE',
  }),
  export: (params?: any) => extendedApiClient.request(buildExportUrl('/schemes/export', params)),
};

export const users = {
  getAll: (params?: any) => apiClient.getUsers(params),
  getById: (id: string) => apiClient.getUserById(id),
  getStats: () => apiClient.getUserStats(),
  getByRole: (role: string) => apiClient.getUsersByRole(role),
  create: (data: Partial<User>) => apiClient.createUser(data),
  update: (id: string, data: Partial<User>) => apiClient.updateUser(id, data),
  delete: (id: string) => apiClient.deleteUser(id),
  toggleStatus: (id: string, isActive: boolean) => apiClient.toggleUserStatus(id, isActive),
  resetPassword: (id: string, newPassword: string) => apiClient.resetUserPassword(id, newPassword),
  assignRole: (id: string, role: string, adminScope?: any) => apiClient.assignRole(id, role, adminScope),
  export: (params?: any) => extendedApiClient.request(buildExportUrl('/users/export', params)),
};

// Location Types
export interface Location {
  id: string;
  name: string;
  type: 'state' | 'district' | 'area' | 'unit';
  code: string;
  parent?: {
    id: string;
    name: string;
    type: string;
    code: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  population?: number;
  area?: number;
  contactPerson?: {
    name: string;
    phone: string;
    email: string;
  };
  isActive: boolean;
  description?: string;
  establishedDate?: string;
  childrenCount?: number;
  fullPath?: string;
  createdBy?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Add location methods to ApiClient class
class ExtendedApiClient extends ApiClient {
  // Location Methods
  async getLocations(params?: {
    page?: number;
    limit?: number;
    type?: string;
    parent?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<{
    locations: Location[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/locations${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async getLocationHierarchy(parentId?: string): Promise<ApiResponse<{
    hierarchy: Location[];
  }>> {
    const endpoint = `/locations/hierarchy${parentId ? `?parentId=${parentId}` : ''}`;
    return this.request(endpoint);
  }

  async getLocation(id: string): Promise<ApiResponse<{ location: Location }>> {
    return this.request(`/locations/${id}`);
  }

  async createLocation(locationData: Partial<Location>): Promise<ApiResponse<{ location: Location }>> {
    return this.request('/locations', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  }

  async updateLocation(id: string, locationData: Partial<Location>): Promise<ApiResponse<{ location: Location }>> {
    return this.request(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(locationData),
    });
  }

  async deleteLocation(id: string): Promise<ApiResponse<null>> {
    return this.request(`/locations/${id}`, {
      method: 'DELETE',
    });
  }

  async getLocationStats(): Promise<ApiResponse<{
    overview: {
      total: number;
      recentlyAdded: number;
    };
    byType: Array<{
      _id: string;
      count: number;
      active: number;
    }>;
  }>> {
    return this.request('/locations/statistics');
  }

  async getLocationsByType(type: string, params?: {
    parent?: string;
    active?: boolean;
  }): Promise<ApiResponse<{ locations: Location[] }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/locations/by-type/${type}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  // Beneficiary Methods
  async getBeneficiaries(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    state?: string;
    district?: string;
    area?: string;
    unit?: string;
  }): Promise<ApiResponse<{
    beneficiaries: any[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/beneficiaries${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async getBeneficiary(id: string): Promise<ApiResponse<any>> {
    return this.request(`/beneficiaries/${id}`);
  }

  async createBeneficiary(beneficiaryData: any): Promise<ApiResponse<any>> {
    return this.request('/beneficiaries', {
      method: 'POST',
      body: JSON.stringify(beneficiaryData),
    });
  }

  async updateBeneficiary(id: string, beneficiaryData: any): Promise<ApiResponse<any>> {
    return this.request(`/beneficiaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(beneficiaryData),
    });
  }

  async deleteBeneficiary(id: string): Promise<ApiResponse<null>> {
    return this.request(`/beneficiaries/${id}`, {
      method: 'DELETE',
    });
  }

  async verifyBeneficiary(id: string): Promise<ApiResponse<any>> {
    return this.request(`/beneficiaries/${id}/verify`, {
      method: 'PATCH',
    });
  }

  async exportBeneficiaries(params?: any): Promise<ApiResponse<Blob>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          searchParams.append(key, params[key].toString());
        }
      });
    }

    const endpoint = `/beneficiaries/export${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token || localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    const blob = await response.blob();
    return {
      success: true,
      data: blob,
      message: 'Export successful'
    };
  }

  // Application Methods
  async getApplications(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    scheme?: string;
    project?: string;
    state?: string;
    district?: string;
    area?: string;
    unit?: string;
  }): Promise<ApiResponse<{
    applications: any[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/applications${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async getApplication(id: string): Promise<ApiResponse<any>> {
    return this.request(`/applications/${id}`);
  }

  async createApplication(applicationData: any): Promise<ApiResponse<any>> {
    return this.request('/applications', {
      method: 'POST',
      body: JSON.stringify(applicationData),
    });
  }

  async updateApplication(id: string, applicationData: any): Promise<ApiResponse<any>> {
    return this.request(`/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(applicationData),
    });
  }

  async reviewApplication(id: string, reviewData: any): Promise<ApiResponse<any>> {
    return this.request(`/applications/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(reviewData),
    });
  }

  async approveApplication(id: string, approvalData: any): Promise<ApiResponse<any>> {
    return this.request(`/applications/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify(approvalData),
    });
  }

  async deleteApplication(id: string): Promise<ApiResponse<null>> {
    return this.request(`/applications/${id}`, {
      method: 'DELETE',
    });
  }
}

// Create extended API client instance
const extendedApiClient = new ExtendedApiClient(API_BASE_URL);

export const locations = {
  getAll: (params?: any) => extendedApiClient.getLocations(params),
  getHierarchy: (parentId?: string) => extendedApiClient.getLocationHierarchy(parentId),
  getById: (id: string) => extendedApiClient.getLocation(id),
  create: (data: Partial<Location>) => extendedApiClient.createLocation(data),
  update: (id: string, data: Partial<Location>) => extendedApiClient.updateLocation(id, data),
  delete: (id: string) => extendedApiClient.deleteLocation(id),
  getStats: () => extendedApiClient.getLocationStats(),
  getByType: (type: string, params?: any) => extendedApiClient.getLocationsByType(type, params),
  export: (params?: any) => extendedApiClient.request(buildExportUrl('/locations/export', params)),
};

export const beneficiaries = {
  getAll: (params?: any) => extendedApiClient.getBeneficiaries(params),
  getById: (id: string) => extendedApiClient.getBeneficiary(id),
  create: (data: any) => extendedApiClient.createBeneficiary(data),
  update: (id: string, data: any) => extendedApiClient.updateBeneficiary(id, data),
  delete: (id: string) => extendedApiClient.deleteBeneficiary(id),
  verify: (id: string) => extendedApiClient.verifyBeneficiary(id),
  export: (params?: any) => extendedApiClient.exportBeneficiaries(params),
};

export const applications = {
  getAll: (params?: any) => extendedApiClient.getApplications(params),
  getById: (id: string) => extendedApiClient.getApplication(id),
  create: (data: any) => extendedApiClient.createApplication(data),
  update: (id: string, data: any) => extendedApiClient.updateApplication(id, data),
  review: (id: string, data: any) => extendedApiClient.reviewApplication(id, data),
  approve: (id: string, data: any) => extendedApiClient.approveApplication(id, data),
  delete: (id: string) => extendedApiClient.deleteApplication(id),
  updateStage: (id: string, stageId: string, data: { status: string; notes?: string }) => 
    extendedApiClient.request(`/applications/${id}/stages/${stageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getPendingCommitteeApprovals: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    return extendedApiClient.request(`/applications/committee/pending${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
  },
  committeeDecision: (id: string, data: { decision: 'approved' | 'rejected'; comments?: string; distributionTimeline?: any[] }) => 
    extendedApiClient.request(`/applications/${id}/committee-decision`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  revert: (id: string, data: { targetStageId: string; reason: string }) =>
    extendedApiClient.request(`/applications/${id}/revert`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  addStageComment: (id: string, stageId: string, data: { comment: string; role?: string }) =>
    extendedApiClient.request(`/applications/${id}/stages/${stageId}/comment`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  uploadStageDocument: async (id: string, stageId: string, docIndex: number, file: File) => {
    const formData = new FormData();
    formData.append('document', file);
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const response = await fetch(`${baseUrl}/applications/${id}/stages/${stageId}/documents/${docIndex}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to upload document');
    }
    return response.json();
  },
  // Renewal endpoints
  getRenewalDue: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, (value as string).toString());
        }
      });
    }
    return extendedApiClient.request(`/applications/renewal-due${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
  },
  getRenewalHistory: (id: string) => extendedApiClient.request(`/applications/${id}/renewal-history`),
  export: (params?: any) => extendedApiClient.request(buildExportUrl('/applications/export', params)),
};

export const budget = {
  getOverview: (period?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    return extendedApiClient.request(`/budget/overview${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getProjects: (period?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    return extendedApiClient.request(`/budget/projects${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getSchemes: (period?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    return extendedApiClient.request(`/budget/schemes${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getTransactions: (limit?: number, filters?: any) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });
    }
    return extendedApiClient.request(`/budget/transactions${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getMonthlySummary: (year?: number, months?: number, period?: string) => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (months) params.append('months', months.toString());
    if (period) params.append('period', period);
    return extendedApiClient.request(`/budget/monthly-summary${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getByCategory: (period?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    return extendedApiClient.request(`/budget/by-category${params.toString() ? `?${params.toString()}` : ''}`);
  },
  getAnalytics: (period?: string) => {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    return extendedApiClient.request(`/budget/analytics${params.toString() ? `?${params.toString()}` : ''}`);
  },
};

export const donors = {
  getAll: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    const url = `/donors${queryString ? `?${queryString}` : ''}`;
    return extendedApiClient.request(url);
  },
  getById: (id: string) => extendedApiClient.request(`/donors/${id}`),
  create: (data: any) => extendedApiClient.request('/donors', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => extendedApiClient.request(`/donors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => extendedApiClient.request(`/donors/${id}`, { method: 'DELETE' }),
  updateStatus: (id: string, status: string) => extendedApiClient.request(`/donors/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  verify: (id: string, data: any) => extendedApiClient.request(`/donors/${id}/verify`, { method: 'PATCH', body: JSON.stringify(data) }),
  getStats: () => extendedApiClient.request('/donors/analytics/stats'),
  getTop: (limit?: number) => extendedApiClient.request(`/donors/analytics/top${limit ? `?limit=${limit}` : ''}`),
  getTrends: (months?: number) => extendedApiClient.request(`/donors/analytics/trends${months ? `?months=${months}` : ''}`),
  getDonations: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return extendedApiClient.request(`/donors/donations${queryString ? `?${queryString}` : ''}`);
  },
  getDonationHistory: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return extendedApiClient.request(`/donors/history${queryString ? `?${queryString}` : ''}`);
  },
  search: (query: string, limit?: number) => extendedApiClient.request(`/donors/search?q=${encodeURIComponent(query)}${limit ? `&limit=${limit}` : ''}`),
  getSuggestions: (programId?: string) => extendedApiClient.request(`/donors/suggestions${programId ? `?programId=${programId}` : ''}`),
  bulkUpdateStatus: (donorIds: string[], status: string) => extendedApiClient.request('/donors/bulk/status', { method: 'PATCH', body: JSON.stringify({ donorIds, status }) }),
  bulkAssignTags: (donorIds: string[], tags: string[]) => extendedApiClient.request('/donors/bulk/tags', { method: 'PATCH', body: JSON.stringify({ donorIds, tags }) }),
  sendCommunication: (data: any) => extendedApiClient.request('/donors/communicate', { method: 'POST', body: JSON.stringify(data) }),
  export: (params?: any) => extendedApiClient.request(buildExportUrl('/donors/export', params)),
};

export const donations = {
  getAll: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    const url = `/donations${queryString ? `?${queryString}` : ''}`;
    return extendedApiClient.request(url);
  },
  getById: (id: string) => extendedApiClient.request(`/donations/${id}`),
  create: (data: any) => extendedApiClient.request('/donations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => extendedApiClient.request(`/donations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => extendedApiClient.request(`/donations/${id}`, { method: 'DELETE' }),
  getStats: () => extendedApiClient.request('/donations/stats'),
  getRecent: (limit?: number) => extendedApiClient.request(`/donors/donations${limit ? `?limit=${limit}` : ''}`),
  getHistory: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return extendedApiClient.request(`/donors/history${queryString ? `?${queryString}` : ''}`);
  },
  getByDonor: (donorId: string, params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return extendedApiClient.request(`/donations/donor/${donorId}${queryString ? `?${queryString}` : ''}`);
  },
  export: (params?: any) => extendedApiClient.request(buildExportUrl('/donations/export', params)),
};



export const dashboard = {
  getOverview: () => extendedApiClient.request('/dashboard/overview'),
  getRecentApplications: (limit?: number) => extendedApiClient.request(`/dashboard/recent-applications${limit ? `?limit=${limit}` : ''}`),
  getRecentPayments: (limit?: number) => extendedApiClient.request(`/dashboard/recent-payments${limit ? `?limit=${limit}` : ''}`),
  getMonthlyTrends: (months?: number) => extendedApiClient.request(`/dashboard/monthly-trends${months ? `?months=${months}` : ''}`),
  getProjectPerformance: () => extendedApiClient.request('/dashboard/project-performance'),
};

export const budgetApi = {
  getOverview: () => extendedApiClient.request('/budget/overview'),
  getProjects: () => extendedApiClient.request('/budget/projects'),
  getSchemes: () => extendedApiClient.request('/budget/schemes'),
  getTransactions: (params?: { limit?: number; status?: string; type?: string; project?: string; scheme?: string }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    return extendedApiClient.request(`/budget/transactions${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
  },
  getMonthlySummary: (params?: { year?: number; months?: number }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    return extendedApiClient.request(`/budget/monthly-summary${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
  },
  getByCategory: () => extendedApiClient.request('/budget/by-category'),
  getAnalytics: () => extendedApiClient.request('/budget/analytics'),
};

export const donationsApi = {
  getAll: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
    }
    return extendedApiClient.request(`/donations${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
  },
  getById: (id: string) => extendedApiClient.request(`/donations/${id}`),
  create: (data: any) => extendedApiClient.request('/donations', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => extendedApiClient.request(`/donations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id: string, status: string) => extendedApiClient.request(`/donations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getStats: () => extendedApiClient.request('/donations/analytics/stats'),
  getRecent: (limit?: number) => extendedApiClient.request(`/donations/analytics/recent${limit ? `?limit=${limit}` : ''}`),
  getTrends: (months?: number) => extendedApiClient.request(`/donations/analytics/trends${months ? `?months=${months}` : ''}`),
};

export const interviews = {
  getAll: (params?: any) => extendedApiClient.request(`/interviews${params ? `?${new URLSearchParams(params).toString()}` : ''}`),
  schedule: (applicationId: string, data: any) => extendedApiClient.request(`/interviews/schedule/${applicationId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (applicationId: string, data: any) => extendedApiClient.request(`/interviews/${applicationId}`, { method: 'PUT', body: JSON.stringify(data) }),
  complete: (applicationId: string, data: any) => extendedApiClient.request(`/interviews/${applicationId}/complete`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancel: (applicationId: string, data: any) => extendedApiClient.request(`/interviews/${applicationId}/cancel`, { method: 'PATCH', body: JSON.stringify(data) }),
  getHistory: (applicationId: string) => extendedApiClient.request(`/interviews/history/${applicationId}`),
};

export const payments = {
  getAll: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return extendedApiClient.request(`/payments${queryString ? `?${queryString}` : ''}`);
  },
  getById: (id: string) => extendedApiClient.request(`/payments/${id}`),
  update: (id: string, data: any) => extendedApiClient.request(`/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  process: (id: string, data: any) => extendedApiClient.request(`/payments/${id}/process`, { method: 'PATCH', body: JSON.stringify(data) }),
  markAsCompleted: (id: string, data: { paymentDate: string; paymentMethod: string; chequeNumber?: string }) => 
    extendedApiClient.request(`/payments/${id}/complete`, { method: 'PATCH', body: JSON.stringify(data) }),
  export: (params?: any) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const queryString = searchParams.toString();
    return extendedApiClient.request(`/payments/export${queryString ? `?${queryString}` : ''}`);
  },
};

export const reports = {
  getByApplication: (applicationId: string, params?: any) => extendedApiClient.request(`/reports/application/${applicationId}${params ? `?${new URLSearchParams(params).toString()}` : ''}`),
  create: (applicationId: string, data: any) => extendedApiClient.request(`/reports/application/${applicationId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (reportId: string, data: any) => extendedApiClient.request(`/reports/${reportId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (reportId: string, data?: any) => extendedApiClient.request(`/reports/${reportId}`, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined }),
};

// RBAC Management
export const rbac = {
  // Role Management
  getRoles: (params?: { category?: string; type?: string; isActive?: boolean }) => 
    extendedApiClient.request(`/rbac/roles${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),
  getRoleById: (id: string) => extendedApiClient.request(`/rbac/roles/${id}`),
  getRoleHierarchy: () => extendedApiClient.request('/rbac/roles/hierarchy'),
  createRole: (data: any) => extendedApiClient.request('/rbac/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: any) => extendedApiClient.request(`/rbac/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: string) => extendedApiClient.request(`/rbac/roles/${id}`, { method: 'DELETE' }),
  getUsersWithRole: (roleId: string, includeExpired?: boolean) => 
    extendedApiClient.request(`/rbac/roles/${roleId}/users${includeExpired ? '?includeExpired=true' : ''}`),
  
  // Permission Management
  getPermissions: (params?: { module?: string; category?: string; scope?: string; securityLevel?: string }) => 
    extendedApiClient.request(`/rbac/permissions${params ? `?${new URLSearchParams(params as any).toString()}` : ''}`),
  getPermissionById: (id: string) => extendedApiClient.request(`/rbac/permissions/${id}`),
  
  // User Role Assignment
  assignRole: (userId: string, data: { roleId: string; reason?: string; validUntil?: string; isPrimary?: boolean; isTemporary?: boolean; scope?: any }) => 
    extendedApiClient.request(`/rbac/users/${userId}/roles`, { method: 'POST', body: JSON.stringify(data) }),
  removeRole: (userId: string, roleId: string, reason?: string) => 
    extendedApiClient.request(`/rbac/users/${userId}/roles/${roleId}`, { method: 'DELETE', body: JSON.stringify({ reason }) }),
  getUserRoles: (userId: string) => extendedApiClient.request(`/rbac/users/${userId}/roles`),
  getUserPermissions: (userId: string) => extendedApiClient.request(`/rbac/users/${userId}/permissions`),
  checkPermission: (userId: string, permission: string, context?: any) => 
    extendedApiClient.request(`/rbac/users/${userId}/check-permission`, { 
      method: 'POST', 
      body: JSON.stringify({ permission, context }) 
    }),
  
  // User Role Permission Management
  addPermissionToUserRole: (userRoleId: string, data: { permissionId: string; reason: string; expiresAt?: string }) => 
    extendedApiClient.request(`/rbac/user-roles/${userRoleId}/permissions`, { method: 'POST', body: JSON.stringify(data) }),
  restrictPermissionFromUserRole: (userRoleId: string, data: { permissionId: string; reason: string; expiresAt?: string }) => 
    extendedApiClient.request(`/rbac/user-roles/${userRoleId}/restrictions`, { method: 'POST', body: JSON.stringify(data) }),
  
  // System Management
  initializeRBAC: () => extendedApiClient.request('/rbac/initialize', { method: 'POST' }),
  getStats: () => extendedApiClient.request('/rbac/stats'),
  cleanupExpired: () => extendedApiClient.request('/rbac/cleanup', { method: 'POST' }),
  exportRoles: (params?: any) => extendedApiClient.request(buildExportUrl('/rbac/roles/export', params)),
};

// Master Data Types
export interface MasterData {
  id: string;
  type: 'scheme_stages' | 'project_stages' | 'application_stages' | 'distribution_timeline_templates' | 'status_configurations';
  category?: string;
  name: string;
  description?: string;
  configuration: {
    stages?: Array<{
      name: string;
      description?: string;
      order: number;
      isRequired: boolean;
      allowedRoles: string[];
      estimatedDuration?: number;
      autoTransition?: boolean;
      transitionConditions?: string;
      color?: string;
      icon?: string;
    }>;
    distributionSteps?: Array<{
      description: string;
      percentage: number;
      daysFromApproval: number;
      isAutomatic?: boolean;
      requiresVerification?: boolean;
      notes?: string;
    }>;
    settings?: {
      enableNotifications?: boolean;
      enablePublicTracking?: boolean;
      autoProgressCalculation?: boolean;
      requireApprovalForUpdates?: boolean;
    };
  };
  scope: 'global' | 'state' | 'district' | 'area' | 'unit' | 'project_specific' | 'scheme_specific';
  targetRegions?: Array<{
    id: string;
    name: string;
    type: string;
    code: string;
  }>;
  targetProjects?: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  targetSchemes?: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  usageCount: number;
  lastUsed?: string;
  tags: string[];
  isEffective: boolean;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  updatedBy?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Add master data methods to ExtendedApiClient
class MasterDataApiClient extends ExtendedApiClient {
  // Master Data Methods
  async getMasterData(params?: {
    page?: number;
    limit?: number;
    type?: string;
    category?: string;
    scope?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResponse<{
    masterData: MasterData[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/master-data${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async getMasterDataById(id: string): Promise<ApiResponse<{ masterData: MasterData }>> {
    return this.request(`/master-data/${id}`);
  }

  async getMasterDataByType(type: string, params?: {
    category?: string;
    scope?: string;
  }): Promise<ApiResponse<{ masterData: MasterData[] }>> {
    const searchParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/master-data/type/${type}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request(endpoint);
  }

  async createMasterData(masterDataData: Partial<MasterData>): Promise<ApiResponse<{ masterData: MasterData }>> {
    return this.request('/master-data', {
      method: 'POST',
      body: JSON.stringify(masterDataData),
    });
  }

  async updateMasterData(id: string, masterDataData: Partial<MasterData>): Promise<ApiResponse<{ masterData: MasterData }>> {
    return this.request(`/master-data/${id}`, {
      method: 'PUT',
      body: JSON.stringify(masterDataData),
    });
  }

  async deleteMasterData(id: string): Promise<ApiResponse<null>> {
    return this.request(`/master-data/${id}`, {
      method: 'DELETE',
    });
  }

  async cloneMasterData(id: string): Promise<ApiResponse<{ masterData: MasterData }>> {
    return this.request(`/master-data/${id}/clone`, {
      method: 'POST',
    });
  }

  // Project Status Update Methods
  async addProjectStatusUpdate(projectId: string, statusUpdateData: {
    stage: string;
    status: string;
    description: string;
    remarks?: string;
    attachments?: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  }): Promise<ApiResponse<{ project: Project }>> {
    return this.request(`/projects/${projectId}/status-update`, {
      method: 'POST',
      body: JSON.stringify(statusUpdateData),
    });
  }

  async updateProjectStatusUpdate(projectId: string, updateId: string, statusUpdateData: {
    stage?: string;
    status?: string;
    description?: string;
    remarks?: string;
    attachments?: Array<{
      name: string;
      url: string;
      type: string;
    }>;
    isVisible?: boolean;
  }): Promise<ApiResponse<{ project: Project }>> {
    return this.request(`/projects/${projectId}/status-update/${updateId}`, {
      method: 'PUT',
      body: JSON.stringify(statusUpdateData),
    });
  }

  async deleteProjectStatusUpdate(projectId: string, updateId: string): Promise<ApiResponse<null>> {
    return this.request(`/projects/${projectId}/status-update/${updateId}`, {
      method: 'DELETE',
    });
  }

  async getProjectStatusConfiguration(projectId: string): Promise<ApiResponse<{ statusConfiguration: any }>> {
    return this.request(`/projects/${projectId}/status-configuration`);
  }

  async updateProjectStatusConfiguration(projectId: string, configData: {
    stages: Array<{
      name: string;
      description?: string;
      order: number;
      isRequired: boolean;
      allowedRoles: string[];
      estimatedDuration?: number;
    }>;
    enablePublicTracking?: boolean;
    notificationSettings?: any;
  }): Promise<ApiResponse<{ project: Project }>> {
    return this.request(`/projects/${projectId}/status-configuration`, {
      method: 'PUT',
      body: JSON.stringify(configData),
    });
  }
}

// Create master data API client instance
const masterDataApiClient = new MasterDataApiClient(API_BASE_URL);

export const masterData = {
  getAll: (params?: any) => masterDataApiClient.getMasterData(params),
  getById: (id: string) => masterDataApiClient.getMasterDataById(id),
  getByType: (type: string, params?: any) => masterDataApiClient.getMasterDataByType(type, params),
  create: (data: Partial<MasterData>) => masterDataApiClient.createMasterData(data),
  update: (id: string, data: Partial<MasterData>) => masterDataApiClient.updateMasterData(id, data),
  delete: (id: string) => masterDataApiClient.deleteMasterData(id),
  clone: (id: string) => masterDataApiClient.cloneMasterData(id),
};

// Enhanced projects API with status updates
export const projectsEnhanced = {
  ...projects,
  addStatusUpdate: (projectId: string, data: any) => masterDataApiClient.addProjectStatusUpdate(projectId, data),
  updateStatusUpdate: (projectId: string, updateId: string, data: any) => masterDataApiClient.updateProjectStatusUpdate(projectId, updateId, data),
  deleteStatusUpdate: (projectId: string, updateId: string) => masterDataApiClient.deleteProjectStatusUpdate(projectId, updateId),
  getStatusConfiguration: (projectId: string) => masterDataApiClient.getProjectStatusConfiguration(projectId),
  updateStatusConfiguration: (projectId: string, data: any) => masterDataApiClient.updateProjectStatusConfiguration(projectId, data),
};

// Website Management API
export const website = {
  // Settings
  getSettings: () => apiClient.request('/website/settings'),
  getPublicSettings: () => apiClient.request('/website/public-settings'),
  updateSettings: (data: any) => apiClient.request('/website/settings', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  addCounter: (data: any) => apiClient.request('/website/settings/counter', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateCounter: (id: string, data: any) => apiClient.request(`/website/settings/counter/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteCounter: (id: string) => apiClient.request(`/website/settings/counter/${id}`, {
    method: 'DELETE'
  }),

  // News & Events
  getAllNews: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.request(`/news-events${query}`);
  },
  getPublicNews: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.request(`/news-events/public${query}`);
  },
  getNewsById: (id: string) => apiClient.request(`/news-events/${id}`),
  createNews: (formData: FormData) => apiClient.request('/news-events', {
    method: 'POST',
    body: formData,
    headers: {} // Let browser set Content-Type for FormData
  }),
  updateNews: (id: string, formData: FormData) => apiClient.request(`/news-events/${id}`, {
    method: 'PUT',
    body: formData,
    headers: {}
  }),
  deleteNews: (id: string) => apiClient.request(`/news-events/${id}`, {
    method: 'DELETE'
  }),

  // Brochures
  getAllBrochures: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.request(`/brochures${query}`);
  },
  getPublicBrochures: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.request(`/brochures/public${query}`);
  },
  getBrochureById: (id: string) => apiClient.request(`/brochures/${id}`),
  createBrochure: (formData: FormData) => apiClient.request('/brochures', {
    method: 'POST',
    body: formData,
    headers: {}
  }),
  updateBrochure: (id: string, formData: FormData) => apiClient.request(`/brochures/${id}`, {
    method: 'PUT',
    body: formData,
    headers: {}
  }),
  deleteBrochure: (id: string) => apiClient.request(`/brochures/${id}`, {
    method: 'DELETE'
  }),
  trackDownload: (id: string) => apiClient.request(`/brochures/${id}/download`, {
    method: 'POST'
  }),

  // Partners
  getAllPartners: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiClient.request(`/partners${query}`);
  },
  getPublicPartners: () => apiClient.request('/partners/public'),
  getPartnerById: (id: string) => apiClient.request(`/partners/${id}`),
  createPartner: (formData: FormData) => apiClient.request('/partners', {
    method: 'POST',
    body: formData,
    headers: {}
  }),
  updatePartner: (id: string, formData: FormData) => apiClient.request(`/partners/${id}`, {
    method: 'PUT',
    body: formData,
    headers: {}
  }),
  deletePartner: (id: string) => apiClient.request(`/partners/${id}`, {
    method: 'DELETE'
  }),
  exportPartners: (params?: any) => apiClient.request(buildExportUrl('/partners/export', params)),
};

// Banners API
export const banners = {
  getAll: () => apiClient.request('/banners'),
  getPublic: () => apiClient.request('/banners/public'),
  getById: (id: string) => apiClient.request(`/banners/${id}`),
  create: (formData: FormData) => apiClient.request('/banners', {
    method: 'POST',
    body: formData,
    headers: {}
  }),
  update: (id: string, formData: FormData) => apiClient.request(`/banners/${id}`, {
    method: 'PUT',
    body: formData,
    headers: {}
  }),
  delete: (id: string) => apiClient.request(`/banners/${id}`, {
    method: 'DELETE'
  })
};

// Application Configuration API
export const config = {
  getPublic: () => apiClient.request('/config/public'),
  getAll: (category?: string) => apiClient.request(`/config${category ? `?category=${category}` : ''}`),
  getById: (id: string) => apiClient.request(`/config/${id}`),
  create: (data: any) => apiClient.request('/config', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id: string, value: any) => apiClient.request(`/config/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ value })
  }),
  bulkUpdate: (configs: Array<{ id: string; value: any }>) => apiClient.request('/config/bulk/update', {
    method: 'PUT',
    body: JSON.stringify({ configs })
  }),
  delete: (id: string) => apiClient.request(`/config/${id}`, {
    method: 'DELETE'
  })
};

// Speech-to-Text API
export const speech = {
  transcribe: (audio: string, options?: { encoding?: string; sampleRateHertz?: number; languageCode?: string }) =>
    apiClient.request<{ text: string; confidence: number; languageCode: string }>('/speech/transcribe', {
      method: 'POST',
      body: JSON.stringify({
        audio,
        encoding: options?.encoding || 'WEBM_OPUS',
        sampleRateHertz: options?.sampleRateHertz || 48000,
        languageCode: options?.languageCode || 'ml-IN'
      })
    })
};

// Export api as alias for apiClient for backward compatibility
export const api = masterDataApiClient;
export default masterDataApiClient;