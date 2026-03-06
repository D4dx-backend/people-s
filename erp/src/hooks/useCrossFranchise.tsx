import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './useAuth';

const CROSS_FRANCHISE_ROLES = ['district_admin', 'area_admin', 'unit_admin'];
const STORAGE_KEY = 'crossFranchiseFilter';

export interface FranchiseOption {
  id: string;
  slug: string;
  displayName: string;
  logoUrl?: string;
  role: string;
}

interface CrossFranchiseContextType {
  franchises: FranchiseOption[];
  selectedFranchise: string;
  setSelectedFranchise: (id: string) => void;
  isCrossFranchise: boolean;
  isLoading: boolean;
  currentFranchiseId: string | null;
  refresh: () => Promise<void>;
}

const CrossFranchiseContext = createContext<CrossFranchiseContextType | undefined>(undefined);

export function useCrossFranchise(): CrossFranchiseContextType {
  const ctx = useContext(CrossFranchiseContext);
  if (!ctx) throw new Error('useCrossFranchise must be used within CrossFranchiseProvider');
  return ctx;
}

interface CrossFranchiseProviderProps {
  children: ReactNode;
}

export const CrossFranchiseProvider = ({ children }: CrossFranchiseProviderProps) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [franchises, setFranchises] = useState<FranchiseOption[]>([]);
  const [selectedFranchise, setSelectedFranchiseState] = useState<string>('all');
  const [isCrossFranchise, setIsCrossFranchise] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFranchiseId, setCurrentFranchiseId] = useState<string | null>(null);

  const setSelectedFranchise = useCallback((id: string) => {
    setSelectedFranchiseState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const fetchFranchises = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (!CROSS_FRANCHISE_ROLES.includes(u.role)) {
          setIsCrossFranchise(false);
          setFranchises([]);
          return;
        }
      } else {
        return;
      }

      setIsLoading(true);

      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) return;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const slug = import.meta.env.VITE_FRANCHISE_SLUG as string | undefined;
      if (slug) headers['X-Franchise-Slug'] = slug;

      const res = await fetch(`${API_BASE_URL}/auth/my-franchises`, { headers });
      if (!res.ok) return;

      const json = await res.json();
      if (json.success && json.data) {
        setFranchises(json.data.franchises || []);
        setIsCrossFranchise(json.data.isCrossFranchise || false);
        setCurrentFranchiseId(json.data.currentFranchiseId || null);

        if (json.data.isCrossFranchise) {
          const stored = localStorage.getItem(STORAGE_KEY);
          const validIds = ['all', ...(json.data.franchises || []).map((f: FranchiseOption) => f.id)];
          if (stored && validIds.includes(stored)) {
            setSelectedFranchiseState(stored);
          } else {
            setSelectedFranchiseState('all');
            localStorage.setItem(STORAGE_KEY, 'all');
          }
        }
      }
    } catch (err) {
      console.error('[CrossFranchise] Failed to load franchises:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated && user) {
      fetchFranchises();
    } else {
      setFranchises([]);
      setIsCrossFranchise(false);
      setCurrentFranchiseId(null);
    }
  }, [isAuthenticated, user, authLoading, fetchFranchises]);

  return (
    <CrossFranchiseContext.Provider
      value={{
        franchises,
        selectedFranchise,
        setSelectedFranchise,
        isCrossFranchise,
        isLoading,
        currentFranchiseId,
        refresh: fetchFranchises,
      }}
    >
      {children}
    </CrossFranchiseContext.Provider>
  );
};

export default CrossFranchiseContext;
