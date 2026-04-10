import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { beneficiaryApi } from "@/services/beneficiaryApi";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import defaultLogo from "@/assets/logo.png";
import DeleteAccountModal from "@/components/modals/DeleteAccountModal";

interface Location {
  _id: string;
  name: string;
  code: string;
  type: string;
  parent?: string;
}

export default function BeneficiaryProfileCompletion() {
  const navigate = useNavigate();
  const orgLogoUrl = useOrgLogoUrl();
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    gender: "",
    districtId: "",
    areaId: "",
    unitId: ""
  });

  const [districts, setDistricts] = useState<Location[]>([]);
  const [areas, setAreas] = useState<Location[]>([]);
  const [units, setUnits] = useState<Location[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [pendingUnitId, setPendingUnitId] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('beneficiary_token');
    const phone = localStorage.getItem('user_phone');
    
    if (!token) {
      navigate('/beneficiary-login', { replace: true });
    }
    
    if (phone) {
      setPhoneNumber(phone);
    }

    // Load existing profile data
    loadProfile();
    
    // Load districts
    loadDistricts();
  }, [navigate]);

  // Effect to set unitId after units are loaded
  useEffect(() => {
    if (pendingUnitId && units.length > 0) {
      const unitExists = units.some(u => u._id === pendingUnitId);
      if (unitExists) {
        setFormData(prev => ({ ...prev, unitId: pendingUnitId }));
      }
      setPendingUnitId(null);
    }
  }, [units, pendingUnitId]);

  const loadProfile = async () => {
    try {
      const response = await beneficiaryApi.getProfile();
      const user = response.user;

      if (user) {
        const districtId = user.profile?.location?.district?._id || user.profile?.location?.district || "";
        const areaId = user.profile?.location?.area?._id || user.profile?.location?.area || "";
        const unitId = user.profile?.location?.unit?._id || user.profile?.location?.unit || "";

        // Load dependent dropdown options
        if (districtId) {
          await loadAreas(districtId);
          if (areaId) {
            await loadUnits(areaId);
            // Set pendingUnitId so it gets applied after units are loaded via useEffect
            if (unitId) {
              setPendingUnitId(unitId);
            }
          }
        }

        setFormData({
          name: user.name || "",
          gender: user.profile?.gender || "",
          districtId,
          areaId,
          unitId: "", // Will be set by useEffect when units are loaded
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadDistricts = async () => {
    setLoadingDistricts(true);
    try {
      const response = await beneficiaryApi.getLocations({ type: 'district' });
      setDistricts(response.locations);
    } catch (error) {
      console.error('Failed to load districts:', error);
      toast({
        title: "Error",
        description: "Failed to load districts",
        variant: "destructive",
      });
    } finally {
      setLoadingDistricts(false);
    }
  };

  const loadAreas = async (districtId: string) => {
    setLoadingAreas(true);
    try {
      const response = await beneficiaryApi.getLocations({ type: 'area', parent: districtId });
      setAreas(response.locations);
    } catch (error) {
      console.error('Failed to load areas:', error);
      toast({
        title: "Error",
        description: "Failed to load areas",
        variant: "destructive",
      });
    } finally {
      setLoadingAreas(false);
    }
  };

  const loadUnits = async (areaId: string): Promise<Location[]> => {
    setLoadingUnits(true);
    try {
      const response = await beneficiaryApi.getLocations({ type: 'unit', parent: areaId });
      setUnits(response.locations);
      return response.locations;
    } catch (error) {
      console.error('Failed to load units:', error);
      toast({
        title: "Error",
        description: "Failed to load units",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoadingUnits(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Load dependent dropdowns
    if (field === 'districtId') {
      setFormData(prev => ({ ...prev, areaId: '', unitId: '' }));
      setAreas([]);
      setUnits([]);
      if (value) {
        loadAreas(value);
      }
    } else if (field === 'areaId') {
      setFormData(prev => ({ ...prev, unitId: '' }));
      setUnits([]);
      if (value) {
        loadUnits(value);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your full name",
        variant: "destructive",
      });
      return;
    }

    if (!formData.gender) {
      toast({
        title: "Gender Required",
        description: "Please select your gender",
        variant: "destructive",
      });
      return;
    }

    if (!formData.districtId) {
      toast({
        title: "District Required",
        description: "Please select your district",
        variant: "destructive",
      });
      return;
    }

    if (!formData.areaId) {
      toast({
        title: "Area Required",
        description: "Please select your area",
        variant: "destructive",
      });
      return;
    }

    if (!formData.unitId) {
      toast({
        title: "Unit Required",
        description: "Please select your unit",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const profileData = {
        name: formData.name.trim(),
        profile: {
          gender: formData.gender,
          location: {
            district: formData.districtId,
            area: formData.areaId,
            unit: formData.unitId
          }
        }
      };

      const response = await beneficiaryApi.updateProfile(profileData);
      
      // Update stored user data
      localStorage.setItem('beneficiary_user', JSON.stringify(response.user));
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully!",
      });

      // Navigate back to dashboard
      setTimeout(() => {
        navigate("/beneficiary/dashboard", { replace: true });
      }, 1000);

    } catch (error) {
      console.error('Profile completion error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-elegant">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={orgLogoUrl} alt="Logo" className="h-16 w-16 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} />
          </div>
          <CardTitle className="text-xl font-bold">Your Profile</CardTitle>
          <CardDescription>
            Update your personal and location information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <User className="h-4 w-4" />
                Personal Information
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">This is your registered mobile number</p>
              </div>

              <div className="space-y-2">
                <Label>Gender *</Label>
                <RadioGroup
                  value={formData.gender}
                  onValueChange={(value) => handleInputChange('gender', value)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male" className="cursor-pointer font-normal">Male</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female" className="cursor-pointer font-normal">Female</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="cursor-pointer font-normal">Other</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Location Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <MapPin className="h-4 w-4" />
                Location Details
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">District *</Label>
                <Select
                  value={formData.districtId}
                  onValueChange={(value) => handleInputChange('districtId', value)}
                  disabled={loadingDistricts}
                >
                  <SelectTrigger id="district">
                    <SelectValue placeholder="Select your district" />
                  </SelectTrigger>
                  <SelectContent>
                    {districts.map((district) => (
                      <SelectItem key={district._id} value={district._id}>
                        {district.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="area">Area *</Label>
                <Select
                  value={formData.areaId}
                  onValueChange={(value) => handleInputChange('areaId', value)}
                  disabled={!formData.districtId || loadingAreas}
                >
                  <SelectTrigger id="area">
                    <SelectValue placeholder={formData.districtId ? "Select your area" : "Select district first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.length > 0 ? (
                      areas.map((area) => (
                        <SelectItem key={area._id} value={area._id}>
                          {area.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-areas" disabled>No areas available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select
                  value={formData.unitId}
                  onValueChange={(value) => handleInputChange('unitId', value)}
                  disabled={!formData.areaId || loadingUnits}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder={formData.areaId ? "Select your unit" : "Select area first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {units.length > 0 ? (
                      units.map((unit) => (
                        <SelectItem key={unit._id} value={unit._id}>
                          {unit.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-units" disabled>No units available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/beneficiary/dashboard")}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-gradient-primary shadow-glow"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
            </div>
          </form>

          {/* Danger Zone */}
          <div className="mt-8 border-t border-destructive/20 pt-6">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
              <p className="text-xs text-muted-foreground">
                Permanently remove your account access. Your registration data will be
                retained by the organisation for compliance purposes, but you will no longer
                be able to log in. If you re-register with the same number, a fresh profile
                will open with no previous data.
              </p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Account
              </Button>
            </div>
          </div>

          <DeleteAccountModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
