import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { website } from "@/lib/api";
import { Loader2, Plus, Edit, Trash2, Image as ImageIcon, ExternalLink } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/common/ExportButton";
import { partnerExportColumns } from "@/utils/exportColumns";

interface Partner {
  _id: string;
  name: string;
  logoUrl: string;
  link: string;
  order: number;
  status: string;
  createdAt: string;
}

export default function Partners() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  
  const canCreate = hasAnyPermission(['website.write', 'partners.write']);
  const canEdit = hasAnyPermission(['website.write', 'partners.write']);
  const canDelete = hasAnyPermission(['website.delete', 'partners.delete']);

  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => website.exportPartners(params),
    filenamePrefix: 'partners',
    pdfTitle: 'Partners Report',
    pdfColumns: partnerExportColumns,
  });

  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<Partner[]>([]);
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [order, setOrder] = useState(0);
  const [status, setStatus] = useState("active");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      setLoading(true);
      const response = await website.getAllPartners();
      
      if (response.success) {
        setPartners((response.data as any).partners);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load partners",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select an image file",
          variant: "destructive"
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image size should be less than 5MB",
          variant: "destructive"
        });
        return;
      }

      setLogoFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    setName("");
    setLink("");
    setOrder(0);
    setStatus("active");
    setLogoFile(null);
    setLogoPreview("");
    setShowModal(true);
  };

  const handleEdit = (item: Partner) => {
    setEditingItem(item);
    setName(item.name);
    setLink(item.link || "");
    setOrder(item.order);
    setStatus(item.status);
    setLogoFile(null);
    setLogoPreview(item.logoUrl);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (!name) {
        toast({
          title: "Error",
          description: "Please enter partner name",
          variant: "destructive"
        });
        return;
      }

      if (!editingItem && !logoFile) {
        toast({
          title: "Error",
          description: "Please select a logo image",
          variant: "destructive"
        });
        return;
      }

      setSubmitting(true);

      const formData = new FormData();
      formData.append('name', name);
      formData.append('link', link);
      formData.append('order', order.toString());
      formData.append('status', status);
      
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      if (editingItem) {
        await website.updatePartner(editingItem._id, formData);
        toast({
          title: "Success",
          description: "Partner updated successfully"
        });
      } else {
        await website.createPartner(formData);
        toast({
          title: "Success",
          description: "Partner created successfully"
        });
      }

      setShowModal(false);
      loadPartners();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save partner",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this partner?")) return;

    try {
      await website.deletePartner(id);
      toast({
        title: "Success",
        description: "Partner deleted successfully"
      });
      loadPartners();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete partner",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Partners</h1>
          <p className="text-muted-foreground">Manage partner organizations and their logos</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            onExportCSV={() => exportCSV()}
            onExportPDF={() => exportPDF()}
            onPrint={() => printData()}
            exporting={exporting}
          />
          {canCreate && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Partner
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : partners.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No partners found</h3>
            <p className="text-muted-foreground">Add your first partner organization</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {partners.map((item) => (
            <Card key={item._id}>
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                    {item.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Order: {item.order}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="aspect-video relative mb-4 bg-gray-50 rounded-lg flex items-center justify-center">
                  <img
                    src={item.logoUrl}
                    alt={item.name}
                    className="max-w-full max-h-full object-contain p-4"
                  />
                </div>
                <CardTitle className="text-lg mb-2">{item.name}</CardTitle>
                {item.link && (
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Visit website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <div className="flex gap-2 mt-4">
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(item)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(item._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Partner" : "Add Partner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Partner Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter partner name..."
              />
            </div>

            <div className="space-y-2">
              <Label>Website Link</Label>
              <Input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://partner-website.com"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logo {!editingItem && "*"}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
              />
              {logoPreview && (
                <div className="mt-2 p-4 border rounded-lg bg-gray-50">
                  <img
                    src={logoPreview}
                    alt="Preview"
                    className="max-w-full h-32 object-contain mx-auto"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Recommended: Square logo, max 5MB
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editingItem ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
