import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { users as usersApi, locations, type User } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, ShieldCheck, AlertCircle, Search, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { roleColors, roleNames } from "@/pages/UserManagement";

// Roles that need district → area → unit cascade selection
const NEEDS_DISTRICT = ["area_admin", "unit_admin", "area_president"];
const NEEDS_AREA     = ["unit_admin", "area_president"];

interface FranchiseMembership {
  id: string;
  displayName: string;
  slug: string;
  roles: string[];
}

interface ManageRolesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSave?: () => void;
}

// Role hierarchy — which roles the current user can assign
const roleHierarchy: Record<string, string[]> = {
  super_admin:    ["state_admin", "district_admin", "area_admin", "unit_admin", "area_president", "project_coordinator", "scheme_coordinator"],
  state_admin:    ["district_admin", "area_admin", "unit_admin", "area_president", "project_coordinator", "scheme_coordinator"],
  district_admin: ["area_admin", "unit_admin", "area_president"],
  area_admin:     ["unit_admin", "area_president"],
  unit_admin:     [],
  area_president: [],
};

export function ManageRolesModal({ open, onOpenChange, user, onSave }: ManageRolesModalProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [existingRoles, setExistingRoles] = useState<any[]>([]);
  const [franchiseMemberships, setFranchiseMemberships] = useState<FranchiseMembership[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Franchise scope selection
  const [franchiseScope, setFranchiseScope] = useState<"current" | "all" | "custom">("current");
  const [customFranchiseIds, setCustomFranchiseIds] = useState<string[]>([]);

  // Location state
  const [newRole, setNewRole]                   = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedArea, setSelectedArea]         = useState("");
  const [selectedRegion, setSelectedRegion]     = useState("");
  const [districts, setDistricts]               = useState<any[]>([]);
  const [areas, setAreas]                       = useState<any[]>([]);
  const [units, setUnits]                       = useState<any[]>([]);
  const [loadingAreas, setLoadingAreas]         = useState(false);
  const [loadingUnits, setLoadingUnits]         = useState(false);
  const [locationSearch, setLocationSearch]     = useState("");

  // Current franchise ID (from localStorage — set by tenantResolver on login)
  const currentFranchiseId = localStorage.getItem("franchiseId") || "";
  const currentFranchiseName =
    franchiseMemberships.find((f) => f.id === currentFranchiseId)?.displayName ||
    localStorage.getItem("franchiseName") ||
    "Current franchise";

  // ── Load on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && user?.id) {
      loadExistingRoles();
      loadFranchiseMemberships();
      loadDistricts();
      // Reset scope to "current" each time modal opens
      setFranchiseScope("current");
      setCustomFranchiseIds([]);
    }
  }, [open, user?.id]);

  // Reset location form when role changes
  useEffect(() => {
    setSelectedDistrict("");
    setSelectedArea("");
    setSelectedRegion("");
    setAreas([]);
    setUnits([]);
    setLocationSearch("");
  }, [newRole]);

  const loadExistingRoles = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await usersApi.getRoles(user.id);
      if (res.success && res.data) {
        setExistingRoles(res.data.roles || []);
      }
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load user roles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadDistricts = async () => {
    try {
      const res = await locations.getByType("district", { active: true, limit: 200 });
      if (res.success) setDistricts(res.data?.locations || []);
    } catch {}
  };

  const loadFranchiseMemberships = async () => {
    if (!user?.id) return;
    try {
      const res = await usersApi.getFranchiseMemberships(user.id);
      if (res.success && res.data) {
        setFranchiseMemberships(res.data.franchises || []);
      }
    } catch {} // non-critical
  };

  const handleDistrictChange = async (districtId: string) => {
    setSelectedDistrict(districtId);
    setSelectedArea("");
    setSelectedRegion("");
    setAreas([]);
    setUnits([]);
    if (!districtId) return;
    setLoadingAreas(true);
    try {
      const res = await locations.getAll({ type: "area", parent: districtId, limit: 200 });
      if (res.success) setAreas(res.data?.locations || []);
    } catch {} finally {
      setLoadingAreas(false);
    }
  };

  const handleAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedRegion("");
    setUnits([]);
    if (!areaId) return;
    setLoadingUnits(true);
    try {
      const res = await locations.getAll({ type: "unit", parent: areaId, limit: 200 });
      if (res.success) setUnits(res.data?.locations || []);
    } catch {} finally {
      setLoadingUnits(false);
    }
  };

  // ── Add role ──────────────────────────────────────────────────────────────
  const handleAddRole = async () => {
    if (!newRole || !user?.id) return;

    // Validate location selection
    if (NEEDS_DISTRICT.includes(newRole) && !selectedDistrict) {
      toast({ title: "Validation", description: "Please select a district", variant: "destructive" });
      return;
    }
    if (NEEDS_AREA.includes(newRole) && !selectedArea) {
      toast({ title: "Validation", description: "Please select an area", variant: "destructive" });
      return;
    }
    const needsUnit = newRole === "unit_admin" || newRole === "area_president";
    if (needsUnit && !selectedRegion) {
      toast({ title: "Validation", description: "Please select a unit", variant: "destructive" });
      return;
    }
    if (newRole === "area_admin" && !selectedRegion) {
      toast({ title: "Validation", description: "Please select an area", variant: "destructive" });
      return;
    }
    if (newRole === "district_admin" && !selectedRegion) {
      toast({ title: "Validation", description: "Please select a district", variant: "destructive" });
      return;
    }
    if (newRole === "state_admin" && !selectedRegion) {
      toast({ title: "Validation", description: "Please select a state", variant: "destructive" });
      return;
    }

    // Build adminScope
    const adminScope: any = { regions: selectedRegion ? [selectedRegion] : [] };
    if (newRole === "district_admin") {
      adminScope.district = selectedRegion;
    } else if (newRole === "area_admin") {
      adminScope.district = selectedDistrict;
      adminScope.area = selectedRegion;
    } else if (newRole === "unit_admin" || newRole === "area_president") {
      adminScope.district = selectedDistrict;
      adminScope.area = selectedArea;
      adminScope.unit = selectedRegion;
    }

    setSaving(true);
    try {
      // Resolve which franchise IDs to apply to
      let franchiseIds: string[] | undefined;
      if (franchiseMemberships.length > 1) {
        if (franchiseScope === "all") {
          franchiseIds = franchiseMemberships.map((f) => f.id);
        } else if (franchiseScope === "custom") {
          if (customFranchiseIds.length === 0) {
            toast({ title: "Validation", description: "Select at least one franchise", variant: "destructive" });
            setSaving(false);
            return;
          }
          franchiseIds = customFranchiseIds;
        }
        // "current" → no franchiseIds → backend uses req.franchiseId
      }

      const res = await usersApi.addRole(user.id, newRole, adminScope, franchiseIds);
      if (res.success) {
        const count = franchiseIds ? franchiseIds.length : 1;
        toast({ title: "Success", description: count > 1
          ? `${roleNames[newRole] || newRole} role added to ${count} franchises`
          : `${roleNames[newRole] || newRole} role added` });
        setNewRole("");
        setSelectedDistrict("");
        setSelectedArea("");
        setSelectedRegion("");
        await loadExistingRoles();
        onSave?.();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add role", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Remove role ───────────────────────────────────────────────────────────
  const handleRemoveRole = async (role: string) => {
    if (!user?.id) return;
    setRemoving(role);
    try {
      const res = await usersApi.removeRole(user.id, role);
      if (res.success) {
        toast({ title: "Removed", description: `${roleNames[role] || role} role removed` });
        await loadExistingRoles();
        onSave?.();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to remove role", variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const allowedNewRoles = (roleHierarchy[currentUser?.role ?? ""] || []).filter(
    (r) => !existingRoles.some((m) => m.role === r && m.isActive)
  );

  const getLocationLabel = (membership: any): string => {
    const scope = membership.adminScope;
    if (!scope) return "";
    const unit     = scope.unit?.name     || "";
    const area     = scope.area?.name     || "";
    const district = scope.district?.name || "";
    if (unit)     return `${unit} › ${area} › ${district}`;
    if (area)     return `${area} › ${district}`;
    if (district) return district;
    return "";
  };

  // Filtered lists for the location picker
  const filteredDistricts = districts.filter((d) =>
    d.name.toLowerCase().includes(locationSearch.toLowerCase())
  );
  const filteredAreas = areas.filter((a) =>
    a.name.toLowerCase().includes(locationSearch.toLowerCase())
  );
  const filteredUnits = units.filter((u) =>
    u.name.toLowerCase().includes(locationSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Manage Roles — {user?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* ── Current Roles ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Current Roles
            </h4>
            {loading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : existingRoles.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No roles assigned in this franchise yet.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {existingRoles.map((m) => {
                  const isRemovable = (roleHierarchy[currentUser?.role ?? ""] || []).includes(m.role);
                  const locationLabel = getLocationLabel(m);
                  return (
                    <div
                      key={m._id || m.role}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${roleColors[m.role] || ""} ${!m.isActive ? "opacity-50" : ""}`}
                          >
                            {roleNames[m.role] || m.role}
                          </Badge>
                          {!m.isActive && (
                            <span className="text-xs text-muted-foreground">(inactive)</span>
                          )}
                        </div>
                        {locationLabel && (
                          <span className="text-xs text-muted-foreground pl-0.5">{locationLabel}</span>
                        )}
                      </div>
                      {m.isActive && isRemovable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                          disabled={removing === m.role}
                          onClick={() => handleRemoveRole(m.role)}
                        >
                          {removing === m.role ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* ── Add New Role ───────────────────────────────────────────── */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Add Role
            </h4>

            {allowedNewRoles.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No additional roles can be assigned to this user.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Role selector */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedNewRoles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleNames[r] || r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* District selector */}
                {newRole === "district_admin" && (
                  <div className="space-y-2">
                    <Label>District *</Label>
                    <div className="space-y-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search districts…"
                          value={locationSearch}
                          onChange={(e) => setLocationSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="border rounded-lg max-h-48 overflow-y-auto">
                        {filteredDistricts.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-sm transition-colors ${
                              selectedRegion === d.id ? "bg-blue-50 border-l-2 border-blue-500" : ""
                            }`}
                            onClick={() => setSelectedRegion(d.id)}
                          >
                            {d.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* District → Area cascade (for area_admin) */}
                {newRole === "area_admin" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>District *</Label>
                      <Select value={selectedDistrict} onValueChange={handleDistrictChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select district first" />
                        </SelectTrigger>
                        <SelectContent>
                          {districts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedDistrict && (
                      <div className="space-y-2">
                        <Label>Area *</Label>
                        {loadingAreas ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading areas…
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="Search areas…"
                                value={locationSearch}
                                onChange={(e) => setLocationSearch(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                            <div className="border rounded-lg max-h-48 overflow-y-auto">
                              {filteredAreas.map((a) => (
                                <button
                                  key={a.id}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-sm transition-colors ${
                                    selectedRegion === a.id ? "bg-blue-50 border-l-2 border-blue-500" : ""
                                  }`}
                                  onClick={() => setSelectedRegion(a.id)}
                                >
                                  {a.name}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* District → Area → Unit cascade (for unit_admin / area_president) */}
                {NEEDS_AREA.includes(newRole) && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>District *</Label>
                      <Select value={selectedDistrict} onValueChange={handleDistrictChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select district first" />
                        </SelectTrigger>
                        <SelectContent>
                          {districts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedDistrict && (
                      <div className="space-y-2">
                        <Label>Area *</Label>
                        {loadingAreas ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading areas…
                          </div>
                        ) : (
                          <Select value={selectedArea} onValueChange={handleAreaChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select area" />
                            </SelectTrigger>
                            <SelectContent>
                              {areas.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    )}

                    {selectedArea && (
                      <div className="space-y-2">
                        <Label>Unit *</Label>
                        {loadingUnits ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading units…
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="Search units…"
                                value={locationSearch}
                                onChange={(e) => setLocationSearch(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                            <div className="border rounded-lg max-h-48 overflow-y-auto">
                              {filteredUnits.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-sm transition-colors ${
                                    selectedRegion === u.id ? "bg-blue-50 border-l-2 border-blue-500" : ""
                                  }`}
                                  onClick={() => setSelectedRegion(u.id)}
                                >
                                  {u.name}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {newRole && franchiseMemberships.length > 1 && (
                  <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
                      <Building2 className="h-4 w-4" />
                      Apply to which franchise(s)?
                    </div>
                    <RadioGroup
                      value={franchiseScope}
                      onValueChange={(v) => setFranchiseScope(v as "current" | "all" | "custom")}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="current" id="scope-current" />
                        <Label htmlFor="scope-current" className="cursor-pointer text-sm">
                          Current franchise only
                          <span className="ml-1 text-xs text-muted-foreground">({currentFranchiseName})</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="all" id="scope-all" />
                        <Label htmlFor="scope-all" className="cursor-pointer text-sm">
                          All franchises
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({franchiseMemberships.map((f) => f.displayName).join(" + ")})
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="scope-custom" />
                        <Label htmlFor="scope-custom" className="cursor-pointer text-sm">
                          Select specific franchises
                        </Label>
                      </div>
                    </RadioGroup>

                    {franchiseScope === "custom" && (
                      <div className="mt-2 space-y-2 pl-6">
                        {franchiseMemberships.map((f) => (
                          <div key={f.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`f-${f.id}`}
                              checked={customFranchiseIds.includes(f.id)}
                              onCheckedChange={(checked) =>
                                setCustomFranchiseIds((prev) =>
                                  checked
                                    ? [...prev, f.id]
                                    : prev.filter((id) => id !== f.id)
                                )
                              }
                            />
                            <Label htmlFor={`f-${f.id}`} className="cursor-pointer text-sm">
                              {f.displayName}
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({f.roles.map((r) => roleNames[r] || r).join(", ")})
                              </span>
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {newRole && (
                  <Button
                    className="w-full"
                    onClick={handleAddRole}
                    disabled={saving}
                  >
                    {saving ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…</>
                    ) : (
                      <><Plus className="mr-2 h-4 w-4" /> Add {roleNames[newRole] || newRole} Role</>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
