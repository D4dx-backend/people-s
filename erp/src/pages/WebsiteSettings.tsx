import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import VoiceTextarea from "@/components/ui/VoiceTextarea";
import { useToast } from "@/hooks/use-toast";
import { website } from "@/lib/api";
import { Loader2, Plus, Trash2, Save, Globe, Users, Phone, Mail, MapPin, Facebook, Instagram, Youtube, Twitter, Upload, X, ImageIcon } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";
import { useConfig } from "@/contexts/ConfigContext";

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
  const { org } = useConfig();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // About Us
  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutDescription, setAboutDescription] = useState("");
  const [aboutImageUrl, setAboutImageUrl] = useState("");
  const [aboutImageUploading, setAboutImageUploading] = useState(false);
  
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

  // Hero
  const [hero, setHero] = useState({ title: "", subtitle: "", ctaText: "", ctaLink: "", secondaryCtaText: "", secondaryCtaLink: "" });
  // Vision & Mission
  const [vision, setVision] = useState({ title: "", description: "" });
  const [mission, setMission] = useState({ title: "", description: "" });
  // Donation
  const [donation, setDonation] = useState({ enabled: false, heading: "", description: "", accountName: "", accountNumber: "", bankName: "", ifsc: "", upiId: "", paymentLink: "" });
  // SEO
  const [seo, setSeo] = useState({ title: "", description: "", keywords: "" });
  // Footer
  const [footer, setFooter] = useState({ description: "", copyrightText: "" });

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
        setAboutImageUrl(settings.aboutUs?.imageUrl || "");
        setCounters(Array.isArray(settings.counts) ? settings.counts : []);
        setPhone(settings.contactDetails?.phone || "");
        setEmail(settings.contactDetails?.email || "");
        setAddress(settings.contactDetails?.address || "");
        setWhatsapp(settings.contactDetails?.whatsapp || "");
        setFacebook(settings.socialMedia?.facebook || "");
        setInstagram(settings.socialMedia?.instagram || "");
        setYoutube(settings.socialMedia?.youtube || "");
        setTwitter(settings.socialMedia?.twitter || "");
        setHero({
          title: settings.hero?.title || "",
          subtitle: settings.hero?.subtitle || "",
          ctaText: settings.hero?.ctaText || "",
          ctaLink: settings.hero?.ctaLink || "",
          secondaryCtaText: settings.hero?.secondaryCtaText || "",
          secondaryCtaLink: settings.hero?.secondaryCtaLink || "",
        });
        setVision({ title: settings.vision?.title || "", description: settings.vision?.description || "" });
        setMission({ title: settings.mission?.title || "", description: settings.mission?.description || "" });
        setDonation({
          enabled: !!settings.donation?.enabled,
          heading: settings.donation?.heading || "",
          description: settings.donation?.description || "",
          accountName: settings.donation?.accountName || "",
          accountNumber: settings.donation?.accountNumber || "",
          bankName: settings.donation?.bankName || "",
          ifsc: settings.donation?.ifsc || "",
          upiId: settings.donation?.upiId || "",
          paymentLink: settings.donation?.paymentLink || "",
        });
        setSeo({
          title: settings.seo?.title || "",
          description: settings.seo?.description || "",
          keywords: Array.isArray(settings.seo?.keywords) ? settings.seo.keywords.join(", ") : (settings.seo?.keywords || ""),
        });
        setFooter({ description: settings.footer?.description || "", copyrightText: settings.footer?.copyrightText || "" });
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
          description: aboutDescription,
          imageUrl: aboutImageUrl
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
        },
        hero,
        vision,
        mission,
        donation,
        seo: {
          ...seo,
          keywords: seo.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        },
        footer
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

  const handleAboutImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Image must be under 5 MB", variant: "destructive" });
      return;
    }
    try {
      setAboutImageUploading(true);
      const fd = new FormData();
      fd.append('image', file);
      const res = await website.uploadAboutImage(fd);
      if ((res as any).success) {
        setAboutImageUrl((res as any).data.imageUrl);
        toast({ title: "Success", description: "About Us image uploaded" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Upload failed", variant: "destructive" });
    } finally {
      setAboutImageUploading(false);
      e.target.value = '';
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
              placeholder={`About ${org.erpTitle}`}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <VoiceTextarea
              value={aboutDescription}
              onChange={(e) => setAboutDescription(e.target.value)}
              placeholder="Enter about us description..."
              rows={6}
              disabled={!canEdit}
            />
          </div>

          {/* About Us Image */}
          <div className="space-y-2">
            <Label>Section Image</Label>
            {aboutImageUrl ? (
              <div className="relative w-full overflow-hidden rounded-xl border">
                <img src={aboutImageUrl} alt="About Us" className="h-48 w-full object-cover" />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setAboutImageUrl("")}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    title="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex h-40 w-full items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="mx-auto h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">No image set</p>
                </div>
              </div>
            )}
            {canEdit && (
              <label className="flex cursor-pointer items-center gap-2 w-fit">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aboutImageUploading}
                  asChild
                >
                  <span>
                    {aboutImageUploading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="mr-2 h-4 w-4" /> {aboutImageUrl ? "Change Image" : "Upload Image"}</>
                    )}
                  </span>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAboutImageUpload}
                  disabled={aboutImageUploading}
                />
              </label>
            )}
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
                  onChange={(e) => handleUpdateCounter(index, 'count', parseInt(e.target.value) || 0)}
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
                  onChange={(e) => setNewCounter({ ...newCounter, count: parseInt(e.target.value) || 0 })}
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
                placeholder={org.email}
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
            <VoiceTextarea
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

      {/* Hero Section */}
      <Card>
        <CardHeader>
          <CardTitle>Hero Section</CardTitle>
          <CardDescription>The main banner heading and call-to-action shown on the homepage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Title</Label>
              <Input value={hero.title} onChange={(e) => setHero({ ...hero, title: e.target.value })} disabled={!canEdit} placeholder="Empowering communities" /></div>
            <div className="space-y-2"><Label>Subtitle</Label>
              <Input value={hero.subtitle} onChange={(e) => setHero({ ...hero, subtitle: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-2"><Label>Primary Button Text</Label>
              <Input value={hero.ctaText} onChange={(e) => setHero({ ...hero, ctaText: e.target.value })} disabled={!canEdit} placeholder="Donate Now" /></div>
            <div className="space-y-2"><Label>Primary Button Link</Label>
              <Input value={hero.ctaLink} onChange={(e) => setHero({ ...hero, ctaLink: e.target.value })} disabled={!canEdit} placeholder="#donate" /></div>
            <div className="space-y-2"><Label>Secondary Button Text</Label>
              <Input value={hero.secondaryCtaText} onChange={(e) => setHero({ ...hero, secondaryCtaText: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-2"><Label>Secondary Button Link</Label>
              <Input value={hero.secondaryCtaLink} onChange={(e) => setHero({ ...hero, secondaryCtaLink: e.target.value })} disabled={!canEdit} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Vision & Mission */}
      <Card>
        <CardHeader>
          <CardTitle>Vision & Mission</CardTitle>
          <CardDescription>Your organization's vision and mission statements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Vision Title</Label>
              <Input value={vision.title} onChange={(e) => setVision({ ...vision, title: e.target.value })} disabled={!canEdit} placeholder="Our Vision" /></div>
            <div className="space-y-2"><Label>Mission Title</Label>
              <Input value={mission.title} onChange={(e) => setMission({ ...mission, title: e.target.value })} disabled={!canEdit} placeholder="Our Mission" /></div>
            <div className="space-y-2"><Label>Vision Description</Label>
              <VoiceTextarea rows={4} value={vision.description} onChange={(e) => setVision({ ...vision, description: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-2"><Label>Mission Description</Label>
              <VoiceTextarea rows={4} value={mission.description} onChange={(e) => setMission({ ...mission, description: e.target.value })} disabled={!canEdit} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Donation */}
      <Card>
        <CardHeader>
          <CardTitle>Donation Section</CardTitle>
          <CardDescription>Bank and payment details shown in the donation section</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={donation.enabled} onChange={(e) => setDonation({ ...donation, enabled: e.target.checked })} disabled={!canEdit} />
            Show donation section on website
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Heading</Label>
              <Input value={donation.heading} onChange={(e) => setDonation({ ...donation, heading: e.target.value })} disabled={!canEdit} placeholder="Support Our Cause" /></div>
            <div className="space-y-2"><Label>Payment Link</Label>
              <Input value={donation.paymentLink} onChange={(e) => setDonation({ ...donation, paymentLink: e.target.value })} disabled={!canEdit} placeholder="https://..." /></div>
          </div>
          <div className="space-y-2"><Label>Description</Label>
            <VoiceTextarea rows={2} value={donation.description} onChange={(e) => setDonation({ ...donation, description: e.target.value })} disabled={!canEdit} /></div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Account Name</Label>
              <Input value={donation.accountName} onChange={(e) => setDonation({ ...donation, accountName: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-2"><Label>Account Number</Label>
              <Input value={donation.accountNumber} onChange={(e) => setDonation({ ...donation, accountNumber: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-2"><Label>Bank Name</Label>
              <Input value={donation.bankName} onChange={(e) => setDonation({ ...donation, bankName: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-2"><Label>IFSC Code</Label>
              <Input value={donation.ifsc} onChange={(e) => setDonation({ ...donation, ifsc: e.target.value })} disabled={!canEdit} /></div>
            <div className="space-y-2"><Label>UPI ID</Label>
              <Input value={donation.upiId} onChange={(e) => setDonation({ ...donation, upiId: e.target.value })} disabled={!canEdit} /></div>
          </div>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle>SEO</CardTitle>
          <CardDescription>Search engine metadata for your website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Meta Title</Label>
            <Input value={seo.title} onChange={(e) => setSeo({ ...seo, title: e.target.value })} disabled={!canEdit} /></div>
          <div className="space-y-2"><Label>Meta Description</Label>
            <VoiceTextarea rows={2} value={seo.description} onChange={(e) => setSeo({ ...seo, description: e.target.value })} disabled={!canEdit} /></div>
          <div className="space-y-2"><Label>Keywords (comma-separated)</Label>
            <Input value={seo.keywords} onChange={(e) => setSeo({ ...seo, keywords: e.target.value })} disabled={!canEdit} /></div>
        </CardContent>
      </Card>

      {/* Footer */}
      <Card>
        <CardHeader>
          <CardTitle>Footer</CardTitle>
          <CardDescription>Footer description and copyright text</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Footer Description</Label>
            <VoiceTextarea rows={2} value={footer.description} onChange={(e) => setFooter({ ...footer, description: e.target.value })} disabled={!canEdit} /></div>
          <div className="space-y-2"><Label>Copyright Text</Label>
            <Input value={footer.copyrightText} onChange={(e) => setFooter({ ...footer, copyrightText: e.target.value })} disabled={!canEdit} /></div>
        </CardContent>
      </Card>
    </div>
  );
}
