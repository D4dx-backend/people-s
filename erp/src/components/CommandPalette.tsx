import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '@/hooks/useConfig';
import { useRBAC } from '@/hooks/useRBAC';
import { useAuth } from '@/hooks/useAuth';
import {
  menuCategories,
  limitedAdminMenuCategories,
  type MenuCategory,
  type MenuItem,
  type SubMenuItem,
} from '@/lib/menuConfig';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Sun,
  Moon,
  Laptop,
  RefreshCw,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────

interface PaletteCommand {
  id: string;
  label: string;
  icon: LucideIcon;
  action: () => void;
  group: string;
  keywords?: string[];
}

// ── Component ──────────────────────────────────────────────────────

const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { commandPaletteEnabled, refreshConfig } = useConfig();
  const { hasAnyPermission } = useRBAC();
  const { user, logout } = useAuth();

  // Toggle with Ctrl/Cmd + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // ── Permission helpers (same logic as Sidebar) ──

  const isLimitedAdmin = user && ['area_admin', 'district_admin', 'unit_admin'].includes(user.role);

  const hasAccessToItem = useCallback(
    (item: { permissions: string[]; requireSuperAdmin?: boolean }) => {
      if (item.requireSuperAdmin && user?.role !== 'super_admin') return false;
      if (!item.permissions || item.permissions.length === 0) return true;
      return hasAnyPermission(item.permissions);
    },
    [hasAnyPermission, user]
  );

  // ── Build filtered navigation commands from shared menu config ──

  const navigationCommands = useMemo<PaletteCommand[]>(() => {
    const sourceCategories: MenuCategory[] = isLimitedAdmin
      ? limitedAdminMenuCategories
      : menuCategories;

    const commands: PaletteCommand[] = [];

    sourceCategories.forEach((category) => {
      const groupName = category.label || 'Navigation';

      category.items.forEach((item: MenuItem) => {
        if (!hasAccessToItem(item)) return;

        if (item.submenu && item.submenu.length > 0) {
          // Add each submenu item with a breadcrumb label
          item.submenu.forEach((sub: SubMenuItem) => {
            if (!hasAccessToItem(sub)) return;
            commands.push({
              id: `nav-${sub.to.replace(/\//g, '-')}`,
              label: `${item.label} › ${sub.label}`,
              icon: item.icon,
              action: () => navigate(sub.to),
              group: groupName,
              keywords: [
                ...(item.keywords || []),
                ...(sub.keywords || []),
                item.label.toLowerCase(),
                sub.label.toLowerCase(),
              ],
            });
          });
        } else if (item.to) {
          // Direct link
          commands.push({
            id: `nav-${item.to.replace(/\//g, '-')}`,
            label: item.label,
            icon: item.icon,
            action: () => navigate(item.to!),
            group: groupName,
            keywords: [
              ...(item.keywords || []),
              item.label.toLowerCase(),
            ],
          });
        }
      });
    });

    return commands;
  }, [isLimitedAdmin, hasAccessToItem, navigate]);

  // ── Quick-action commands ──

  const actionCommands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: 'action-refresh-config',
        label: 'Refresh Configuration',
        icon: RefreshCw,
        action: async () => {
          await refreshConfig();
          toast.success('Configuration refreshed');
        },
        group: 'Actions',
        keywords: ['refresh', 'reload', 'config'],
      },
      {
        id: 'action-logout',
        label: 'Logout',
        icon: LogOut,
        action: () => {
          logout();
          navigate('/login');
        },
        group: 'Actions',
        keywords: ['logout', 'signout', 'exit'],
      },
    ],
    [refreshConfig, logout, navigate]
  );

  // ── Theme commands ──

  const themeCommands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: 'theme-light',
        label: 'Switch to Light Mode',
        icon: Sun,
        action: () => toast.info('Theme changes require admin permission'),
        group: 'Theme',
        keywords: ['light', 'bright', 'theme'],
      },
      {
        id: 'theme-dark',
        label: 'Switch to Dark Mode',
        icon: Moon,
        action: () => toast.info('Theme changes require admin permission'),
        group: 'Theme',
        keywords: ['dark', 'night', 'theme'],
      },
      {
        id: 'theme-system',
        label: 'Use System Theme',
        icon: Laptop,
        action: () => toast.info('Theme changes require admin permission'),
        group: 'Theme',
        keywords: ['system', 'auto', 'default', 'theme'],
      },
    ],
    []
  );

  // ── Merge all commands ──

  const allCommands = useMemo(
    () => [...navigationCommands, ...actionCommands, ...themeCommands],
    [navigationCommands, actionCommands, themeCommands]
  );

  // Group by category, preserving insertion order
  const groupedCommands = useMemo(() => {
    const map = new Map<string, PaletteCommand[]>();
    allCommands.forEach((cmd) => {
      if (!map.has(cmd.group)) map.set(cmd.group, []);
      map.get(cmd.group)!.push(cmd);
    });
    return map;
  }, [allCommands]);

  const handleSelect = useCallback(
    (commandId: string) => {
      const command = allCommands.find((cmd) => cmd.id === commandId);
      if (command) {
        setOpen(false);
        // Small delay so the dialog closes before navigation
        setTimeout(() => command.action(), 100);
      }
    },
    [allCommands]
  );

  // Don't render if disabled
  if (!commandPaletteEnabled) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search menus & actions… (⌘K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {Array.from(groupedCommands.entries()).map(([group, commands], index) => (
          <React.Fragment key={group}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {commands.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.id}
                    value={cmd.label}
                    onSelect={() => handleSelect(cmd.id)}
                    keywords={cmd.keywords}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0" />
                    <span>{cmd.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
};

export default memo(CommandPalette);
