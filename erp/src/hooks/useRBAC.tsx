import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { useAuth } from './useAuth';

const API_BASE_URL = import.meta.env.VITE_API_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_URL environment variable is required');
}

interface Permission {
  _id: string;
  name: string;
  displayName: string;
  module: string;
  category: string;
  scope: string;
  securityLevel: string;
}

interface Role {
  _id: string;
  name: string;
  displayName: string;
  level: number;
  category: string;
  permissions: Permission[];
}

interface UserRole {
  _id: string;
  role: Role;
  scope: {
    regions?: string[];
    projects?: string[];
    schemes?: string[];
  };
  isActive: boolean;
  isPrimary: boolean;
}

interface RBACContextType {
  userRoles: UserRole[];
  userPermissions: Permission[];
  hasPermission: (permissionName: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasRole: (roleName: string) => boolean;
  getUserRole: () => Role | null;
  isLoading: boolean;
  error: string | null;
  refreshPermissions: () => Promise<void>;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

interface RBACProviderProps {
  children: ReactNode;
}

export const RBACProvider = ({ children }: RBACProviderProps) => {
  const { user, token } = useAuth();
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRoles = async () => {
    if (!user || !token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/rbac/users/${user.id}/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          console.warn('Authentication error fetching user roles - user may need to login again');
          // Don't throw error, just return empty array to prevent logout loops
          setUserRoles([]);
          return;
        }
        throw new Error('Failed to fetch user roles');
      }

      const data = await response.json();
      setUserRoles(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user roles');
      console.error('Error fetching user roles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPermissions = async () => {
    if (!user || !token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/rbac/users/${user.id}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          console.warn('Authentication error fetching user permissions - user may need to login again');
          // Don't throw error, just return empty array to prevent logout loops
          setUserPermissions([]);
          return;
        }
        throw new Error('Failed to fetch user permissions');
      }

      const data = await response.json();
      setUserPermissions(data.data.permissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user permissions');
      console.error('Error fetching user permissions:', err);
    }
  };

  const refreshPermissions = async () => {
    await Promise.all([fetchUserRoles(), fetchUserPermissions()]);
  };

  useEffect(() => {
    if (user && token) {
      refreshPermissions();
    } else {
      setUserRoles([]);
      setUserPermissions([]);
    }
  }, [user, token]);

  const hasPermission = (permissionName: string): boolean => {
    // Super admin has all permissions - bypass check (mirrors backend middleware)
    if (user?.role === 'super_admin') return true;
    return userPermissions.some(permission => permission.name === permissionName);
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (user?.role === 'super_admin') return true;
    return permissions.some(permission => hasPermission(permission));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (user?.role === 'super_admin') return true;
    return permissions.every(permission => hasPermission(permission));
  };

  const hasRole = (roleName: string): boolean => {
    return userRoles.some(userRole => 
      userRole.isActive && userRole.role.name === roleName
    );
  };

  const getUserRole = (): Role | null => {
    const primaryRole = userRoles.find(userRole => 
      userRole.isActive && userRole.isPrimary
    );
    
    if (primaryRole) {
      return primaryRole.role;
    }

    // If no primary role, return the highest level role
    const activeRoles = userRoles.filter(userRole => userRole.isActive);
    if (activeRoles.length === 0) return null;

    return activeRoles.reduce((highest, current) => 
      current.role.level < highest.role.level ? current : highest
    ).role;
  };

  const contextValue: RBACContextType = {
    userRoles,
    userPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    getUserRole,
    isLoading,
    error,
    refreshPermissions
  };

  return (
    <RBACContext.Provider value={contextValue}>
      {children}
    </RBACContext.Provider>
  );
};

export const useRBAC = (): RBACContextType => {
  const context = useContext(RBACContext);
  if (context === undefined) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
};

// Higher-order component for permission-based rendering
interface WithPermissionProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export const WithPermission = ({ 
  permission, 
  permissions = [], 
  requireAll = false, 
  role,
  fallback = null,
  children 
}: WithPermissionProps) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole } = useRBAC();

  let hasAccess = true;

  if (role) {
    hasAccess = hasRole(role);
  } else if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

// Hook for checking permissions with loading state
export const usePermissionCheck = (permissionName: string) => {
  const { hasPermission, isLoading } = useRBAC();
  
  return {
    hasPermission: hasPermission(permissionName),
    isLoading
  };
};

// Hook for role-based navigation
export const useRoleNavigation = () => {
  const { getUserRole, hasPermission } = useRBAC();
  
  const getDefaultRoute = (): string => {
    const role = getUserRole();
    
    if (!role) return '/dashboard';
    
    switch (role.name) {
      case 'super_admin':
      case 'state_admin':
        return '/admin/dashboard';
      case 'district_admin':
      case 'area_admin':
      case 'unit_admin':
        return '/admin/regional-dashboard';
      case 'project_coordinator':
        return '/projects/dashboard';
      case 'scheme_coordinator':
        return '/schemes/dashboard';
      case 'beneficiary':
        return '/beneficiary/dashboard';
      default:
        return '/dashboard';
    }
  };

  const canAccessRoute = (route: string): boolean => {
    // Define route permissions mapping
    const routePermissions: Record<string, string[]> = {
      '/admin': ['users.read.regional'],
      '/users': ['users.read.regional'],
      '/beneficiaries': ['beneficiaries.read.regional'],
      '/applications': ['applications.read.regional'],
      '/projects': ['projects.read.assigned'],
      '/schemes': ['schemes.read.assigned'],
      '/reports': ['reports.read.regional'],
      '/finances': ['finances.read.regional']
    };

    const requiredPermissions = routePermissions[route];
    if (!requiredPermissions) return true;

    return requiredPermissions.some(permission => hasPermission(permission));
  };

  return {
    getDefaultRoute,
    canAccessRoute,
    getUserRole
  };
};