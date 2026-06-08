import React, { useState, useEffect } from 'react';
import { Trash2, Mail, Phone, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { contactMessages as api } from '@/lib/api';
import { useRBAC } from '@/hooks/useRBAC';

interface Message {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  createdAt: string;
}

const STATUSES = ['new', 'read', 'replied', 'archived'];
const statusColor = (s: string) => s === 'new' ? 'bg-blue-100 text-blue-800' : s === 'replied' ? 'bg-green-100 text-green-800' : s === 'archived' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800';

export default function WebsiteContactMessages() {
  const { toast } = useToast();
  const { hasAnyPermission } = useRBAC();
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Message | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const canDelete = hasAnyPermission(['website.delete']);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res: any = await api.getAll({ limit: 100 });
      if (res.success) setItems(res.data);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to fetch messages', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const changeStatus = async (id: string, status: string) => {
    try {
      const res: any = await api.updateStatus(id, { status });
      if (res.success) { setItems((prev) => prev.map((m) => m._id === id ? { ...m, status: status as Message['status'] } : m)); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res: any = await api.delete(deleting._id);
      if (res.success) { toast({ title: 'Success', description: 'Message deleted' }); setIsDeleteOpen(false); setDeleting(null); fetchItems(); }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to delete message', variant: 'destructive' });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-lg">Loading messages...</div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">Contact Messages</h1>
        <p className="text-muted-foreground mt-1">Messages submitted through your website contact form</p>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No messages yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <Card key={m._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{m.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(m.status)}`}>{m.status}</span>
                      <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    {m.subject && <p className="text-sm font-medium mt-1">{m.subject}</p>}
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{m.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {m.email && <a href={`mailto:${m.email}`} className="flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</a>}
                      {m.phone && <a href={`tel:${m.phone}`} className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Select value={m.status} onValueChange={(v) => changeStatus(m._id, v)}>
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                    {canDelete && <Button variant="ghost" size="icon" onClick={() => { setDeleting(m); setIsDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Message?</AlertDialogTitle>
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
