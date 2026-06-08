import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRightLeft, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { applications, locations } from "@/lib/api";

interface LocationRef {
  _id: string;
  name?: string | null;
  code?: string | null;
}

export interface TransferApplicationTarget {
  _id: string;
  applicationNumber?: string;
  district?: LocationRef | string | null;
  area?: LocationRef | string | null;
  unit?: LocationRef | string | null;
}

interface TransferApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: TransferApplicationTarget | null;
  onTransferred?: () => void;
}

const idOf = (v: LocationRef | string | null | undefined): string =>
  !v ? "" : typeof v === "string" ? v : v._id || "";

const nameOf = (v: LocationRef | string | null | undefined): string =>
  !v || typeof v === "string" ? "" : v.name || "";

/** Normalise the various shapes the locations API may return into a flat list. */
const extractLocations = (res: unknown): LocationRef[] => {
  const r = res as { data?: { locations?: LocationRef[] }; locations?: LocationRef[] } | null | undefined;
  return r?.data?.locations || r?.locations || [];
};

export function TransferApplicationModal({ isOpen, onClose, application, onTransferred }: TransferApplicationModalProps) {
  const [districts, setDistricts] = useState<LocationRef[]>([]);
  const [areas, setAreas] = useState<LocationRef[]>([]);
  const [units, setUnits] = useState<LocationRef[]>([]);
  const [district, setDistrict] = useState("");
  const [area, setArea] = useState("");
  const [unit, setUnit] = useState("");
  const [reason, setReason] = useState("");
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadAreas = useCallback(async (districtId: string) => {
    if (!districtId) { setAreas([]); return; }
    setLoadingAreas(true);
    try {
      const res = await locations.getByType("area", { parent: districtId, active: true });
      setAreas(extractLocations(res));
    } catch {
      setAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  }, []);

  const loadUnits = useCallback(async (areaId: string) => {
    if (!areaId) { setUnits([]); return; }
    setLoadingUnits(true);
    try {
      const res = await locations.getByType("unit", { parent: areaId, active: true });
      setUnits(extractLocations(res));
    } catch {
      setUnits([]);
    } finally {
      setLoadingUnits(false);
    }
  }, []);

  // Initialise selectors from the application's current location when opened.
  useEffect(() => {
    if (!isOpen || !application) return;
    const curDistrict = idOf(application.district);
    const curArea = idOf(application.area);
    const curUnit = idOf(application.unit);
    setDistrict(curDistrict);
    setArea(curArea);
    setUnit(curUnit);
    setReason("");
    setAreas([]);
    setUnits([]);

    (async () => {
      setLoadingDistricts(true);
      try {
        const res = await locations.getByType("district", { active: true, limit: 200 });
        setDistricts(extractLocations(res));
      } catch {
        setDistricts([]);
      } finally {
        setLoadingDistricts(false);
      }
      if (curDistrict) await loadAreas(curDistrict);
      if (curArea) await loadUnits(curArea);
    })();
  }, [isOpen, application, loadAreas, loadUnits]);

  const handleDistrictChange = async (value: string) => {
    setDistrict(value);
    setArea("");
    setUnit("");
    setUnits([]);
    await loadAreas(value);
  };

  const handleAreaChange = async (value: string) => {
    setArea(value);
    setUnit("");
    await loadUnits(value);
  };

  const handleSubmit = async () => {
    if (!application) return;
    if (!area || !unit) {
      toast({ title: "Area & unit required", description: "Please select the destination area and unit.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await applications.updateLocation(application._id, {
        district: district || undefined,
        area,
        unit,
        reason: reason.trim() || undefined,
      });
      toast({ title: "Application transferred", description: "The application has been moved to the selected location." });
      onTransferred?.();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not transfer the application.";
      toast({ title: "Transfer failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currentLabel = application
    ? [nameOf(application.district), nameOf(application.area), nameOf(application.unit)].filter(Boolean).join(" › ")
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Application
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {application?.applicationNumber && (
            <p className="text-sm text-muted-foreground">
              Application <span className="font-mono font-medium">{application.applicationNumber}</span>
            </p>
          )}
          {currentLabel && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Current location</div>
                <div className="font-medium">{currentLabel}</div>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <Label className="text-sm">District</Label>
              <select
                className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background"
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                disabled={loadingDistricts || saving}
              >
                <option value="">{loadingDistricts ? "Loading..." : "-- Select District --"}</option>
                {districts.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm">Area</Label>
              <select
                className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background"
                value={area}
                onChange={(e) => handleAreaChange(e.target.value)}
                disabled={loadingAreas || !district || saving}
              >
                <option value="">
                  {loadingAreas ? "Loading..." : !district ? "Select district first" : areas.length === 0 ? "No areas" : "-- Select Area --"}
                </option>
                {areas.map((a) => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm">Unit</Label>
              <select
                className="w-full mt-1 border rounded px-2 py-1.5 text-sm bg-background"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={loadingUnits || !area || saving}
              >
                <option value="">
                  {loadingUnits ? "Loading..." : !area ? "Select area first" : units.length === 0 ? "No units" : "-- Select Unit --"}
                </option>
                {units.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm">Reason for transfer</Label>
              <Input
                className="mt-1 text-sm"
                placeholder="e.g. Beneficiary belongs to a different unit"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !area || !unit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRightLeft className="h-4 w-4 mr-1" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
