import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { website } from "@/lib/api";
import { Loader2, Plus, Trash2, Save, Globe, Users, Phone, Mail, MapPin, Facebook, Instagram, Youtube, Twitter } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";

interface Counter {
  _id?: string;
  title: string;
  count: number;
  icon: string;
  order: number;
}

export default function WebsiteSettings() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  
  const canEdit = hasAnyPermission(['website.write', 'settings.write']);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // About Us
  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutDescription, setAboutDescription] = useState("");
  
  // Counters
  const [counters, setCounters] = useState<Counter[]>([]);
  const [newCounter, setNewCounter] = useState({ title: "", count: 0, icon: "users" });
  
  // Contact Details
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  
  // Social Media
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [twitter, setTwitter] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await website.getSettings();
      
      if (response.success && (response.data as any).settings) {
        const settings = (response.data as any).settings;
        
        setAboutTitle(settings.aboutUs?.title || "");
        setAboutDescription(settings.aboutUs?.description || "");
        setCounters(Array.isArray(settings.counts) ? settings.counts : []);
        setPhone(settings.contactDetails?.phone || "");
        setEmail(settings.contactDetails?.email || "");
        setAddress(settings.contactDetails?.address || "");
        setWhatsapp(settings.contactDetails?.whatsapp || "");
        setFacebook(settings.socialMedia?.facebook || "");
        setInstagram(settings.socialMedia?.instagram || "");
        setYoutube(settings.socialMedia?.youtube || "");
        setTwitter(settings.socialMedia?.twitter || "");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load settings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const data = {
        aboutUs: {
          title: aboutTitle,
          description: aboutDescription
        },
        counts: counters,
        contactDetails: {
          phone,
          email,
          address,
          whatsapp
        },
        socialMedia: {
          facebook,
          instagram,
          youtube,
          twitter
        }
      };

      await website.updateSettings(data);
      
      toast({
        title: "Success",
        description: "Settings updated successfully"
      });
      
      // Reload to get updated settings
      loadSettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCounter = () => {
    if (!newCounter.title || newCounter.count < 0) {
      toast({
        title: "Error",
        description: "Please fill all counter fields",
        variant: "destructive"
      });
      return;
    }

    const maxOrder = counters.length > 0 ? Math.max(...counters.map(c => c.order)) : 0;
    
    setCounters([...counters, {
      ...newCounter,
      order: maxOrder + 1
    }]);
    
    setNewCounter({ title: "", count: 0, icon: "users" });
  };

  const handleRemoveCounter = (index: number) => {
    setCounters(counters.filter((_, i) => i !== index));
  };

  const handleUpdateCounter = (index: number, field: keyof Counter, value: any) => {
    const updated = [...counters];
    updated[index] = { ...updated[index], [field]: value };
    setCounters(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Website Settings</h1>
          <p className="text-muted-foreground">Manage website content and information</p>
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      {/* About Us Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            About Us
          </CardTitle>
          <CardDescription>Main content for the About Us section</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={aboutTitle}
              onChange={(e) => setAboutTitle(e.target.value)}
              placeholder="About People's Foundation ERP"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={aboutDescription}
              onChange={(e) => setAboutDescription(e.target.value)}
              placeholder="Enter about us description..."
              rows={6}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Counters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Statistics Counters
          </CardTitle>
          <CardDescription>Dynamic counters displayed on the website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Counters */}
          {counters.map((counter, index) => (
            <div key={index} className="flex gap-2 items-end p-4 border rounded-lg">
              <div className="flex-1 space-y-2">
                <Label>Title</Label>
                <Input
                  value={counter.title}
                  onChange={(e) => handleUpdateCounter(index, 'title', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="w-32 space-y-2">
                <Label>Count</Label>
                <Input
                  type="number"
                  value={counter.count}
                  onChange={(e) => handleUpdateCounter(index, 'count', parseInt(e.target.value))}
                  disabled={!canEdit}
                />
              </div>
              {canEdit && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleRemoveCounter(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {/* Add New Counter */}
          {canEdit && (
            <div className="flex gap-2 items-end p-4 border-2 border-dashed rounded-lg">
              <div className="flex-1 space-y-2">
                <Label>New Counter Title</Label>
                <Input
                  value={newCounter.title}
                  onChange={(e) => setNewCounter({ ...newCounter, title: e.target.value })}
                  placeholder="e.g., Total Beneficiaries"
                />
              </div>
              <div className="w-32 space-y-2">
                <Label>Count</Label>
                <Input
                  type="number"
                  value={newCounter.count}
                  onChange={(e) => setNewCounter({ ...newCounter, count: parseInt(e.target.value) })}
                />
              </div>
              <Button onClick={handleAddCounter}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Details
          </CardTitle>
          <CardDescription>Organization contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Phone
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 471 1234567"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@baithuzzakath.org"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+91 XXXXXXXXXX"
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Address
            </Label>
            <Textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter organization address..."
              rows={3}
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Media Links */}
      <Card>
        <CardHeader>
          <CardTitle>Social Media</CardTitle>
          <CardDescription>Social media profile links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Facebook className="h-4 w-4" />
                Facebook
              </Label>
              <Input
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="https://facebook.com/..."
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="h-4 w-4" />
                Instagram
              </Label>
              <Input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/..."
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Youtube className="h-4 w-4" />
                YouTube
              </Label>
              <Input
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="https://youtube.com/..."
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Twitter className="h-4 w-4" />
                Twitter
              </Label>
              <Input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="https://twitter.com/..."
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
