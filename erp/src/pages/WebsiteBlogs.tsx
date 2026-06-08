import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FileText } from 'lucide-react';
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
import { blogs as blogsApi } from '@/lib/api';
import { useRBAC } from '@/hooks/useRBAC';

interface BlogItem {
  _id: string;
  title: string;
  slug: string;
  author?: string;
  excerpt?: string;
  content: string;
  coverImageUrl?: string;
  category?: string;
  tags?: string[];
  featured: boolean;
  publishDate?: string;
  views: number;
  status: 'draft' | 'published' | 'archived';
}

export default function WebsiteBlogs() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  const [items, setItems] = useState<BlogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<BlogItem | null>(null);
  const [deleting, setDeleting] = useState<BlogItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', author: '', excerpt: '', content: '', category: 'general', tags: '', featured: false, status: 'draft' as BlogItem['status'] });

  const canWrite = hasAnyPermission(['website.write']);
  const canDelete = hasAnyPermission(['website.delete']);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res: any = await blogsApi.getAll();
      if (res.success) setItems(res.data);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch blogs', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const openModal = (it?: BlogItem) => {
    if (it) {
      setEditing(it);
      setForm({ title: it.title, author: it.author || '', excerpt: it.excerpt || '', content: it.content, category: it.category || 'general', tags: (it.tags || []).join(', '), featured: it.featured, status: it.status });
      setCoverPreview(it.coverImageUrl || null);
    } else {
      setEditing(null);
      setForm({ title: '', author: '', excerpt: '', content: '', category: 'general', tags: '', featured: false, status: 'draft' });
      setCoverPreview(null);
    }
    setCoverFile(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Validation Error', description: 'Title and content are required', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('author', form.author);
      fd.append('excerpt', form.excerpt);
      fd.append('content', form.content);
      fd.append('category', form.category);
      fd.append('tags', form.tags);
      fd.append('featured', String(form.featured));
      fd.append('status', form.status);
      if (coverFile) fd.append('cover', coverFile);
      const res: any = editing ? await blogsApi.update(editing._id, fd) : await blogsApi.create(fd);
      if (res.success) { toast({ title: 'Success', description: editing ? 'Blog updated' : 'Blog created' }); setIsModalOpen(false); fetchItems(); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save blog', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res: any = await blogsApi.delete(deleting._id);
      if (res.success) { toast({ title: 'Success', description: 'Blog deleted' }); setIsDeleteOpen(false); setDeleting(null); fetchItems(); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to delete blog', variant: 'destructive' });
    }
  };

  const statusColor = (s: string) => s === 'published' ? 'bg-green-100 text-green-800' : s === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800';

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading blogs...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">Blog Management</h1>
          <p className="text-muted-foreground mt-1">Write and publish articles for your website</p>
        </div>
        {canWrite && <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" />New Blog</Button>}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No blog posts yet</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => (
            <Card key={it._id} className="overflow-hidden">
              {it.coverImageUrl && <div className="h-40 bg-gray-100"><img src={it.coverImageUrl} alt={it.title} className="w-full h-full object-cover" /></div>}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{it.title}</CardTitle>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${statusColor(it.status)}`}>{it.status}</span>
                </div>
                {it.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{it.excerpt}</p>}
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{it.views} views</span>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Blog' : 'New Blog'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Author</Label><Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div><Label>Excerpt</Label><VoiceTextarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></div>
            <div><Label>Content *</Label><VoiceTextarea rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div><Label>Tags (comma-separated)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div><Label>Cover Image</Label><Input type="file" accept="image/*" onChange={onCover} />
              {coverPreview && <img src={coverPreview} alt="preview" className="mt-2 h-24 rounded object-cover" />}</div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />Featured</label>
              <div className="flex-1"><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as BlogItem['status'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
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
          <AlertDialogHeader><AlertDialogTitle>Delete Blog?</AlertDialogTitle>
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
