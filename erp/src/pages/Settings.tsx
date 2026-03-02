import { useState, useRef, useCallback } from "react";
import { Save, Building2, Settings as SettingsIcon, Upload, Image as ImageIcon, MessageSquare, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useRBAC } from "@/hooks/useRBAC";
import { ApplicationConfigTab } from "@/components/ApplicationConfigTab";
import { useConfig } from "@/contexts/ConfigContext";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import { config as configApi } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import defaultLogo from "@/assets/logo.svg";

export default function Settings() {
  const { hasPermission } = useRBAC();
  const { org, refreshConfig } = useConfig();
  const { user } = useAuth();
  const orgLogoUrl = useOrgLogoUrl();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // ── Integrations state ──────────────────────────────────────────────────
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [integrationsSaving, setIntegrationsSaving] = useState(false);
  const [showDxingSecret, setShowDxingSecret] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smsForm, setSmsForm] = useState({
    dxingApiKey: '',
    dxingApiSecret: '',
    enabled: false,
    isConfigured: false,
  });
  const [emailForm, setEmailForm] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    enabled: false,
    isConfigured: false,
  });

  // Permission checks
  const canViewSettings = hasPermission('settings.read');
  const canUpdateSettings = hasPermission('settings.update');
  const isSuperAdmin = user?.role === 'super_admin' || (user as any)?.isSuperAdmin;

  const loadIntegrations = useCallback(async () => {
    if (!isSuperAdmin) return;
    setIntegrationsLoading(true);
    try {
      const res = await configApi.getIntegrations();
      if (res.success && res.data) {
        const { smsConfig, emailConfig } = res.data;
        setSmsForm({
          dxingApiKey:    smsConfig.isConfigured ? '•••••••••••••••••••' : '',
          dxingApiSecret: smsConfig.isConfigured ? '•••••••••••••••••••' : '',
          enabled:        smsConfig.enabled,
          isConfigured:   smsConfig.isConfigured,
        });
        setEmailForm({
          smtpHost:     emailConfig.smtpHost || '',
          smtpPort:     String(emailConfig.smtpPort || '587'),
          smtpUser:     emailConfig.smtpUser || '',
          smtpPass:     emailConfig.isConfigured ? '•••••••••••••••••••' : '',
          enabled:      emailConfig.enabled,
          isConfigured: emailConfig.isConfigured,
        });
      }
    } catch {
      // silently ignore — user may not have permission
    } finally {
      setIntegrationsLoading(false);
    }
  }, [isSuperAdmin]);

  const PLACEHOLDER = '•••••••••••••••••••';
  const isPlaceholder = (v: string) => v === PLACEHOLDER;

  const handleSaveIntegrations = async () => {
    setIntegrationsSaving(true);
    try {
      const payload: any = {};

      // Only send fields that have been changed (not still the masked placeholder)
      const smsPayload: any = { enabled: smsForm.enabled };
      if (!isPlaceholder(smsForm.dxingApiKey))    smsPayload.dxingApiKey    = smsForm.dxingApiKey;
      if (!isPlaceholder(smsForm.dxingApiSecret)) smsPayload.dxingApiSecret = smsForm.dxingApiSecret;
      payload.smsConfig = smsPayload;

      const emailPayload: any = {
        smtpHost: emailForm.smtpHost,
        smtpPort: Number(emailForm.smtpPort) || 587,
        smtpUser: emailForm.smtpUser,
        enabled:  emailForm.enabled,
      };
      if (!isPlaceholder(emailForm.smtpPass)) emailPayload.smtpPass = emailForm.smtpPass;
      payload.emailConfig = emailPayload;

      const res = await configApi.updateIntegrations(payload);
      if (res.success) {
        toast.success('Integration settings saved successfully');
        await loadIntegrations(); // Refresh masked state
      } else {
        toast.error(res.message || 'Failed to save settings');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save integration settings');
    } finally {
      setIntegrationsSaving(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) { toast.error('Only PNG, JPG, SVG, and WebP images are allowed'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo file must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { toast.error('Please select a logo file first'); return; }
    setUploading(true);
    try {
      const response = await configApi.uploadLogo(file);
      if (response.success) {
        toast.success('Logo uploaded successfully');
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
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
          <p className="text-muted-foreground">You don't have permission to view settings.</p>
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

      <Tabs defaultValue="configuration" className="space-y-4" onValueChange={(v) => { if (v === 'integrations') loadIntegrations(); }}>
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
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
                    <Input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" onChange={handleLogoSelect} className="max-w-xs" />
                    {logoPreview && (
                      <Button onClick={handleLogoUpload} disabled={uploading} size="sm">
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

        {/* ── Integrations Tab (super_admin only) ──────────────────────── */}
        {isSuperAdmin && (
          <TabsContent value="integrations" className="space-y-4">
            {integrationsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">Loading integration settings…</div>
            ) : (
              <>
                {/* DXing SMS / WhatsApp */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      DXing SMS &amp; WhatsApp OTP
                      {smsForm.isConfigured
                        ? <Badge variant="default" className="ml-2 text-xs">Configured</Badge>
                        : <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">Not configured</Badge>}
                    </CardTitle>
                    <CardDescription>
                      Per-franchise DXing API credentials for sending OTP via SMS/WhatsApp.
                      Overrides the global <code>.env</code> keys when set.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="sms-enabled"
                        checked={smsForm.enabled}
                        onCheckedChange={(v) => setSmsForm(f => ({ ...f, enabled: v }))}
                        disabled={!canUpdateSettings}
                      />
                      <Label htmlFor="sms-enabled">Enable DXing SMS / WhatsApp for this organization</Label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          placeholder="Enter DXing API Key"
                          value={smsForm.dxingApiKey}
                          onChange={(e) => setSmsForm(f => ({ ...f, dxingApiKey: e.target.value }))}
                          disabled={!canUpdateSettings}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Secret</Label>
                        <div className="relative">
                          <Input
                            type={showDxingSecret ? 'text' : 'password'}
                            placeholder="Enter DXing API Secret"
                            value={smsForm.dxingApiSecret}
                            onChange={(e) => setSmsForm(f => ({ ...f, dxingApiSecret: e.target.value }))}
                            disabled={!canUpdateSettings}
                            className="pr-10"
                          />
                          <button type="button" onClick={() => setShowDxingSecret(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showDxingSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from <a href="https://app.dxing.in" target="_blank" rel="noreferrer" className="underline">app.dxing.in</a>.
                      Leave blank to fall back to the global <code>DXING_API_KEY</code> in <code>.env</code>.
                    </p>
                  </CardContent>
                </Card>

                {/* SMTP Email */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      SMTP Email
                      {emailForm.isConfigured
                        ? <Badge variant="default" className="ml-2 text-xs">Configured</Badge>
                        : <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">Not configured</Badge>}
                    </CardTitle>
                    <CardDescription>
                      Per-franchise SMTP credentials for sending email notifications and receipts.
                      Overrides the global <code>.env</code> SMTP settings when set.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="smtp-enabled"
                        checked={emailForm.enabled}
                        onCheckedChange={(v) => setEmailForm(f => ({ ...f, enabled: v }))}
                        disabled={!canUpdateSettings}
                      />
                      <Label htmlFor="smtp-enabled">Enable SMTP email for this organization</Label>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>SMTP Host</Label>
                        <Input
                          placeholder="smtp.gmail.com"
                          value={emailForm.smtpHost}
                          onChange={(e) => setEmailForm(f => ({ ...f, smtpHost: e.target.value }))}
                          disabled={!canUpdateSettings}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP Port</Label>
                        <Input
                          type="number"
                          placeholder="587"
                          value={emailForm.smtpPort}
                          onChange={(e) => setEmailForm(f => ({ ...f, smtpPort: e.target.value }))}
                          disabled={!canUpdateSettings}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>SMTP Username / Email</Label>
                        <Input
                          type="email"
                          placeholder="your-email@gmail.com"
                          value={emailForm.smtpUser}
                          onChange={(e) => setEmailForm(f => ({ ...f, smtpUser: e.target.value }))}
                          disabled={!canUpdateSettings}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP Password / App Password</Label>
                        <div className="relative">
                          <Input
                            type={showSmtpPass ? 'text' : 'password'}
                            placeholder="App password or SMTP password"
                            value={emailForm.smtpPass}
                            onChange={(e) => setEmailForm(f => ({ ...f, smtpPass: e.target.value }))}
                            disabled={!canUpdateSettings}
                            className="pr-10"
                          />
                          <button type="button" onClick={() => setShowSmtpPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      For Gmail: use an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">App Password</a> (not your login password).
                      Leave blank to fall back to the global SMTP settings in <code>.env</code>.
                    </p>
                  </CardContent>
                </Card>

                {canUpdateSettings && (
                  <div className="flex justify-end">
                    <Button onClick={handleSaveIntegrations} disabled={integrationsSaving}>
                      <Save className="h-4 w-4 mr-2" />
                      {integrationsSaving ? 'Saving…' : 'Save Integration Settings'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
