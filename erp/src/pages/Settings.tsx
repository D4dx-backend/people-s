import { useState, useRef } from "react";
import { Save, Building2, Settings as SettingsIcon, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRBAC } from "@/hooks/useRBAC";
import { ApplicationConfigTab } from "@/components/ApplicationConfigTab";
import { useConfig } from "@/contexts/ConfigContext";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import { config as configApi } from "@/lib/api";
import { toast } from "sonner";
import defaultLogo from "@/assets/logo.svg";

export default function Settings() {
  const { hasPermission } = useRBAC();
  const { org, refreshConfig } = useConfig();
  const orgLogoUrl = useOrgLogoUrl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  
  // Permission checks
  const canViewSettings = hasPermission('settings.read');
  const canUpdateSettings = hasPermission('settings.update');

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PNG, JPG, SVG, and WebP images are allowed');
      return;
    }

    // Validate size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file must be under 2MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Please select a logo file first');
      return;
    }

    setUploading(true);
    try {
      const response = await configApi.uploadLogo(file);
      if (response.success) {
        toast.success('Logo uploaded successfully');
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Refresh config to pick up new logo
        await refreshConfig();
      } else {
        toast.error(response.message || 'Failed to upload logo');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };
  
  if (!canViewSettings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <SettingsIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view settings.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage organization settings and preferences</p>
      </div>

      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <ApplicationConfigTab />
        </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          {/* Logo Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Organization Logo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <img
                    src={logoPreview || orgLogoUrl}
                    alt={org.erpTitle}
                    className="h-24 w-24 rounded-xl border-2 border-dashed border-muted-foreground/25 object-contain p-2"
                    onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }}
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Upload your organization logo. Recommended size: 256x256px. Max file size: 2MB.
                    Supported formats: PNG, JPG, SVG, WebP.
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      onChange={handleLogoSelect}
                      className="max-w-xs"
                    />
                    {logoPreview && (
                      <Button
                        onClick={handleLogoUpload}
                        disabled={uploading}
                        size="sm"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? 'Uploading...' : 'Upload'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organization Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input defaultValue={org.displayName} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>ERP Title</Label>
                  <Input defaultValue={org.erpTitle} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input defaultValue={org.regNumber} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input defaultValue={org.tagline} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea defaultValue={org.address} rows={2} readOnly className="bg-muted" />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" defaultValue={org.email} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input type="email" defaultValue={org.supportEmail} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Payments Email</Label>
                  <Input type="email" defaultValue={org.paymentsEmail} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" defaultValue={org.phone} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input type="url" defaultValue={org.websiteUrl} readOnly className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Default Theme</Label>
                  <Input defaultValue={org.defaultTheme} readOnly className="bg-muted" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These values are configured via the <code>ORG_NAME</code> environment variable and org presets.
                To change them, update the <code>.env</code> file or <code>orgConfig.js</code> presets.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
