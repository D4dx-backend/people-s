import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Images, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import VoiceTextarea from '@/components/ui/VoiceTextarea';
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
import { gallery as galleryApi } from '@/lib/api';
import { useRBAC } from '@/hooks/useRBAC';

interface AlbumImage { _id: string; imageUrl: string; caption?: string; order: number; }
interface Album {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  coverImageUrl?: string;
  images: AlbumImage[];
  order: number;
  status: 'active' | 'inactive';
}

export default function WebsiteGallery() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  const [items, setItems] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Album | null>(null);
  const [deleting, setDeleting] = useState<Album | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<AlbumImage[]>([]);
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([]);
  const [form, setForm] = useState({ title: '', description: '', category: 'general', order: 0, status: 'active' as 'active' | 'inactive' });

  const canWrite = hasAnyPermission(['website.write']);
  const canDelete = hasAnyPermission(['website.delete']);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res: any = await galleryApi.getAll();
      if (res.success) setItems(res.data);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch albums', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const openModal = (it?: Album) => {
    if (it) {
      setEditing(it);
      setForm({ title: it.title, description: it.description || '', category: it.category || 'general', order: it.order, status: it.status });
      setCoverPreview(it.coverImageUrl || null);
      setExistingImages(it.images || []);
    } else {
      setEditing(null);
      setForm({ title: '', description: '', category: 'general', order: items.length, status: 'active' });
      setCoverPreview(null);
      setExistingImages([]);
    }
    setCoverFile(null);
    setNewImages([]);
    setRemoveImageIds([]);
    setIsModalOpen(true);
  };

  const onCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Invalid File', description: 'Select an image', variant: 'destructive' }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'File Too Large', description: 'Max 5MB', variant: 'destructive' }); return; }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    if (valid.length !== files.length) toast({ title: 'Some files skipped', description: 'Only images up to 5MB are allowed', variant: 'destructive' });
    setNewImages((prev) => [...prev, ...valid]);
    e.target.value = '';
  };

  const removeExisting = (id: string) => {
    setExistingImages((prev) => prev.filter((i) => i._id !== id));
    setRemoveImageIds((prev) => [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast({ title: 'Validation Error', description: 'Album title is required', variant: 'destructive' }); return; }
    if (!editing && newImages.length === 0) { toast({ title: 'Validation Error', description: 'Add at least one image', variant: 'destructive' }); return; }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('order', String(form.order));
      fd.append('status', form.status);
      if (coverFile) fd.append('cover', coverFile);
      newImages.forEach((f) => fd.append('images', f));
      if (editing && removeImageIds.length) fd.append('removeImageIds', JSON.stringify(removeImageIds));
      const res: any = editing ? await galleryApi.update(editing._id, fd) : await galleryApi.create(fd);
      if (res.success) { toast({ title: 'Success', description: editing ? 'Album updated' : 'Album created' }); setIsModalOpen(false); fetchItems(); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save album', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res: any = await galleryApi.delete(deleting._id);
      if (res.success) { toast({ title: 'Success', description: 'Album deleted' }); setIsDeleteOpen(false); setDeleting(null); fetchItems(); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to delete album', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading gallery...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Gallery Management</h1>
          <p className="text-muted-foreground mt-1">Create photo albums shown in your website gallery</p>
        </div>
        {canWrite && <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" />New Album</Button>}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Images className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No albums yet</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => (
            <Card key={it._id} className="overflow-hidden">
              <div className="relative h-44 bg-gray-100">
                {(it.coverImageUrl || it.images?.[0]?.imageUrl) ? <img src={it.coverImageUrl || it.images[0].imageUrl} alt={it.title} className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center"><Images className="h-10 w-10 text-muted-foreground" /></div>}
                <span className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${it.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{it.status}</span>
              </div>
              <CardHeader className="pb-2"><CardTitle className="text-base">{it.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{it.images?.length || 0} photos</p></CardHeader>
              <CardContent className="flex items-center justify-end gap-1">
                {canWrite && <Button variant="ghost" size="icon" onClick={() => openModal(it)}><Edit2 className="h-4 w-4" /></Button>}
                {canDelete && <Button variant="ghost" size="icon" onClick={() => { setDeleting(it); setIsDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Album' : 'New Album'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><VoiceTextarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Order</Label><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Cover Image (optional)</Label><Input type="file" accept="image/*" onChange={onCover} />
              {coverPreview && <img src={coverPreview} alt="cover" className="mt-2 h-24 rounded object-cover" />}</div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as 'active' | 'inactive' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>

            {existingImages.length > 0 && (
              <div>
                <Label>Existing Photos</Label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {existingImages.map((img) => (
                    <div key={img._id} className="relative group">
                      <img src={img.imageUrl} alt={img.caption || ''} className="h-20 w-full rounded object-cover" />
                      <button type="button" onClick={() => removeExisting(img._id)} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Add Photos {!editing && '*'}</Label>
              <Input type="file" accept="image/*" multiple onChange={onImages} />
              {newImages.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {newImages.map((f, idx) => (
                    <div key={idx} className="relative group">
                      <img src={URL.createObjectURL(f)} alt="" className="h-20 w-full rounded object-cover" />
                      <button type="button" onClick={() => setNewImages((prev) => prev.filter((_, i) => i !== idx))} className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-white"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
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
          <AlertDialogHeader><AlertDialogTitle>Delete Album?</AlertDialogTitle>
            <AlertDialogDescription>All photos in this album will be permanently deleted.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
