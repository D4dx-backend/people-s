import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { website } from "@/lib/api";
import { Loader2, Plus, Edit, Trash2, FileText, Download, Calendar } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";

interface Brochure {
  _id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  downloads: number;
  status: string;
  createdAt: string;
  createdBy: { name: string };
}

export default function Brochures() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  
  const canCreate = hasAnyPermission(['website.write', 'brochures.write']);
  const canEdit = hasAnyPermission(['website.write', 'brochures.write']);
  const canDelete = hasAnyPermission(['website.delete', 'brochures.delete']);

  const [loading, setLoading] = useState(true);
  const [brochures, setBrochures] = useState<Brochure[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Brochure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState("active");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    loadBrochures();
  }, [page, statusFilter, categoryFilter]);

  const loadBrochures = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 10 };
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;

      const response = await website.getAllBrochures(params);
      
      if (response.success) {
        setBrochures((response.data as any).brochures);
        setTotalPages((response.data as any).pagination.pages);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load brochures",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        toast({
          title: "Error",
          description: "Please select a PDF file",
          variant: "destructive"
        });
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "PDF size should be less than 10MB",
          variant: "destructive"
        });
        return;
      }

      setPdfFile(file);
      setFileName(file.name);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    setTitle("");
    setDescription("");
    setCategory("general");
    setStatus("active");
    setPdfFile(null);
    setFileName("");
    setShowModal(true);
  };

  const handleEdit = (item: Brochure) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description);
    setCategory(item.category);
    setStatus(item.status);
    setPdfFile(null);
    setFileName(item.fileName);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (!title || !description) {
        toast({
          title: "Error",
          description: "Please fill all required fields",
          variant: "destructive"
        });
        return;
      }

      if (!editingItem && !pdfFile) {
        toast({
          title: "Error",
          description: "Please select a PDF file",
          variant: "destructive"
        });
        return;
      }

      setSubmitting(true);

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('status', status);
      
      if (pdfFile) {
        formData.append('file', pdfFile);
      }

      if (editingItem) {
        await website.updateBrochure(editingItem._id, formData);
        toast({
          title: "Success",
          description: "Brochure updated successfully"
        });
      } else {
        await website.createBrochure(formData);
        toast({
          title: "Success",
          description: "Brochure uploaded successfully"
        });
      }

      setShowModal(false);
      loadBrochures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save brochure",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this brochure?")) return;

    try {
      await website.deleteBrochure(id);
      toast({
        title: "Success",
        description: "Brochure deleted successfully"
      });
      loadBrochures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete brochure",
        variant: "destructive"
      });
    }
  };

  const handleDownload = async (item: Brochure) => {
    try {
      // Track download
      await website.trackDownload(item._id);
      
      // Open in new tab
      window.open(item.fileUrl, '_blank');
      
      // Update local count
      setBrochures(prev =>
        prev.map(b =>
          b._id === item._id ? { ...b, downloads: b.downloads + 1 } : b
        )
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download brochure",
        variant: "destructive"
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: "bg-blue-100 text-blue-800",
      schemes: "bg-green-100 text-green-800",
      reports: "bg-yellow-100 text-yellow-800",
      guidelines: "bg-purple-100 text-purple-800"
    };
    return colors[category] || "bg-gray-100 text-gray-800";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      archived: "bg-red-100 text-red-800"
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Brochures</h1>
          <p className="text-muted-foreground">Manage downloadable documents and brochures</p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Upload Brochure
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="schemes">Schemes</SelectItem>
                  <SelectItem value="reports">Reports</SelectItem>
                  <SelectItem value="guidelines">Guidelines</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brochures List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : brochures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No brochures found</h3>
            <p className="text-muted-foreground">Upload your first brochure to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {brochures.map((item) => (
            <Card key={item._id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <Badge className={getCategoryColor(item.category)}>
                        {item.category}
                      </Badge>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </div>
                    <CardTitle className="mb-2">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                  <FileText className="h-12 w-12 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">File:</span> {item.fileName}
                    </div>
                    <div>
                      <span className="font-medium">Size:</span> {formatFileSize(item.fileSize)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      {item.downloads} downloads
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(item)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(item)}
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Brochure" : "Upload Brochure"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter brochure title..."
              />
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description..."
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="schemes">Schemes</SelectItem>
                    <SelectItem value="reports">Reports</SelectItem>
                    <SelectItem value="guidelines">Guidelines</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>PDF File {!editingItem && "*"}</Label>
              <Input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
              />
              {fileName && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-gray-50 rounded">
                  <FileText className="h-5 w-5 text-red-500" />
                  <span className="text-sm">{fileName}</span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                PDF only, max 10MB
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
                  Uploading...
                </>
              ) : (
                editingItem ? "Update" : "Upload"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
