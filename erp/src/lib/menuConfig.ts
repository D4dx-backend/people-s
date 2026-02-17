import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Users,
  IndianRupee,
  MessageSquare,
  Settings,
  Building2,
  MapPin,
  FileCheck,
  UserCheck,
  CalendarCheck,
  Wallet,
  Shield,
  Activity,
  Scale,
  Globe,
  Newspaper,
  BookOpen,
  ImageIcon,
  CalendarClock,
  Bug,
  type LucideIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────

export interface SubMenuItem {
  to: string;
  label: string;
  permissions: string[];
  keywords?: string[];
}

export interface MenuItem {
  to?: string;
  icon: LucideIcon;
  label: string;
  permissions: string[];
  requireSuperAdmin?: boolean;
  submenu?: SubMenuItem[];
  keywords?: string[];
}

export interface MenuCategory {
  label: string | null;
  items: MenuItem[];
}

// ── Data ───────────────────────────────────────────────────────────

export const menuCategories: MenuCategory[] = [
  {
    label: null,
    items: [
      {
        to: "/dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        permissions: [],
        keywords: ["home", "overview", "main"],
      },
    ],
  },
  {
    label: "Projects Management",
    items: [
      {
        to: "/projects",
        icon: FolderKanban,
        label: "Projects",
        permissions: ["projects.read.all", "projects.read.assigned"],
        keywords: ["project", "kanban"],
      },
      {
        to: "/schemes",
        icon: FileText,
        label: "Schemes",
        permissions: ["schemes.read.all", "schemes.read.assigned"],
        keywords: ["scheme", "plan"],
      },
      {
        label: "Applications",
        icon: FileCheck,
        permissions: [
          "applications.read.all",
          "applications.read.regional",
          "applications.read.own",
        ],
        keywords: ["application", "apply", "form"],
        submenu: [
          {
            to: "/applications/all",
            label: "All Applications",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["all", "list"],
          },
          {
            to: "/applications/pending",
            label: "Pending",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["pending", "waiting"],
          },
          {
            to: "/applications/interview-scheduled",
            label: "Interview Scheduled",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["interview", "scheduled"],
          },
          {
            to: "/applications/approved",
            label: "Approved",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["approved", "accepted"],
          },
          {
            to: "/applications/rejected",
            label: "Rejected",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["rejected", "denied"],
          },
          {
            to: "/applications/completed",
            label: "Completed",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["completed", "finished", "done"],
          },
        ],
      },
      {
        to: "/upcoming-interviews",
        icon: CalendarCheck,
        label: "Upcoming Interviews",
        permissions: [
          "interviews.read",
          "applications.read.all",
          "applications.read.regional",
        ],
        keywords: ["interview", "upcoming", "schedule"],
      },
      {
        to: "/committee-approval",
        icon: Scale,
        label: "Committee Approval",
        permissions: ["applications.approve", "committee.approve"],
        keywords: ["committee", "approve", "review"],
      },
      {
        to: "/beneficiaries",
        icon: UserCheck,
        label: "Beneficiaries",
        permissions: [
          "beneficiaries.read.all",
          "beneficiaries.read.regional",
          "beneficiaries.read.own",
        ],
        keywords: ["beneficiary", "people", "member"],
      },
    ],
  },
  {
    label: "Financial Management",
    items: [
      {
        label: "Payments",
        icon: Wallet,
        permissions: [
          "finances.read.all",
          "finances.read.regional",
          "finances.manage",
        ],
        keywords: ["payment", "finance", "money"],
        submenu: [
          {
            to: "/payment-tracking/all",
            label: "All Payments",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["all", "list"],
          },
          {
            to: "/payment-tracking/overdue",
            label: "Overdue",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["overdue", "late", "delay"],
          },
          {
            to: "/payment-tracking/due-soon",
            label: "Due Soon",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["due", "soon", "near"],
          },
          {
            to: "/payment-tracking/upcoming",
            label: "Upcoming",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["upcoming", "future"],
          },
          {
            to: "/payment-tracking/processing",
            label: "Processing",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["processing", "in progress"],
          },
          {
            to: "/payment-tracking/completed",
            label: "Completed",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["completed", "done", "paid"],
          },
        ],
      },
      {
        label: "Recurring Payments",
        icon: CalendarClock,
        permissions: [
          "finances.read.all",
          "finances.read.regional",
          "finances.manage",
        ],
        keywords: ["recurring", "repeat", "subscription"],
        submenu: [
          {
            to: "/recurring-payments/dashboard",
            label: "Overview",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["overview", "summary"],
          },
          {
            to: "/recurring-payments/schedule",
            label: "Schedule",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["schedule", "timeline"],
          },
          {
            to: "/recurring-payments/forecast",
            label: "Forecast",
            permissions: [
              "finances.read.all",
              "finances.read.regional",
              "finances.manage",
            ],
            keywords: ["forecast", "prediction", "budget"],
          },
        ],
      },
      {
        to: "/budget",
        icon: IndianRupee,
        label: "Budget & Expenses",
        permissions: [
          "finances.read.all",
          "finances.read.regional",
          "finances.manage",
        ],
        keywords: ["budget", "expense", "cost", "rupee"],
      },
      {
        label: "Donors",
        icon: Users,
        permissions: ["donors.read", "donors.read.regional", "donors.read.all"],
        keywords: ["donor", "sponsor", "contributor"],
        submenu: [
          {
            to: "/donors/all",
            label: "All Donors",
            permissions: [
              "donors.read",
              "donors.read.regional",
              "donors.read.all",
            ],
            keywords: ["all", "list"],
          },
          {
            to: "/donors/donations",
            label: "Donations",
            permissions: ["donations.create", "donations.read"],
            keywords: ["donation", "contribute", "give"],
          },
          {
            to: "/donors/history",
            label: "Donation History",
            permissions: ["donations.read", "donations.read.all"],
            keywords: ["history", "past", "record"],
          },
          {
            to: "/donors/followups",
            label: "Follow-ups",
            permissions: [
              "donors.read",
              "donors.read.regional",
              "donors.read.all",
            ],
            keywords: ["followup", "reminder", "schedule", "overdue", "lapsed"],
          },
        ],
      },
    ],
  },
  {
    label: "Website Management",
    items: [
      {
        to: "/website-settings",
        icon: Globe,
        label: "Website Settings",
        permissions: ["website.read", "settings.read"],
        keywords: ["website", "site", "web"],
      },
      {
        to: "/banners",
        icon: ImageIcon,
        label: "Banners",
        permissions: ["website.read", "banners.read"],
        keywords: ["banner", "image", "hero", "slider"],
      },
      {
        to: "/news-events",
        icon: Newspaper,
        label: "News & Events",
        permissions: ["website.read", "news.read"],
        keywords: ["news", "event", "announcement"],
      },
      {
        to: "/brochures",
        icon: BookOpen,
        label: "Brochures",
        permissions: ["website.read", "brochures.read"],
        keywords: ["brochure", "pamphlet", "document"],
      },
      {
        to: "/partners",
        icon: Users,
        label: "Partners",
        permissions: ["website.read", "partners.read"],
        keywords: ["partner", "collaboration", "associate"],
      },
    ],
  },
  {
    label: "System Administration",
    items: [
      {
        label: "Locations",
        icon: MapPin,
        permissions: ["locations.read", "settings.read"],
        keywords: ["location", "place", "geography"],
        submenu: [
          {
            to: "/locations/districts",
            label: "Districts",
            permissions: ["locations.read", "settings.read"],
            keywords: ["district"],
          },
          {
            to: "/locations/areas",
            label: "Areas",
            permissions: ["locations.read", "settings.read"],
            keywords: ["area", "zone"],
          },
          {
            to: "/locations/units",
            label: "Units",
            permissions: ["locations.read", "settings.read"],
            keywords: ["unit"],
          },
        ],
      },
      {
        to: "/users",
        icon: Building2,
        label: "User Management",
        permissions: ["users.read.all", "users.read.regional"],
        keywords: ["user", "admin", "staff", "manage"],
      },
      {
        to: "/roles",
        icon: Shield,
        label: "Role Management",
        permissions: ["roles.read"],
        keywords: ["role", "permission", "access", "rbac"],
      },
      {
        to: "/settings",
        icon: Settings,
        label: "Application Settings",
        permissions: ["config.write", "settings.write"],
        requireSuperAdmin: true,
        keywords: ["settings", "config", "preference"],
      },
      {
        label: "Activity Logs",
        icon: Activity,
        permissions: ["activity_logs.read"],
        keywords: ["log", "activity", "audit", "track"],
        submenu: [
          {
            to: "/activity-logs/user-activity",
            label: "User Activity",
            permissions: ["activity_logs.read"],
            keywords: ["user", "action"],
          },
          {
            to: "/login-logs",
            label: "Login History",
            permissions: ["activity_logs.read"],
            keywords: ["login", "signin", "auth"],
          },
          {
            to: "/login-logs/analytics",
            label: "Login Analytics",
            permissions: ["activity_logs.read"],
            keywords: ["analytics", "chart", "stats"],
          },
          {
            to: "/login-logs/suspicious",
            label: "Suspicious Activity",
            permissions: ["activity_logs.read"],
            keywords: ["suspicious", "alert", "security", "threat"],
          },
          {
            to: "/error-logs",
            label: "Error History",
            permissions: ["activity_logs.read"],
            keywords: ["error", "bug", "failure"],
          },
          {
            to: "/error-logs/analytics",
            label: "Error Analytics",
            permissions: ["activity_logs.read"],
            keywords: ["error", "analytics", "chart"],
          },
        ],
      },
    ],
  },
  {
    label: null,
    items: [
      {
        to: "/communications",
        icon: MessageSquare,
        label: "Communications",
        permissions: ["communications.send"],
        keywords: ["message", "sms", "whatsapp", "notify"],
      },
    ],
  },
];

// ── Limited-admin override (area_admin / district_admin / unit_admin) ──

export const limitedAdminMenuCategories: MenuCategory[] = [
  {
    label: null,
    items: [
      {
        to: "/dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        permissions: [],
        keywords: ["home", "overview", "main"],
      },
    ],
  },
  {
    label: "Projects Management",
    items: [
      {
        label: "Applications",
        icon: FileCheck,
        permissions: [
          "applications.read.all",
          "applications.read.regional",
          "applications.read.own",
        ],
        keywords: ["application", "apply", "form"],
        submenu: [
          {
            to: "/applications/all",
            label: "All Applications",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["all", "list"],
          },
          {
            to: "/applications/pending",
            label: "Pending",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["pending", "waiting"],
          },
          {
            to: "/applications/interview-scheduled",
            label: "Interview Scheduled",
            permissions: [
              "applications.read.all",
              "applications.read.regional",
              "applications.read.own",
            ],
            keywords: ["interview", "scheduled"],
          },
        ],
      },
    ],
  },
];
