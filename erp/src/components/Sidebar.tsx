import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
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
  Clock,
  Wallet,
  ChevronDown,
  Search,
  CalendarCheck,
  Shield,
  Activity,
  Scale,
  Globe,
  Newspaper,
  BookOpen,
  ImageIcon,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRBAC } from "@/hooks/useRBAC";
import { useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useConfig";

const menuCategories = [
  {
    label: null,
    items: [
      { 
        to: "/dashboard", 
        icon: LayoutDashboard, 
        label: "Dashboard",
        permissions: [] // All authenticated users
      },
    ]
  },
  {
    label: "Projects Management",
    items: [
      { 
        to: "/projects", 
        icon: FolderKanban, 
        label: "Projects",
        permissions: ["projects.read.all", "projects.read.assigned"]
      },
      { 
        to: "/schemes", 
        icon: FileText, 
        label: "Schemes",
        permissions: ["schemes.read.all", "schemes.read.assigned"]
      },
      { 
        label: "Applications",
        icon: FileCheck,
        permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"],
        submenu: [
          {
            to: "/applications/all",
            label: "All Applications",
            permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
          },
          {
            to: "/applications/pending",
            label: "Pending",
            permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
          },
          {
            to: "/applications/interview-scheduled",
            label: "Interview Scheduled",
            permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
          },
          {
            to: "/applications/approved",
            label: "Approved",
            permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
          },
          {
            to: "/applications/rejected",
            label: "Rejected",
            permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
          },
          {
            to: "/applications/completed",
            label: "Completed",
            permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
          }
        ]
      },
      { 
        to: "/upcoming-interviews", 
        icon: CalendarCheck, 
        label: "Upcoming Interviews",
        permissions: ["interviews.read", "applications.read.all", "applications.read.regional"]
      },
      { 
        to: "/committee-approval", 
        icon: Scale, 
        label: "Committee Approval",
        permissions: ["applications.approve", "committee.approve"]
      },
      { 
        to: "/beneficiaries", 
        icon: UserCheck, 
        label: "Beneficiaries",
        permissions: ["beneficiaries.read.all", "beneficiaries.read.regional", "beneficiaries.read.own"]
      },
    ]
  },
  {
    label: "Financial Management",
    items: [
      { 
        label: "Payments",
        icon: Wallet,
        permissions: ["finances.read.all", "finances.read.regional", "finances.manage"],
        submenu: [
          {
            to: "/payment-tracking/all",
            label: "All Payments",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          },
          {
            to: "/payment-tracking/overdue",
            label: "Overdue",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          },
          {
            to: "/payment-tracking/due-soon",
            label: "Due Soon",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          },
          {
            to: "/payment-tracking/upcoming",
            label: "Upcoming",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          },
          {
            to: "/payment-tracking/processing",
            label: "Processing",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          },
          {
            to: "/payment-tracking/completed",
            label: "Completed",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          }
        ]
      },
      { 
        label: "Recurring Payments",
        icon: CalendarClock,
        permissions: ["finances.read.all", "finances.read.regional", "finances.manage"],
        submenu: [
          {
            to: "/recurring-payments/dashboard",
            label: "Overview",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          },
          {
            to: "/recurring-payments/schedule",
            label: "Schedule",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          },
          {
            to: "/recurring-payments/forecast",
            label: "Forecast",
            permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
          }
        ]
      },
      { 
        to: "/budget", 
        icon: IndianRupee, 
        label: "Budget & Expenses",
        permissions: ["finances.read.all", "finances.read.regional", "finances.manage"]
      },
      { 
        label: "Donors",
        icon: Users,
        permissions: ["donors.read", "donors.read.regional", "donors.read.all"],
        submenu: [
          {
            to: "/donors/all",
            label: "All Donors",
            permissions: ["donors.read", "donors.read.regional", "donors.read.all"]
          },
          {
            to: "/donors/donations",
            label: "Donations",
            permissions: ["donations.create", "donations.read"]
          },
          {
            to: "/donors/history",
            label: "Donation History",
            permissions: ["donations.read", "donations.read.all"]
          }
        ]
      },
    ]
  },
  {
    label: "Website Management",
    items: [
      {
        to: "/website-settings",
        icon: Settings,
        label: "Website Settings",
        permissions: ["website.read", "settings.read"]
      },
      {
        to: "/banners",
        icon: ImageIcon,
        label: "Banners",
        permissions: ["website.read", "banners.read"]
      },
      {
        to: "/news-events",
        icon: Newspaper,
        label: "News & Events",
        permissions: ["website.read", "news.read"]
      },
      {
        to: "/brochures",
        icon: BookOpen,
        label: "Brochures",
        permissions: ["website.read", "brochures.read"]
      },
      {
        to: "/partners",
        icon: Users,
        label: "Partners",
        permissions: ["website.read", "partners.read"]
      }
    ]
  },
  {
    label: "System Administration",
    items: [
      { 
        label: "Locations",
        icon: MapPin,
        permissions: ["locations.read", "settings.read"],
        submenu: [
          {
            to: "/locations/districts",
            label: "Districts",
            permissions: ["locations.read", "settings.read"]
          },
          {
            to: "/locations/areas",
            label: "Areas",
            permissions: ["locations.read", "settings.read"]
          },
          {
            to: "/locations/units",
            label: "Units",
            permissions: ["locations.read", "settings.read"]
          }
        ]
      },
      { 
        to: "/users", 
        icon: Building2, 
        label: "User Management",
        permissions: ["users.read.all", "users.read.regional"]
      },
      { 
        to: "/roles", 
        icon: Shield, 
        label: "Role Management",
        permissions: ["roles.read"]
      },
      { 
        to: "/settings", 
        icon: Settings, 
        label: "Application Settings",
        permissions: ["config.write", "settings.write"],
        requireSuperAdmin: true
      },
      { 
        label: "Activity Logs",
        icon: Activity,
        permissions: ["activity_logs.read"],
        submenu: [
         
          {
            to: "/activity-logs/user-activity",
            label: "User Activity",
            permissions: ["activity_logs.read"]
          },
         
        ]
      },
    ]
  },
  {
    label: null,
    items: [
      { 
        to: "/communications", 
        icon: MessageSquare, 
        label: "Communications",
        permissions: ["communications.send"]
      },
    ]
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { hasAnyPermission } = useRBAC();
  const { user } = useAuth();
  const { menuStyle, sidebarSearchEnabled } = useConfig();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Menu style padding classes
  const menuPaddingClasses = {
    compact: 'py-2 px-3',
    comfortable: 'py-3 px-4',
    spacious: 'py-4 px-5'
  };
  
  const itemPaddingClass = menuPaddingClasses[menuStyle] || menuPaddingClasses.comfortable;
  
  // Check if user is area_admin, district_admin, or unit_admin
  const isLimitedAdmin = user && ['area_admin', 'district_admin', 'unit_admin'].includes(user.role);
  
  // Filter menu items for limited admins
  const getFilteredMenuCategories = () => {
    if (!isLimitedAdmin) {
      return menuCategories;
    }
    
    // For limited admins, show only Dashboard and limited Applications menu
    return [
      {
        label: null,
        items: [
          { 
            to: "/dashboard", 
            icon: LayoutDashboard, 
            label: "Dashboard",
            permissions: []
          },
        ]
      },
      {
        label: "Projects Management",
        items: [
          { 
            label: "Applications",
            icon: FileCheck,
            permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"],
            submenu: [
              {
                to: "/applications/all",
                label: "All Applications",
                permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
              },
              {
                to: "/applications/pending",
                label: "Pending",
                permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
              },
              {
                to: "/applications/interview-scheduled",
                label: "Interview Scheduled",
                permissions: ["applications.read.all", "applications.read.regional", "applications.read.own"]
              }
            ]
          }
        ]
      }
    ];
  };
  
  const filteredMenuCategories = getFilteredMenuCategories();
  
  // Flatten all menu items for search
  const allNavItems = filteredMenuCategories.flatMap(cat => 
    cat.items.flatMap((item: any) => {
      if (item.submenu) {
        // For submenu items, inherit the parent icon
        return item.submenu.map((subItem: any) => ({
          ...subItem,
          icon: item.icon // Use parent icon for submenu items
        }));
      }
      return [item];
    })
  ) as Array<{ to: string; label: string; icon: any; permissions: string[] }>;
  
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    "Projects Management": true,
    "Financial Management": true,
    "Administration": true,
    "Donors": true,
  });

  const toggleCategory = (label: string) => {
    setOpenCategories(prev => ({ ...prev, [label]: !prev[label] }));
  };

  // Helper function to check if a submenu item is active based on URL and query params
  const isSubmenuItemActive = (itemPath: string) => {
    const currentPath = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const filterParam = searchParams.get('filter');

    // Check for payment tracking filter-based routes
    if (currentPath === '/payment-tracking/all') {
      if (filterParam) {
        // If there's a filter, match it to the corresponding submenu item
        const filterToPathMap: Record<string, string> = {
          'overdue': '/payment-tracking/overdue',
          'due-soon': '/payment-tracking/due-soon',
          'upcoming': '/payment-tracking/upcoming',
          'processing': '/payment-tracking/processing',
          'completed': '/payment-tracking/completed',
        };
        return filterToPathMap[filterParam] === itemPath;
      } else {
        // No filter means "All Payments" should be active
        return itemPath === '/payment-tracking/all';
      }
    }

    // Check for application filter-based routes
    if (currentPath === '/applications/all') {
      if (filterParam) {
        const filterToPathMap: Record<string, string> = {
          'pending': '/applications/pending',
          'interview-scheduled': '/applications/interview-scheduled',
          'approved': '/applications/approved',
          'rejected': '/applications/rejected',
          'completed': '/applications/completed',
        };
        return filterToPathMap[filterParam] === itemPath;
      } else {
        return itemPath === '/applications/all';
      }
    }

    // Direct path match for other routes
    if (currentPath === itemPath) {
      return true;
    }

    return false;
  };

  // Filter menu items based on permissions
  const hasAccessToItem = (item: any) => {
    // Check super admin requirement
    if (item.requireSuperAdmin && user?.role !== 'super_admin') {
      return false;
    }
    
    if (!item.permissions || item.permissions.length === 0) {
      return true; // No permissions required
    }
    return hasAnyPermission(item.permissions);
  };

  // Filter categories to only show items user has access to
  const filteredCategories = filteredMenuCategories.map(category => ({
    ...category,
    items: category.items.filter(hasAccessToItem)
  })).filter(category => category.items.length > 0);

  const filteredItems = searchQuery
    ? allNavItems.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
        hasAccessToItem(item)
      )
    : null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-border/40 bg-card/80 backdrop-blur-xl shadow-elegant transition-transform duration-300 md:translate-x-0 overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarSearchEnabled && (
          <div className="p-4 border-b border-border/40 bg-background/40 backdrop-blur">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu..."
                className="pl-8 h-9 rounded-xl bg-background/70"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        <nav className="space-y-2 p-4">
          {filteredItems ? (
            // Search results
            filteredItems.length > 0 ? (
              filteredItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
                    itemPaddingClass,
                    isActive
                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:-translate-y-0.5"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
              ))
            ) : (
              <div className="text-center text-sm text-muted-foreground py-4">
                No menu items found
              </div>
            )
          ) : (
            // Categorized menu
            filteredCategories.map((category, idx) => (
              <div key={idx} className="mb-6 last:mb-0">
                {category.label ? (
                  <Collapsible
                    open={openCategories[category.label] ?? true}
                    onOpenChange={() => toggleCategory(category.label!)}
                  >
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                      {category.label}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          openCategories[category.label] && "transform rotate-180"
                        )}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {category.items.map((item) => (
                        item.submenu ? (
                          // Item with submenu
                          <Collapsible
                            key={item.label}
                            open={openCategories[item.label] ?? false}
                            onOpenChange={() => toggleCategory(item.label)}
                          >
                          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-xl transition-all">
                              <div className="flex items-center gap-3">
                                <item.icon className="h-5 w-5" />
                                {item.label}
                              </div>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  openCategories[item.label] && "transform rotate-180"
                                )}
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-2 mt-2 ml-8">
                              {item.submenu.filter(hasAccessToItem).map((subItem) => (
                                <NavLink
                                  key={subItem.to}
                                  to={subItem.to}
                                  onClick={onClose}
                                  className={() =>
                                    cn(
                                    "flex items-center rounded-xl text-sm font-medium transition-all",
                                      itemPaddingClass,
                                      isSubmenuItemActive(subItem.to)
                                      ? "bg-gradient-primary text-primary-foreground shadow-glow"
                                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:-translate-y-0.5"
                                    )
                                  }
                                >
                                  {subItem.label}
                                </NavLink>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          // Regular item
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={({ isActive }) =>
                              cn(
                              "flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
                                itemPaddingClass,
                                isActive
                                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:-translate-y-0.5"
                              )
                            }
                          >
                            <item.icon className="h-5 w-5" />
                            {item.label}
                          </NavLink>
                        )
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  // Uncategorized items
                  <div className="space-y-2">
                    {category.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          cn(
                          "flex items-center gap-3 rounded-xl text-sm font-medium transition-all",
                            itemPaddingClass,
                            isActive
                            ? "bg-gradient-primary text-primary-foreground shadow-glow"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground hover:-translate-y-0.5"
                          )
                        }
                      >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </nav>
      </aside>
    </>
  );
}
