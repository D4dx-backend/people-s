import { useMemo } from 'react';
import { useConfig } from '@/contexts/ConfigContext';

/**
 * Returns the fully-qualified logo URL for the current org.
 * Derives the server origin from VITE_API_URL and appends
 * the logo path returned by the config API.
 */
export function useOrgLogoUrl(): string {
  const { org } = useConfig();

  return useMemo(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    // VITE_API_URL = "http://localhost:8000/api"
    // Strip the trailing /api (or /api/v1 etc.) to get the server origin
    const serverOrigin = apiUrl.replace(/\/api(\/v\d+)?$/, '');
    // org.logoUrl = "/api/assets/logo-xxx.png"
    return `${serverOrigin}${org.logoUrl}`;
  }, [org.logoUrl]);
}
