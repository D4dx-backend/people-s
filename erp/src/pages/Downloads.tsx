import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Download as DownloadIcon,
  Upload,
  Trash2,
  FileText,
  Plus,
  Loader2,
  RefreshCw,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { uploadSingleFile } from '@/utils/fileUploadHelper';
import {
  getDownloads,
  createDownload,
  deleteDownload,
  formatFileSize,
  type DownloadItem,
} from '@/services/downloadService';

const TARGET_ROLES: { value: string; label: string }[] = [
  { value: 'district_admin', label: 'District Admins' },
  { value: 'area_admin', label: 'Area Admins' },
  { value: 'area_president', label: 'Area Coordinators' },
  { value: 'unit_admin', label: 'Unit Admins' },
  { value: 'project_coordinator', label: 'Project Coordinators' },
  { value: 'scheme_coordinator', label: 'Scheme Coordinators' },
  { value: 'beneficiary', label: 'Beneficiaries' },
];

const roleLabel = (value: string) => TARGET_ROLES.find((r) => r.value === value)?.label || value;

export default function Downloads() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setItems(await getDownloads());
    } catch (err) {
      toast({
        title: 'Failed to load',
        description: err instanceof Error ? err.message : 'Could not load downloads.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('');
    setRoles([]);
    setFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleRole = (role: string) =>
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title.', variant: 'destructive' });
      return;
    }
    if (!file) {
      toast({ title: 'File required', description: 'Please choose a file to upload.', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      const uploaded = await uploadSingleFile(file, {
        folder: 'downloads',
        onProgress: setUploadProgress,
      });
      await createDownload({
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || 'general',
        fileUrl: uploaded.url,
        fileKey: uploaded.key,
        fileName: uploaded.originalName || uploaded.fileName,
        mimetype: uploaded.mimetype,
        size: uploaded.size,
        targeting: { userRoles: roles },
      });
      toast({ title: 'File added', description: 'The file is now available to selected roles.' });
      resetForm();
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Could not add the file.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDownload(deleteId);
      setItems((prev) => prev.filter((i) => i._id !== deleteId));
      toast({ title: 'Deleted', description: 'File removed from downloads.' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Could not delete.',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <DownloadIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Downloads</h1>
            <p className="text-sm text-muted-foreground">
              Upload files and control which roles can access them.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add File
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add a download</DialogTitle>
                <DialogDescription>Upload a file and choose who can access it.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dtitle">Title</Label>
                  <Input id="dtitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ddesc">Description (optional)</Label>
                  <Textarea id="ddesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dcat">Category (optional)</Label>
                  <Input id="dcat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Forms, Guidelines" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dfile">File</Label>
                  <Input
                    id="dfile"
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file && (
                    <p className="text-xs text-muted-foreground">
                      {file.name} · {formatFileSize(file.size)}
                    </p>
                  )}
                  {submitting && uploadProgress > 0 && (
                    <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                      <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Access (roles)</Label>
                  <p className="text-xs text-muted-foreground">
                    Leave all unchecked to make it available to every admin.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TARGET_ROLES.map((r) => (
                      <label key={r.value} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/50">
                        <Checkbox checked={roles.includes(r.value)} onCheckedChange={() => toggleRole(r.value)} />
                        <span className="text-sm">{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" /> Upload
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>All files uploaded to the Downloads area.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p>No files uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item._id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <h3 className="truncate font-medium">{item.title}</h3>
                      {!item.isActive && <Badge variant="outline">Hidden</Badge>}
                    </div>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(item.size)}</span>
                      <span>·</span>
                      <span>{item.downloadCount ?? 0} downloads</span>
                      {item.targeting?.userRoles && item.targeting.userRoles.length > 0 ? (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          {item.targeting.userRoles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px]">
                              {roleLabel(r)}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          All admins
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" asChild title="Open / download">
                      <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteId(item._id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              The file will be removed from storage and downloads. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
