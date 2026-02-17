// Donor Management Types
export interface Donor {
  id: string;
  donorId: string;
  name: string;
  email: string;
  phone: string;
  type: 'individual' | 'corporate' | 'foundation' | 'trust';
  category: 'regular' | 'patron' | 'major' | 'corporate' | 'recurring';
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  preferences: {
    programs: string[];
    communicationMethod: 'email' | 'phone' | 'sms' | 'whatsapp';
    frequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
    anonymousGiving: boolean;
  };
  donationPreferences?: {
    frequency: 'one-time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';
    customIntervalDays?: number;
    preferredAmount?: number;
    preferredMethod?: 'upi' | 'bank_transfer' | 'card' | 'cash' | 'cheque';
    anonymousDonation?: boolean;
  };
  followUpStatus?: 'active' | 'pending_reminder' | 'overdue' | 'lapsed' | 'no_followup';
  nextExpectedDonation?: string;
  engagementScore?: number;
  taxInfo: {
    panNumber?: string;
    gstNumber?: string;
    taxExemptionCertificate?: string;
  };
  donationHistory: {
    totalDonated: number;
    donationCount: number;
    firstDonation: string;
    lastDonation: string;
    averageDonation: number;
    largestDonation: number;
  };
  status: 'active' | 'inactive' | 'blocked' | 'pending_verification';
  verificationStatus: 'verified' | 'pending' | 'rejected';
  tags: string[];
  notes: string;
  assignedTo?: {
    id: string;
    name: string;
    role: string;
  };
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Simplified Donation interface for basic donation tracking within donor context
export interface Donation {
  id: string;
  donor: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  amount: number;
  method: string;
  purpose: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  notes: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  type: 'fundraising' | 'awareness' | 'emergency' | 'seasonal';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  targetAmount: number;
  raisedAmount: number;
  targetDonors: number;
  actualDonors: number;
  startDate: string;
  endDate: string;
  programs: Array<{
    id: string;
    name: string;
    allocation: number; // percentage
  }>;
  channels: string[];
  metrics: {
    impressions: number;
    clicks: number;
    conversionRate: number;
    averageDonation: number;
    costPerAcquisition: number;
  };
  createdBy: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DonorFilters {
  search?: string;
  type?: string;
  category?: string;
  status?: string;
  verificationStatus?: string;
  minDonation?: number;
  maxDonation?: number;
  lastDonationFrom?: string;
  lastDonationTo?: string;
  tags?: string[];
  assignedTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}



export interface DonorStats {
  overview: {
    totalDonors: number;
    activeDonors: number;
    newDonorsThisMonth: number;
    totalDonationsAmount: number;
    totalDonationsCount: number;
    averageDonation: number;
    recurringDonors: number;
    patronDonors: number;
  };
  byType: Array<{
    type: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  byCategory: Array<{
    category: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  byMethod: Array<{
    method: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    donorCount: number;
    donationAmount: number;
    newDonors: number;
  }>;
  topDonors: Array<{
    id: string;
    name: string;
    totalDonated: number;
    donationCount: number;
    lastDonation: string;
  }>;
  recentDonations: Array<{
    id: string;
    donor: {
      id: string;
      name: string;
    };
    amount: number;
    method: string;
    purpose: string;
    createdAt: string;
  }>;
}

export interface DonorFormData {
  name: string;
  email: string;
  phone: string;
  type: 'individual' | 'corporate' | 'foundation' | 'trust';
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  preferences: {
    programs: string[];
    communicationMethod: 'email' | 'phone' | 'sms' | 'whatsapp';
    anonymousGiving: boolean;
  };
  donationPreferences: {
    frequency: 'one-time' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom';
    customIntervalDays?: number;
    preferredAmount?: number;
    preferredMethod: 'upi' | 'bank_transfer' | 'card' | 'cash' | 'cheque';
    anonymousDonation: boolean;
  };
  taxInfo: {
    panNumber?: string;
    gstNumber?: string;
  };
  tags: string[];
  notes: string;
}

