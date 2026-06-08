import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Newspaper, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { media as mediaApi } from '@/lib/api';
import { useRBAC } from '@/hooks/useRBAC';

interface MediaItem {
  _id: string;
  title: string;
  source?: string;
  link?: string;
  imageUrl?: string;
  publishDate?: string;
  order: number;
  status: 'active' | 'inactive';
}

export default function WebsiteMedia() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState<MediaItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', source: '', link: '', publishDate: '', order: 0, status: 'active' as 'active' | 'inactive' });

  const canWrite = hasAnyPermission(['website.write']);
  const canDelete = hasAnyPermission(['website.delete']);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res: any = await mediaApi.getAll();
      if (res.success) setItems(res.data);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch media', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const openModal = (it?: MediaItem) => {
    if (it) {
      setEditing(it);
      setForm({ title: it.title, source: it.source || '', link: it.link || '', publishDate: it.publishDate ? it.publishDate.slice(0, 10) : '', order: it.order, status: it.status });
      setImagePreview(it.imageUrl || null);
    } else {
      setEditing(null);
      setForm({ title: '', source: '', link: '', publishDate: '', order: items.length, status: 'active' });
      setImagePreview(null);
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Invalid File', description: 'Select an image', variant: 'destructive' }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'File Too Large', description: 'Max 5MB', variant: 'destructive' }); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast({ title: 'Validation Error', description: 'Title is required', variant: 'destructive' }); return; }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('source', form.source);
      fd.append('link', form.link);
      if (form.publishDate) fd.append('publishDate', form.publishDate);
      fd.append('order', String(form.order));
      fd.append('status', form.status);
      if (imageFile) fd.append('image', imageFile);
      const res: any = editing ? await mediaApi.update(editing._id, fd) : await mediaApi.create(fd);
      if (res.success) { toast({ title: 'Success', description: editing ? 'Updated' : 'Created' }); setIsModalOpen(false); fetchItems(); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res: any = await mediaApi.delete(deleting._id);
      if (res.success) { toast({ title: 'Success', description: 'Deleted' }); setIsDeleteOpen(false); setDeleting(null); fetchItems(); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to delete', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading media coverage...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Media Coverage</h1>
          <p className="text-muted-foreground mt-1">Manage press mentions and media coverage shown on your website</p>
        </div>
        {canWrite && <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" />Add Coverage</Button>}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Newspaper className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No media coverage yet</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => (
            <Card key={it._id} className="overflow-hidden">
              {it.imageUrl && <div className="h-40 bg-gray-100"><img src={it.imageUrl} alt={it.title} className="w-full h-full object-cover" /></div>}
              <CardHeader className="pb-2"><CardTitle className="text-base">{it.title}</CardTitle>
                {it.source && <p className="text-xs text-muted-foreground">{it.source}</p>}</CardHeader>
              <CardContent className="flex items-center justify-between">
                {it.link ? <a href={it.link} target="_blank" rel="noreferrer" className="text-sm text-primary flex items-center gap-1"><ExternalLink className="h-3 w-3" />Read</a> : <span />}
                <div className="flex gap-1">
                  {canWrite && <Button variant="ghost" size="icon" onClick={() => openModal(it)}><Edit2 className="h-4 w-4" /></Button>}
                  {canDelete && <Button variant="ghost" size="icon" onClick={() => { setDeleting(it); setIsDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Coverage' : 'Add Coverage'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Source</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. The Hindu" /></div>
              <div><Label>Publish Date</Label><Input type="date" value={form.publishDate} onChange={(e) => setForm({ ...form, publishDate: e.target.value })} /></div>
            </div>
            <div><Label>Article Link</Label><Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Image (optional)</Label><Input type="file" accept="image/*" onChange={onImage} />
              {imagePreview && <img src={imagePreview} alt="preview" className="mt-2 h-24 rounded object-cover" />}</div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Order</Label><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as 'active' | 'inactive' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Coverage?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
