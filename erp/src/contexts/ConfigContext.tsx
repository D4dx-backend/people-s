import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { config as configApi } from '@/lib/api';
import { toast } from 'sonner';

export type ColorTheme = 'blue' | 'purple' | 'green';
export type MenuStyle = 'compact' | 'comfortable' | 'spacious';

// Organization branding loaded from backend (driven by ORG_NAME env var)
export interface OrgBranding {
  key: string;
  displayName: string;
  erpTitle: string;
  erpSubtitle: string;
  tagline: string;
  regNumber: string;
  email: string;
  supportEmail: string;
  paymentsEmail: string;
  phone: string;
  address: string;
  website: string;
  websiteUrl: string;
  defaultTheme: ColorTheme;
  copyrightText: string;
  logoUrl: string;
  heroSubtext: string;
  aboutText: string;
  footerText: string;
  communityLabel: string;
  communityDescription: string;
}

const DEFAULT_ORG: OrgBranding = {
  key: 'people_foundation',
  displayName: "People's Foundation",
  erpTitle: "People's Foundation ERP",
  erpSubtitle: 'ERP Solution for NGOs',
  tagline: 'Empowering Communities Through Compassion and Service',
  regNumber: 'KL/TC/456/2022',
  email: 'info@peoplefoundation.org',
  supportEmail: 'support@peoplefoundation.org',
  paymentsEmail: 'payments@peoplefoundation.org',
  phone: '+91-495-9876543',
  address: "People's Foundation, Kozhikode, Kerala - 673001",
  website: 'www.peoplefoundation.org',
  websiteUrl: 'https://peoplefoundation.org',
  defaultTheme: 'blue',
  copyrightText: `© ${new Date().getFullYear()} People's Foundation. All rights reserved.`,
  logoUrl: '/api/assets/logo-peoplefoundation.png',
  heroSubtext: 'Empowering communities through transparent welfare distribution, supporting education, healthcare, and livelihood initiatives',
  aboutText: "People's Foundation ERP is dedicated to the transparent and effective distribution of welfare funds to support underprivileged communities. We run comprehensive programs in education, healthcare, housing, and livelihood development, ensuring that assistance reaches those who need it most.",
  footerText: 'Dedicated to transparent welfare distribution and community empowerment',
  communityLabel: 'Community Values',
  communityDescription: 'Guided by principles of compassion, equity, and social justice',
};

interface ConfigContextType {
  // Theme settings
  colorTheme: ColorTheme;
  darkMode: boolean;
  
  // Menu settings
  menuStyle: MenuStyle;
  sidebarSearchEnabled: boolean;
  sidebarPosition: 'left' | 'right';
  
  // Feature toggles
  commandPaletteEnabled: boolean;
  notificationsEnabled: boolean;
  activityLoggingEnabled: boolean;

  // Organization branding
  org: OrgBranding;
  
  // Loading state
  loading: boolean;
  
