// Donor Follow-up Types

export interface DonorFollowUp {
  _id: string;
  id: string;
  donor: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    type?: string;
    category?: string;
    donationStats?: {
      totalDonated: number;
      donationCount: number;
      lastDonation: string;
      averageDonation: number;
    };
    engagementScore?: number;
    followUpStatus?: string;
  };
  donation?: {
    _id: string;
    amount: number;
    method: string;
    donationNumber: string;
    status?: string;
  };
  type: 'recurring_reminder' | 'annual_reminder' | 'lapsed_followup' | 'thank_you' | 'custom';
  status: 'scheduled' | 'sent_first_reminder' | 'sent_final_reminder' | 'completed' | 'overdue' | 'lapsed' | 'cancelled';
  nextDueDate: string;
  frequency: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'custom' | 'one_time';
  customIntervalDays?: number;
  firstReminderDate: string;
  finalReminderDate: string;
  lapsedDate: string;
  expectedAmount: number;
  reminders: Array<{
    sentAt: string;
    channel: 'whatsapp' | 'sms' | 'in_app' | 'push' | 'manual_call' | 'manual_visit';
    messageId?: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    reminderType: 'first_reminder' | 'final_reminder' | 'lapsed_notice' | 'custom';
    sentBy?: { _id: string; name: string; email: string };
    notes?: string;
  }>;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  assignedAt?: string;
  assignedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  notes?: string;
  staffNotes: Array<{
    note: string;
    addedBy: { _id: string; name: string; email: string };
    addedAt: string;
  }>;
  lastReminderSent?: string;
  completedAt?: string;
  completedDonation?: {
    _id: string;
    amount: number;
    method: string;
    donationNumber: string;
  };
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  daysUntilDue?: number;
  isOverdue?: boolean;
}

export interface FollowUpDashboardStats {
  totalScheduled: number;
  dueThisWeek: number;
  overdue: number;
  lapsed: number;
  completedThisMonth: number;
  totalActive: number;
  expectedAmount: number;
  byStatus: Record<string, number>;
  byFrequency: Array<{
    frequency: string;
    count: number;
    totalExpected: number;
  }>;
}

export interface FollowUpFilters {
  page?: number;
  limit?: number;
  status?: string;
  assignedTo?: string;
  frequency?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateFollowUpData {
  donor: string;
  nextDueDate: string;
  frequency: string;
  customIntervalDays?: number;
  expectedAmount?: number;
  notes?: string;
  assignedTo?: string;
  type?: string;
}
