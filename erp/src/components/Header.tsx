import { Bell, User, Menu, LogOut, Search, Clock, KeyRound, CheckCheck, FileText, AlertTriangle, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { getTimeAgo } from "@/services/notificationService";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import logo from "@/assets/logo.png";

interface HeaderProps {
  onMenuClick?: () => void;
}

/** Format a relative time string like "2 mins ago", "3 hours ago", etc. */
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Notification icon based on category */
function NotificationIcon({ category }: { category: string }) {
  switch (category) {
    case 'application_status':
      return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
    case 'reminder':
      return <Clock className="h-4 w-4 text-yellow-500 shrink-0" />;
    case 'alert':
      return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

/** Real notification bell with API integration */
function NotificationBell() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, removeNotification } = useNotifications({ limit: 10 });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-muted/70">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full p-0 text-xs bg-destructive flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 bg-popover max-h-[480px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.preventDefault(); markAllAsRead(); }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="overflow-y-auto max-h-[380px] flex-1">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const isUnread = notification.recipients?.some(
                (r) => r.status !== 'read'
              );
              return (
                <div
                  key={notification._id}
                  className={`group flex items-start gap-3 px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-muted/50 transition-colors ${
                    isUnread ? 'bg-muted/20' : ''
                  }`}
                  onClick={() => { if (isUnread) markAsRead(notification._id); }}
                >
                  <NotificationIcon category={notification.category} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${isUnread ? 'font-semibold' : 'font-medium text-muted-foreground'}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {getTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => { e.stopPropagation(); removeNotification(notification._id); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  {isUnread && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [lastLogin, setLastLogin] = useState<string | null>(null);
  const [lastLoginDevice, setLastLoginDevice] = useState<string | null>(null);

  // Fetch last login for current user
  useEffect(() => {
    if (!user?.id) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    (async () => {
      try {
        const res = await api.request<any>(`/login-logs?userId=${user.id}&status=success&limit=2&sortBy=timestamp&sortOrder=desc`);
        const logs = res?.data?.logs;
        // The first entry is the *current* session — the second is the previous login
        if (logs && logs.length >= 2) {
          setLastLogin(logs[1].timestamp);
          const dev = logs[1].device;
          if (dev) {
            setLastLoginDevice([dev.browser, dev.os].filter(Boolean).join(' · ') || null);
          }
        } else if (logs && logs.length === 1) {
          // First ever login
          setLastLogin(logs[0].timestamp);
          const dev = logs[0].device;
          if (dev) {
            setLastLoginDevice([dev.browser, dev.os].filter(Boolean).join(' · ') || null);
          }
        }
      } catch {
        // Silently ignore — last login is a nice-to-have
      }
    })();
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to logout properly.",
        variant: "destructive",
      });
    }
  };

  /** Open the Command Palette (simulates Cmd/Ctrl + K) */
  const openCommandPalette = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: navigator.platform.includes('Mac'),
      ctrlKey: !navigator.platform.includes('Mac'),
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="relative flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          {onMenuClick && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="md:hidden hover:bg-muted/70">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-3">
            <img src={logo} alt="People's Foundation ERP" className="h-10 w-10 rounded-2xl shadow-sm" />
            <div className="hidden md:block">
              <h1 className="text-lg font-bold text-foreground">People's Foundation ERP</h1>
              <p className="text-xs text-muted-foreground">ERP Solution for NGOs</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ── Command Palette Trigger ── */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={openCommandPalette}
                className="hidden sm:inline-flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground hover:text-foreground rounded-xl border-border/60 bg-muted/30"
              >
                <Search className="h-4 w-4" />
                <span className="hidden lg:inline">Search menus…</span>
                <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search menus & actions (⌘K)</TooltipContent>
          </Tooltip>

          {/* ── Last Login Info ── */}
          {lastLogin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded-lg bg-muted/30 border border-border/40 cursor-default select-none">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{formatRelativeTime(lastLogin)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1">
                  <p className="text-xs font-medium">Last Login</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastLogin).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  {lastLoginDevice && (
                    <p className="text-xs text-muted-foreground">{lastLoginDevice}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 hover:bg-muted/70">
                <User className="h-5 w-5" />
                <span className="hidden md:inline">{user?.name || "User"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user?.role?.replace('_', ' ')}
                  </p>
                  {lastLogin && (
                    <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last login: {formatRelativeTime(lastLogin)}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <KeyRound className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-primary opacity-40" />
      </div>
    </header>
  );
}
