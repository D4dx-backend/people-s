/**
 * GlobalAdmin — Platform-level super admin panel.
 *
 * Only accessible to users with isSuperAdmin = true.
 * Allows managing franchises and assigning/removing franchise admins.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Plus, Trash2, UserPlus, UserX,
  RefreshCw, ShieldAlert, BarChart3, Globe, Phone, Mail, Link2, X as XIcon, LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { globalAdmin, locations as locationsApi, projects as projectsApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// ── Types ─────────────────────────────────────────────────────────────────────

const ADMIN_ROLES = [
  { value: 'super_admin',         label: 'Super Admin' },
  { value: 'state_admin',         label: 'State Admin' },
  { value: 'district_admin',      label: 'District Admin' },
  { value: 'area_admin',          label: 'Area Admin' },
  { value: 'unit_admin',          label: 'Unit Admin' },
  { value: 'project_coordinator', label: 'Project Coordinator' },
  { value: 'scheme_coordinator',  label: 'Scheme Coordinator' },
] as const;

type AdminRole = typeof ADMIN_ROLES[number]['value'];

interface Franchise {
  id: string;
  slug: string;
  displayName: string;
  name: string;
  isActive: boolean;
  domains: string[];
  settings?: any;
  createdAt?: string;
}

interface FranchiseAdmin {
  membershipId: string;
  isActive: boolean;
  joinedAt: string;
  role: AdminRole;
  user: { _id: string; id: string; name: string; phone: string; email?: string; isActive: boolean };
}

interface GlobalStats {
  franchises: number;
  users: number;
  beneficiaries: number;
  applications: number;
  donations: { total: number; count: number };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GlobalAdmin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Create franchise dialog
  const [createFranchiseOpen, setCreateFranchiseOpen] = useState(false);
  const [newFranchise, setNewFranchise] = useState({ slug: '', displayName: '', orgKey: '' });
  const [creatingFranchise, setCreatingFranchise] = useState(false);

  // Manage admins sheet
  const [adminsDialogFranchise, setAdminsDialogFranchise] = useState<Franchise | null>(null);
  const [admins, setAdmins] = useState<FranchiseAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  // Create admin dialog
  const [createAdminOpen, setCreateAdminOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState<{ name: string; phone: string; email: string; role: AdminRole }>({ name: '', phone: '', email: '', role: 'super_admin' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Scope selection state (district / area / unit / project) for scoped roles
  type ScopeOption = { id: string; name: string };
  const [scopeState, setScopeState] = useState({ districtId: '', areaId: '', unitId: '', projectId: '' });
  const [scopeDistricts, setScopeDistricts] = useState<ScopeOption[]>([]);
  const [scopeAreas, setScopeAreas]         = useState<ScopeOption[]>([]);
  const [scopeUnits, setScopeUnits]         = useState<ScopeOption[]>([]);
  const [scopeProjects, setScopeProjects]   = useState<ScopeOption[]>([]);
  const [scopeLoading, setScopeLoading]     = useState({ districts: false, areas: false, units: false, projects: false });

  // Domain management
  const [domainsDialogFranchise, setDomainsDialogFranchise] = useState<Franchise | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);

  // Deactivate franchise confirmation
  const [deactivateTarget, setDeactivateTarget] = useState<Franchise | null>(null);

  // Redirect non-super-admins
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [franchisesRes, statsRes] = await Promise.all([
        globalAdmin.listFranchises(),
        globalAdmin.getGlobalStats(),
      ]);
      if (franchisesRes.success) {
        const d = franchisesRes.data as any;
        setFranchises(d?.franchises || d || []);
      }
      if (statsRes.success) setStats(statsRes.data as GlobalStats);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Scope: load districts when form opens for location-scoped roles ─────────
  const LOCATION_SCOPED_ROLES: AdminRole[] = ['district_admin', 'area_admin', 'unit_admin'];
  const needsLocation = LOCATION_SCOPED_ROLES.includes(newAdmin.role);

  useEffect(() => {
    if (!createAdminOpen || !needsLocation) return;
    if (scopeDistricts.length > 0) return; // already loaded
    setScopeLoading(l => ({ ...l, districts: true }));
    locationsApi.getByType('district', { limit: 200 })
      .then((res: any) => {
        const list: any[] = res.data?.locations || [];
        setScopeDistricts(list.map(loc => ({ id: loc._id, name: loc.name })));
      })
      .catch(() => toast.error('Failed to load districts'))
      .finally(() => setScopeLoading(l => ({ ...l, districts: false })));
  }, [createAdminOpen, newAdmin.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scopeState.districtId) { setScopeAreas([]); return; }
    setScopeLoading(l => ({ ...l, areas: true }));
    locationsApi.getByType('area', { parent: scopeState.districtId, limit: 200 })
      .then((res: any) => {
        const list: any[] = res.data?.locations || [];
        setScopeAreas(list.map(loc => ({ id: loc._id, name: loc.name })));
      })
      .catch(() => toast.error('Failed to load areas'))
      .finally(() => setScopeLoading(l => ({ ...l, areas: false })));
  }, [scopeState.districtId]);

  useEffect(() => {
    if (!scopeState.areaId) { setScopeUnits([]); return; }
    setScopeLoading(l => ({ ...l, units: true }));
    locationsApi.getByType('unit', { parent: scopeState.areaId, limit: 200 })
      .then((res: any) => {
        const list: any[] = res.data?.locations || [];
        setScopeUnits(list.map(loc => ({ id: loc._id, name: loc.name })));
      })
      .catch(() => toast.error('Failed to load units'))
      .finally(() => setScopeLoading(l => ({ ...l, units: false })));
  }, [scopeState.areaId]);

  useEffect(() => {
    if (!createAdminOpen || newAdmin.role !== 'project_coordinator') return;
    setScopeLoading(l => ({ ...l, projects: true }));
    projectsApi.getAll({ limit: 200 })
      .then((res: any) => {
        const list: any[] = res.data?.projects || [];
        setScopeProjects(list.map(p => ({ id: p._id, name: p.name || p.title })));
      })
      .catch(() => toast.error('Failed to load projects'))
      .finally(() => setScopeLoading(l => ({ ...l, projects: false })));
  }, [createAdminOpen, newAdmin.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Franchise creation ──────────────────────────────────────────────────────
  const handleCreateFranchise = async () => {
    if (!newFranchise.slug || !newFranchise.displayName) {
      toast.error('Slug and display name are required');
      return;
    }
    setCreatingFranchise(true);
    try {
      const res = await globalAdmin.createFranchise({
        slug: newFranchise.slug.toLowerCase().trim(),
        displayName: newFranchise.displayName.trim(),
        orgKey: newFranchise.orgKey.trim() || undefined,
      } as any);
      if (res.success) {
        toast.success(`Franchise "${newFranchise.displayName}" created`);
        setCreateFranchiseOpen(false);
        setNewFranchise({ slug: '', displayName: '', orgKey: '' });
        loadData();
      } else {
        toast.error(res.message || 'Failed to create franchise');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create franchise');
    } finally {
      setCreatingFranchise(false);
    }
  };

  // ── Domain management ──────────────────────────────────────────────────────
  const openDomainsDialog = (franchise: Franchise) => {
    setDomainsDialogFranchise(franchise);
    setDomainInput('');
  };

  const handleAddDomain = async () => {
    if (!domainsDialogFranchise) return;
    const d = domainInput.trim().toLowerCase();
    if (!d) { toast.error('Enter a domain first'); return; }
    setDomainLoading(true);
    try {
      const res = await globalAdmin.addDomain(domainsDialogFranchise.id, d);
      if (res.success) {
        toast.success(`Domain "${d}" added`);
        setDomainInput('');
        const updated = { ...domainsDialogFranchise, domains: (res.data as any)?.domains || [...domainsDialogFranchise.domains, d] };
        setDomainsDialogFranchise(updated);
        setFranchises(prev => prev.map(f => f.id === updated.id ? updated : f));
      } else {
        toast.error((res as any).message || 'Failed to add domain');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add domain');
    } finally {
      setDomainLoading(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    if (!domainsDialogFranchise) return;
    setDomainLoading(true);
    try {
      const res = await globalAdmin.removeDomain(domainsDialogFranchise.id, domain);
      if (res.success) {
        toast.success(`Domain "${domain}" removed`);
        const updated = { ...domainsDialogFranchise, domains: (res.data as any)?.domains || domainsDialogFranchise.domains.filter(d => d !== domain) };
        setDomainsDialogFranchise(updated);
        setFranchises(prev => prev.map(f => f.id === updated.id ? updated : f));
      } else {
        toast.error((res as any).message || 'Failed to remove domain');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove domain');
    } finally {
      setDomainLoading(false);
    }
  };

  // ── Franchise deactivation ──────────────────────────────────────────────────
  const handleDeactivateFranchise = async () => {
    if (!deactivateTarget) return;
    try {
      const res = await globalAdmin.deactivateFranchise(deactivateTarget.id);
      if (res.success) {
        toast.success(`Franchise "${deactivateTarget.displayName}" deactivated`);
        setDeactivateTarget(null);
        loadData();
      } else {
        toast.error(res.message || 'Deactivation failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Deactivation failed');
    }
  };

  // ── Admins management ───────────────────────────────────────────────────────
  const openAdminsDialog = async (franchise: Franchise) => {
    setAdminsDialogFranchise(franchise);
    setAdmins([]);
    setAdminsLoading(true);
    try {
      const res = await globalAdmin.listFranchiseAdmins(franchise.id);
      if (res.success) setAdmins((res.data as any)?.admins || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load admins');
    } finally {
      setAdminsLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!adminsDialogFranchise) return;
    if (!newAdmin.name || !newAdmin.phone) {
      toast.error('Name and phone are required');
      return;
    }
    setCreatingAdmin(true);
    try {
      const res = await globalAdmin.createFranchiseAdmin(adminsDialogFranchise.id, {
        name: newAdmin.name.trim(),
        phone: newAdmin.phone.trim(),
        email: newAdmin.email.trim() || undefined,
        role: newAdmin.role,
        districtId: scopeState.districtId || undefined,
        areaId: scopeState.areaId || undefined,
        unitId: scopeState.unitId || undefined,
        projectId: scopeState.projectId || undefined,
      });
      if (res.success) {
        toast.success(res.message || 'Admin assigned successfully');
        setCreateAdminOpen(false);
        setNewAdmin({ name: '', phone: '', email: '', role: 'super_admin' });
        setScopeState({ districtId: '', areaId: '', unitId: '', projectId: '' });
        setScopeAreas([]); setScopeUnits([]);
        openAdminsDialog(adminsDialogFranchise);
      } else {
        toast.error(res.message || 'Failed to assign admin');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign admin');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeactivateAdmin = async (franchise: Franchise, adminUserId: string, adminName: string) => {
    try {
      const res = await globalAdmin.deactivateFranchiseAdmin(franchise.id, adminUserId);
      if (res.success) {
        toast.success(`${adminName}'s access removed`);
        openAdminsDialog(franchise);
      } else {
        toast.error(res.message || 'Failed to remove admin');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove admin');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!user?.isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Global Admin</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Platform management — all franchises</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.name || user?.phone}</span>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateFranchiseOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Franchise
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Franchises', value: stats.franchises, icon: Building2 },
              { label: 'Active Users', value: stats.users, icon: Users },
              { label: 'Beneficiaries', value: stats.beneficiaries, icon: Globe },
              { label: 'Applications', value: stats.applications, icon: BarChart3 },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="border-muted">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{label}</span>
                  </div>
                  <p className="text-2xl font-bold">{value?.toLocaleString() ?? '—'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Franchise list */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Franchises ({franchises.length})
          </h2>

          {loading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-5 pb-5">
                    <div className="h-5 bg-muted rounded w-40 mb-2" />
                    <div className="h-4 bg-muted rounded w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : franchises.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No franchises yet. Create your first one.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {franchises.map(f => (
                <Card key={f.id} className={`transition-shadow hover:shadow-md ${!f.isActive ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          {f.displayName || f.name}
                          {!f.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                          {f.isActive && <Badge variant="outline" className="text-xs text-green-600 border-green-300">Active</Badge>}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs mt-0.5">slug: {f.slug}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {f.domains?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {f.domains.map(d => (
                          <Badge key={d} variant="secondary" className="text-xs font-mono">{d}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openAdminsDialog(f)}
                      >
                        <Users className="h-3.5 w-3.5 mr-1" />
                        Manage Admins
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDomainsDialog(f)}
                      >
                        <Link2 className="h-3.5 w-3.5 mr-1" />
                        Domains {f.domains?.length > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">{f.domains.length}</Badge>}
                      </Button>
                      {f.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeactivateTarget(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Manage Domains Dialog ── */}
      <Dialog open={!!domainsDialogFranchise} onOpenChange={open => !open && setDomainsDialogFranchise(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {domainsDialogFranchise?.displayName} — Domains
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Custom domains route traffic to this franchise. The backend matches incoming requests by hostname.
            </p>

            {/* Existing domains */}
            {domainsDialogFranchise?.domains?.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">
                <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No custom domains yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {domainsDialogFranchise?.domains?.map(d => (
                  <div key={d} className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/30 font-mono text-sm">
                    <span className="truncate">{d}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                      disabled={domainLoading}
                      onClick={() => handleRemoveDomain(d)}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Add domain */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Add Domain</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="erp.peoplefoundation.org"
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
                  className="font-mono text-sm"
                />
                <Button onClick={handleAddDomain} disabled={domainLoading || !domainInput.trim()} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Press Enter or click + to add. Subdomains like <code>erp.example.org</code> are supported.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Franchise Dialog ── */}
      <Dialog open={createFranchiseOpen} onOpenChange={setCreateFranchiseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Franchise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Slug <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. people, bz"
                value={newFranchise.slug}
                onChange={e => setNewFranchise(f => ({ ...f, slug: e.target.value.toLowerCase() }))}
              />
              <p className="text-xs text-muted-foreground">Short unique identifier. Used in URLs and as subdomain.</p>
            </div>
            <div className="space-y-2">
              <Label>Display Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. People's Foundation"
                value={newFranchise.displayName}
                onChange={e => setNewFranchise(f => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Org Key <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. people_foundation, baithuzzakath"
                value={newFranchise.orgKey}
                onChange={e => setNewFranchise(f => ({ ...f, orgKey: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Matches a preset in <code>orgConfig.js</code>. Leave blank for a blank franchise.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFranchiseOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFranchise} disabled={creatingFranchise}>
              {creatingFranchise ? 'Creating…' : 'Create Franchise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate Franchise Confirmation ── */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={open => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate "{deactivateTarget?.displayName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the franchise from all users. Data is preserved. You can re-activate it manually in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeactivateFranchise}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Manage Admins Dialog ── */}
      <Dialog open={!!adminsDialogFranchise} onOpenChange={open => !open && setAdminsDialogFranchise(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {adminsDialogFranchise?.displayName} — Admins
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 overflow-y-auto max-h-[65vh] pr-1">
            {adminsLoading ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Loading admins…</div>
            ) : admins.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No admins yet. Assign one below.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {admins.map(a => (
                  <div
                    key={a.membershipId}
                    className={`flex items-center justify-between p-3 rounded-lg border ${!a.isActive ? 'opacity-50 bg-muted/30' : 'bg-card'}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{a.user?.name || '—'}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.user?.phone}</span>
                        {a.user?.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{a.user.email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {ADMIN_ROLES.find(r => r.value === a.role)?.label ?? a.role}
                      </Badge>
                      {a.isActive
                        ? <Badge variant="outline" className="text-xs text-green-600 border-green-300">Active</Badge>
                        : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      {a.isActive && adminsDialogFranchise && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeactivateAdmin(adminsDialogFranchise, a.user?._id || a.user?.id, a.user?.name)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Create admin inline form */}
            {!createAdminOpen ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setCreateAdminOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Assign New Admin
              </Button>
            ) : (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-medium">Assign New Admin</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Name *</Label>
                    <Input
                      placeholder="Full name"
                      value={newAdmin.name}
                      onChange={e => setNewAdmin(a => ({ ...a, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Phone *</Label>
                    <Input
                      placeholder="10-digit mobile"
                      value={newAdmin.phone}
                      onChange={e => setNewAdmin(a => ({ ...a, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email (optional)</Label>
                  <Input
                    type="email"
                    placeholder="admin@example.com"
                    value={newAdmin.email}
                    onChange={e => setNewAdmin(a => ({ ...a, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role *</Label>
                  <Select value={newAdmin.role} onValueChange={v => {
                    setNewAdmin(a => ({ ...a, role: v as AdminRole }));
                    setScopeState({ districtId: '', areaId: '', unitId: '', projectId: '' });
                    setScopeAreas([]); setScopeUnits([]);
                  }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADMIN_ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Scope selects: shown only for scoped roles ── */}
                {(newAdmin.role === 'district_admin' || newAdmin.role === 'area_admin' || newAdmin.role === 'unit_admin') && (
                  <div className="space-y-1">
                    <Label className="text-xs">District *</Label>
                    <Select
                      value={scopeState.districtId}
                      onValueChange={v => setScopeState(s => ({ ...s, districtId: v, areaId: '', unitId: '' }))}
                      disabled={scopeLoading.districts}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={scopeLoading.districts ? 'Loading…' : 'Select district'} />
                      </SelectTrigger>
                      <SelectContent>
                        {scopeDistricts.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(newAdmin.role === 'area_admin' || newAdmin.role === 'unit_admin') && scopeState.districtId && (
                  <div className="space-y-1">
                    <Label className="text-xs">Area *</Label>
                    <Select
                      value={scopeState.areaId}
                      onValueChange={v => setScopeState(s => ({ ...s, areaId: v, unitId: '' }))}
                      disabled={scopeLoading.areas}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={scopeLoading.areas ? 'Loading…' : 'Select area'} />
                      </SelectTrigger>
                      <SelectContent>
                        {scopeAreas.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newAdmin.role === 'unit_admin' && scopeState.areaId && (
                  <div className="space-y-1">
                    <Label className="text-xs">Unit *</Label>
                    <Select
                      value={scopeState.unitId}
                      onValueChange={v => setScopeState(s => ({ ...s, unitId: v }))}
                      disabled={scopeLoading.units}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={scopeLoading.units ? 'Loading…' : 'Select unit'} />
                      </SelectTrigger>
                      <SelectContent>
                        {scopeUnits.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newAdmin.role === 'project_coordinator' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Project *</Label>
                    <Select
                      value={scopeState.projectId}
                      onValueChange={v => setScopeState(s => ({ ...s, projectId: v }))}
                      disabled={scopeLoading.projects}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={scopeLoading.projects ? 'Loading…' : 'Select project'} />
                      </SelectTrigger>
                      <SelectContent>
                        {scopeProjects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  The admin will log in using OTP to their phone number. No password needed.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateAdmin} disabled={creatingAdmin}>
                    {creatingAdmin ? 'Assigning…' : 'Assign Admin'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setCreateAdminOpen(false);
                    setNewAdmin({ name: '', phone: '', email: '', role: 'super_admin' });
                    setScopeState({ districtId: '', areaId: '', unitId: '', projectId: '' });
                    setScopeAreas([]); setScopeUnits([]);
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
