import { useEffect, useState, useCallback } from 'react';
import { Bell, Send, Trash2, Users, Eye, Loader2, Megaphone, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import RichTextEditor, { UploadedEditorImage } from '@/components/RichTextEditor';
import SafeHtml from '@/components/SafeHtml';
import {
  createBroadcast,
  getSentNotifications,
  deleteSentNotification,
  getTimeAgo,
  type Notification,
} from '@/services/notificationService';

const TARGET_ROLES: { value: string; label: string }[] = [
  { value: 'district_admin', label: 'District Admins' },
  { value: 'area_admin', label: 'Area Admins' },
  { value: 'area_president', label: 'Area Coordinators' },
  { value: 'unit_admin', label: 'Unit Admins' },
  { value: 'project_coordinator', label: 'Project Coordinators' },
  { value: 'scheme_coordinator', label: 'Scheme Coordinators' },
  { value: 'beneficiary', label: 'Beneficiaries' },
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

// Strip HTML tags to derive a plain-text fallback message for the model.
function htmlToText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

export default function Notifications() {
  const { toast } = useToast();
  const [tab, setTab] = useState('compose');

  // Compose state
  const [title, setTitle] = useState('');
  const [html, setHtml] = useState('');
  const [images, setImages] = useState<UploadedEditorImage[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium');
  const [roles, setRoles] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // Sent list state
  const [sent, setSent] = useState<Notification[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [preview, setPreview] = useState<Notification | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadSent = useCallback(async () => {
    try {
      setLoadingSent(true);
      const data = await getSentNotifications({ limit: 100 });
      setSent(data);
    } catch (err) {
      toast({
        title: 'Failed to load',
        description: err instanceof Error ? err.message : 'Could not load sent notifications.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSent(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === 'sent') loadSent();
  }, [tab, loadSent]);

  const toggleRole = (role: string) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const resetForm = () => {
    setTitle('');
    setHtml('');
    setImages([]);
    setLinkUrl('');
    setLinkLabel('');
    setPriority('medium');
    setRoles([]);
  };

  const handleSend = async () => {
    const plain = htmlToText(html);
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Please enter a title.', variant: 'destructive' });
      return;
    }
    if (!plain) {
      toast({ title: 'Message required', description: 'Please enter a message.', variant: 'destructive' });
      return;
    }
    if (roles.length === 0) {
      toast({ title: 'Select recipients', description: 'Choose at least one target role.', variant: 'destructive' });
      return;
    }

    try {
      setSending(true);
      const { recipientCount } = await createBroadcast({
        title: title.trim(),
        message: plain.slice(0, 1000),
        htmlContent: html,
        images,
        linkUrl: linkUrl.trim(),
        linkLabel: linkLabel.trim(),
        priority,
        targeting: { userRoles: roles },
      });
      toast({
        title: 'Notification sent',
        description: `Delivered to ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}.`,
      });
      resetForm();
      setTab('sent');
    } catch (err) {
      toast({
        title: 'Send failed',
        description: err instanceof Error ? err.message : 'Could not send the notification.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSentNotification(deleteId);
      setSent((prev) => prev.filter((n) => n._id !== deleteId));
      toast({ title: 'Deleted', description: 'Notification removed for all recipients.' });
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
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Compose and broadcast announcements to admins and coordinators.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="compose">
            <Megaphone className="mr-2 h-4 w-4" /> Compose
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="mr-2 h-4 w-4" /> Sent
          </TabsTrigger>
        </TabsList>

        {/* Compose */}
        <TabsContent value="compose" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Message</CardTitle>
                <CardDescription>Write the title and rich content. Images can be added inline.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Monthly review meeting"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <RichTextEditor
                    value={html}
                    onChange={setHtml}
                    onImageUploaded={(img) => setImages((prev) => [...prev, img])}
                    uploadFolder="notifications"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="linkUrl">Link URL (optional)</Label>
                    <Input
                      id="linkUrl"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkLabel">Link label (optional)</Label>
                    <Input
                      id="linkLabel"
                      value={linkLabel}
                      onChange={(e) => setLinkLabel(e.target.value)}
                      placeholder="e.g. View details"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
                <CardDescription>Select which roles should receive this.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {TARGET_ROLES.map((r) => (
                    <label
                      key={r.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-muted/50"
                    >
                      <Checkbox checked={roles.includes(r.value)} onCheckedChange={() => toggleRole(r.value)} />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" onClick={handleSend} disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Send Notification
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sent */}
        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Sent Notifications</CardTitle>
                <CardDescription>Notifications you have broadcast.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadSent} disabled={loadingSent}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingSent ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingSent ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sent.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Bell className="mx-auto mb-3 h-10 w-10 opacity-40" />
                  <p>No notifications sent yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sent.map((n) => (
                    <div
                      key={n._id}
                      className="flex items-start justify-between gap-4 rounded-lg border p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium">{n.title}</h3>
                          <Badge variant="outline" className="capitalize">
                            {n.priority}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {n.delivery?.totalRecipients ?? 0} recipients
                          </span>
                          <span>{n.delivery?.readCount ?? 0} read</span>
                          <span>{getTimeAgo(n.createdAt)}</span>
                          {(n.targeting?.userRoles || []).map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px]">
                              {TARGET_ROLES.find((t) => t.value === r)?.label || r}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setPreview(n)} title="Preview">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteId(n._id)}
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
        </TabsContent>
      </Tabs>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>{preview && getTimeAgo(preview.createdAt)}</DialogDescription>
          </DialogHeader>
          {preview?.htmlContent ? (
            <SafeHtml html={preview.htmlContent} />
          ) : (
            <p className="whitespace-pre-wrap text-sm">{preview?.message}</p>
          )}
          {preview?.linkUrl && (
            <a
              href={preview.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              {preview.linkLabel || preview.linkUrl}
            </a>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this notification?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the notification for every recipient. This action cannot be undone.
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
