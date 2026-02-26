/**
 * FranchiseContext
 * ================
 * Provides the current franchise identity (slug) to the entire React app.
 *
 * The slug is derived from the hostname subdomain, matching the same logic
 * used in the backend tenantResolver middleware.
 *
 * Consumers can use `useFranchise()` to get:
 *  - `franchiseSlug`  — e.g. "people" or "bz" (undefined on localhost without env override)
 *  - `isMultiTenant`  — true when a franchise is identified
 */
import React, { createContext, useContext, useMemo, ReactNode } from 'react';

interface FranchiseContextType {
  /** The franchise slug derived from the current hostname */
  franchiseSlug: string | undefined;
  /** True when a franchise slug is present (multi-tenant mode) */
  isMultiTenant: boolean;
}

const FranchiseContext = createContext<FranchiseContextType | undefined>(undefined);

export function useFranchise(): FranchiseContextType {
  const ctx = useContext(FranchiseContext);
  if (!ctx) throw new Error('useFranchise must be used within FranchiseProvider');
  return ctx;
}

/**
 * Derives the franchise slug from the current window hostname.
 * Mirrors api.ts `getFranchiseSlug()` logic (kept in sync manually).
 */
function detectFranchiseSlug(): string | undefined {
  // Allow a hard override — useful for local development
  const envSlug = import.meta.env.VITE_FRANCHISE_SLUG as string | undefined;
  if (envSlug) return envSlug;

  const hostname = window.location.hostname;

  // Ignore localhost / raw IP addresses
  if (hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return undefined;
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (sub !== 'www' && sub !== 'api' && sub !== 'app') {
      return sub;
    }
  }

  return undefined;
}

interface FranchiseProviderProps {
  children: ReactNode;
}

export const FranchiseProvider: React.FC<FranchiseProviderProps> = ({ children }) => {
  // The slug is static for the lifetime of the page (subdomains don't change at runtime)
  const franchiseSlug = useMemo(() => detectFranchiseSlug(), []);
  const isMultiTenant = !!franchiseSlug;

  return (
    <FranchiseContext.Provider value={{ franchiseSlug, isMultiTenant }}>
      {children}
    </FranchiseContext.Provider>
  );
};

export default FranchiseContext;
