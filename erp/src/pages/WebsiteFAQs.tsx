import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, HelpCircle } from 'lucide-react';
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
import { faqs as faqsApi } from '@/lib/api';
import { useRBAC } from '@/hooks/useRBAC';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  order: number;
  status: 'active' | 'inactive';
}

export default function WebsiteFAQs() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  const [items, setItems] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [deleting, setDeleting] = useState<FAQ | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '', category: 'general', order: 0, status: 'active' as 'active' | 'inactive' });

  const canWrite = hasAnyPermission(['website.write']);
  const canDelete = hasAnyPermission(['website.delete']);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res: any = await faqsApi.getAll();
      if (res.success) setItems(res.data);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch FAQs', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const openModal = (it?: FAQ) => {
    if (it) {
      setEditing(it);
      setForm({ question: it.question, answer: it.answer, category: it.category || 'general', order: it.order, status: it.status });
    } else {
      setEditing(null);
      setForm({ question: '', answer: '', category: 'general', order: items.length, status: 'active' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) {
      toast({ title: 'Validation Error', description: 'Question and answer are required', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      const res: any = editing ? await faqsApi.update(editing._id, form) : await faqsApi.create(form);
      if (res.success) {
        toast({ title: 'Success', description: editing ? 'FAQ updated' : 'FAQ created' });
        setIsModalOpen(false);
        fetchItems();
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save FAQ', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res: any = await faqsApi.delete(deleting._id);
      if (res.success) {
        toast({ title: 'Success', description: 'FAQ deleted' });
        setIsDeleteOpen(false); setDeleting(null); fetchItems();
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to delete FAQ', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading FAQs...</div></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">FAQ Management</h1>
          <p className="text-muted-foreground mt-1">Manage frequently asked questions shown on your website</p>
        </div>
        {canWrite && <Button onClick={() => openModal()}><Plus className="h-4 w-4 mr-2" />Add FAQ</Button>}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No FAQs yet</p>
          <p className="text-sm text-muted-foreground">Add your first question</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it._id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base">{it.question}</CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${it.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{it.status}</span>
                    {canWrite && <Button variant="ghost" size="icon" onClick={() => openModal(it)}><Edit2 className="h-4 w-4" /></Button>}
                    {canDelete && <Button variant="ghost" size="icon" onClick={() => { setDeleting(it); setIsDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </div>
              </CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{it.answer}</p></CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Question *</Label><Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
            <div><Label>Answer *</Label><VoiceTextarea rows={4} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Order</Label><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as 'active' | 'inactive' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
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
          <AlertDialogHeader><AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
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
