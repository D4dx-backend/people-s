import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Video as VideoIcon } from 'lucide-react';
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
import { videos as videosApi } from '@/lib/api';
import { useRBAC } from '@/hooks/useRBAC';

interface VideoItem {
  _id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  category?: string;
  featured: boolean;
  order: number;
  status: 'active' | 'inactive';
}

export default function WebsiteVideos() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  const [items, setItems] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<VideoItem | null>(null);
  const [deleting, setDeleting] = useState<VideoItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', videoUrl: '', category: 'general', featured: false, order: 0, status: 'active' as 'active' | 'inactive' });

  const canWrite = hasAnyPermission(['website.write']);
  const canDelete = hasAnyPermission(['website.delete']);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res: any = await videosApi.getAll();
      if (res.success) setItems(res.data);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch videos', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const openModal = (it?: VideoItem) => {
    if (it) {
      setEditing(it);
      setForm({ title: it.title, description: it.description || '', videoUrl: it.videoUrl, category: it.category || 'general', featured: it.featured, order: it.order, status: it.status });
      setThumbPreview(it.thumbnailUrl || null);
    } else {
      setEditing(null);
      setForm({ title: '', description: '', videoUrl: '', category: 'general', featured: false, order: items.length, status: 'active' });
      setThumbPreview(null);
    }
    setThumbFile(null);
    setIsModalOpen(true);
  };

  const onThumb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Invalid File', description: 'Select an image', variant: 'destructive' }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'File Too Large', description: 'Max 5MB', variant: 'destructive' }); return; }
    setThumbFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setThumbPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.videoUrl.trim()) {
      toast({ title: 'Validation Error', description: 'Title and video URL are required', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('videoUrl', form.videoUrl);
      fd.append('category', form.category);
      fd.append('featured', String(form.featured));
      fd.append('order', String(form.order));
      fd.append('status', form.status);
      if (thumbFile) fd.append('thumbnail', thumbFile);
      const res: any = editing ? await videosApi.update(editing._id, fd) : await videosApi.create(fd);
      if (res.success) {
        toast({ title: 'Success', description: editing ? 'Video updated' : 'Video created' });
        setIsModalOpen(false);
        fetchItems();
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save video', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res: any = await videosApi.delete(deleting._id);
      if (res.success) { toast({ title: 'Success', description: 'Video deleted' }); setIsDeleteOpen(false); setDeleting(null); fetchItems(); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to delete video', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading videos...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Video Management</h1>
          <p className="text-muted-foreground mt-1">Manage videos shown in your website video portal</p>
        </div>
        {canWrite && <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" />Add Video</Button>}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <VideoIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No videos yet</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => (
            <Card key={it._id} className="overflow-hidden">
              <div className="relative h-40 bg-gray-100">
                {it.thumbnailUrl ? <img src={it.thumbnailUrl} alt={it.title} className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center"><VideoIcon className="h-10 w-10 text-muted-foreground" /></div>}
                <span className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${it.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{it.status}</span>
              </div>
              <CardHeader className="pb-2"><CardTitle className="text-base">{it.title}</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-between">
                <a href={it.videoUrl} target="_blank" rel="noreferrer" className="text-sm text-primary truncate max-w-[60%]">Watch</a>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Video' : 'Add Video'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Video URL * (YouTube or direct)</Label><Input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." /></div>
            <div><Label>Description</Label><VoiceTextarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Thumbnail (optional)</Label><Input type="file" accept="image/*" onChange={onThumb} />
              {thumbPreview && <img src={thumbPreview} alt="preview" className="mt-2 h-24 rounded object-cover" />}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Order</Label><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />Featured</label>
              <div className="flex-1"><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as 'active' | 'inactive' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select></div>
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
          <AlertDialogHeader><AlertDialogTitle>Delete Video?</AlertDialogTitle>
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