  // Refresh configuration from server
  refreshConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: ReactNode;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ children }) => {
  const [colorTheme, setColorTheme] = useState<ColorTheme>('blue');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [menuStyle, setMenuStyle] = useState<MenuStyle>('comfortable');
  const [sidebarSearchEnabled, setSidebarSearchEnabled] = useState<boolean>(true);
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left');
  const [commandPaletteEnabled, setCommandPaletteEnabled] = useState<boolean>(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [activityLoggingEnabled, setActivityLoggingEnabled] = useState<boolean>(true);
  const [org, setOrg] = useState<OrgBranding>(DEFAULT_ORG);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch configuration from server
  const fetchConfig = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching config from database...');
      const response = await configApi.getPublic();
      console.log('📥 Config response:', response);
      
      if (response.success && response.data?.config) {
        const { theme, menu, features, org: orgData } = response.data.config;
        console.log('🎨 Theme from database:', theme);
        
        // Apply org branding
        if (orgData) {
          console.log('🏢 Org branding loaded:', orgData.key);
          setOrg({ ...DEFAULT_ORG, ...orgData } as OrgBranding);
          // Update browser tab title dynamically
          document.title = orgData.erpTitle || DEFAULT_ORG.erpTitle;
        }

        // Determine effective theme: DB setting > org default > blue
        const effectiveTheme = theme?.colorTheme || orgData?.defaultTheme || 'blue';
        const effectiveDark = typeof theme?.darkMode === 'boolean' ? theme.darkMode : false;

        // Apply theme settings
        if (theme) {
          if (theme.colorTheme) {
            console.log('🎨 Setting color theme to:', theme.colorTheme);
            setColorTheme(theme.colorTheme as ColorTheme);
          } else if (orgData?.defaultTheme) {
            // No explicit theme in DB — use org default
            setColorTheme(orgData.defaultTheme as ColorTheme);
          }
          if (typeof theme.darkMode === 'boolean') {
            console.log('🌙 Setting dark mode to:', theme.darkMode);
            setDarkMode(theme.darkMode);
          }
        } else if (orgData?.defaultTheme) {
          // No theme config at all — use org default
          setColorTheme(orgData.defaultTheme as ColorTheme);
        }
        
        // Apply menu settings
        if (menu) {
          if (menu.menuStyle) setMenuStyle(menu.menuStyle as MenuStyle);
          if (typeof menu.sidebarSearchEnabled === 'boolean') setSidebarSearchEnabled(menu.sidebarSearchEnabled);
          if (menu.sidebarPosition) setSidebarPosition(menu.sidebarPosition);
        }
        
        // Apply feature settings
        if (features) {
          if (typeof features.commandPaletteEnabled === 'boolean') setCommandPaletteEnabled(features.commandPaletteEnabled);
          if (typeof features.notificationsEnabled === 'boolean') setNotificationsEnabled(features.notificationsEnabled);
          if (typeof features.activityLoggingEnabled === 'boolean') setActivityLoggingEnabled(features.activityLoggingEnabled);
        }
        
        // Apply theme to document immediately
        console.log('✨ Applying theme to document:', effectiveTheme, effectiveDark);
        applyTheme(effectiveTheme as ColorTheme, effectiveDark);
      }
    } catch (error) {
      console.error('Failed to fetch configuration:', error);
      toast.error('Failed to load application configuration');
      
      // Apply default theme on error
      applyTheme('blue', false);
    } finally {
      setLoading(false);
    }
  };

  // Apply theme to document root
  const applyTheme = (theme: ColorTheme, dark: boolean) => {
    const root = document.documentElement;
    
    console.log('🎨 Applying theme to DOM:', { theme, dark });
    console.log('📋 Current data-theme attribute:', root.getAttribute('data-theme'));
    
    // Set data-theme attribute
    root.setAttribute('data-theme', theme);
    console.log('✅ Set data-theme to:', theme);
    
    // Toggle dark class
    if (dark) {
      root.classList.add('dark');
      console.log('✅ Added dark class');
    } else {
      root.classList.remove('dark');
      console.log('✅ Removed dark class');
    }
    
    // Add smooth transitions
    root.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    // Force a style recalculation
    void root.offsetHeight;
    
    console.log('📋 Final data-theme attribute:', root.getAttribute('data-theme'));
    console.log('📋 Final classList:', root.classList.value);
  };

  // Fetch configuration on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  // Apply theme whenever colorTheme or darkMode changes
  useEffect(() => {
    console.log('🔔 Theme state changed:', { colorTheme, darkMode });
    applyTheme(colorTheme, darkMode);
  }, [colorTheme, darkMode]);

  // Refresh configuration (can be called manually)
  const refreshConfig = async () => {
    await fetchConfig();
  };

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      colorTheme,
      darkMode,
      menuStyle,
      sidebarSearchEnabled,
      sidebarPosition,
      commandPaletteEnabled,
      notificationsEnabled,
      activityLoggingEnabled,
      org,
      loading,
      refreshConfig,
    }),
    [
      colorTheme,
      darkMode,
      menuStyle,
      sidebarSearchEnabled,
      sidebarPosition,
      commandPaletteEnabled,
      notificationsEnabled,
      activityLoggingEnabled,
      org,
      loading,
    ]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
