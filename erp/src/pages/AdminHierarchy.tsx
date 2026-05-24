import { useState, useEffect, useMemo } from "react";
import { Users, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const ROLE_LABELS: Record<string, string> = {
  district_admin:  'District Admin',
  area_admin:      'Area Admin',
  unit_admin:      'Unit Admin',
  area_president:  'Area President',
};

const ROLE_COLORS: Record<string, string> = {
  district_admin: 'bg-blue-100 text-blue-800 border-blue-200',
  area_admin:     'bg-purple-100 text-purple-800 border-purple-200',
  unit_admin:     'bg-green-100 text-green-800 border-green-200',
  area_president: 'bg-orange-100 text-orange-800 border-orange-200',
};

const LOCATION_LABEL: Record<string, string> = {
  district_admin: 'District',
  area_admin:     'Area',
  area_president: 'Area',
  unit_admin:     'Unit',
};

interface Subordinate {
  userId: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  locationName?: string;
  adminScope?: {
    district?: string;
    area?: string;
    unit?: string;
    level?: string;
  };
}

export default function AdminHierarchy() {
  const { token, isAuthenticated, isLoading: authLoading } = useAuth();
  const [subordinates, setSubordinates] = useState<Subordinate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const fetchSubordinates = async () => {
    if (!isAuthenticated || !token) return;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/users/subordinates`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to fetch subordinates');
      }

      const data = await res.json();
      setSubordinates(data.data?.subordinates ?? []);
    } catch (err: any) {
      const msg = err.message || 'Failed to load admin hierarchy';
      setError(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchSubordinates();
    } else if (!authLoading) {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  // Unique roles present in the list (for filter buttons)
  const availableRoles = useMemo(() => {
    const roles = Array.from(new Set(subordinates.map(s => s.role)));
    return roles.sort();
  }, [subordinates]);

  const filtered = subordinates.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.name?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.role?.includes(q) ||
      s.locationName?.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Admin Hierarchy</h1>
            <p className="text-sm text-muted-foreground">Subordinate administrators under your scope</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSubordinates} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search + Role Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Input
          placeholder="Search by name, phone, role, or location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {availableRoles.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={roleFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setRoleFilter('all')}
            >
              All
            </Button>
            {availableRoles.map(role => (
              <Button
                key={role}
                size="sm"
                variant={roleFilter === role ? 'default' : 'outline'}
                onClick={() => setRoleFilter(role)}
              >
                {ROLE_LABELS[role] ?? role}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {filtered.length} admin{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {search ? 'No admins match your search.' : 'No subordinate admins found.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((s) => (
                    <tr key={s.userId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{s.name || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={ROLE_COLORS[s.role] ?? ''}>
                          {ROLE_LABELS[s.role] ?? s.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {s.locationName ? (
                          <span className="text-sm">
                            <span className="text-muted-foreground text-xs mr-1">
                              {LOCATION_LABEL[s.role] ?? ''}
                            </span>
                            {s.locationName}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.isActive ? 'default' : 'secondary'}>
                          {s.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
