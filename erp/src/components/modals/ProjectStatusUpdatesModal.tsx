import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import VoiceTextarea from "@/components/ui/VoiceTextarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { projectsEnhanced, type Project } from "@/lib/api";

// Form schema for status update
const statusUpdateSchema = z.object({
  stage: z.string().min(1, "Stage is required"),
  status: z.enum(['pending', 'in_progress', 'completed', 'on_hold', 'cancelled']),
  description: z.string().min(1, "Description is required").max(1000, "Description must be less than 1000 characters"),
  remarks: z.string().max(500, "Remarks must be less than 500 characters").optional()
});

type FormData = z.infer<typeof statusUpdateSchema>;

interface ProjectStatusUpdatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSuccess: () => void;
}

const statusColors = {
  pending: "bg-gray-100 text-gray-800 border-gray-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  on_hold: "bg-yellow-100 text-yellow-800 border-yellow-200",
  cancelled: "bg-red-100 text-red-800 border-red-200"
};

const statusIcons = {
  pending: Clock,
  in_progress: Activity,
  completed: CheckCircle,
  on_hold: AlertCircle,
  cancelled: XCircle
};

export function ProjectStatusUpdatesModal({ open, onOpenChange, project, onSuccess }: ProjectStatusUpdatesModalProps) {
  const [loading, setLoading] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState<any[]>([]);
  const [editingUpdate, setEditingUpdate] = useState<any | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: {
      stage: "",
      status: "pending",
      description: "",
      remarks: ""
    }
  });

  // Load status updates when project changes
  useEffect(() => {
    if (project && project.statusUpdates) {
      setStatusUpdates(project.statusUpdates);
    }
  }, [project]);

  const onSubmit = async (data: FormData) => {
    if (!project) return;

    try {
      setLoading(true);

      const response = editingUpdate
        ? await projectsEnhanced.updateStatusUpdate(project.id, editingUpdate._id, data)
        : await projectsEnhanced.addStatusUpdate(project.id, data);

      if (response.success) {
        toast({
          title: "Success",
          description: `Status update ${editingUpdate ? 'updated' : 'added'} successfully`,
        });
        
        // Update local state
        if (response.data?.project?.statusUpdates) {
          setStatusUpdates(response.data.project.statusUpdates);
        }
        
        onSuccess();
        handleCancelEdit();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingUpdate ? 'update' : 'add'} status update`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (update: any) => {
    setEditingUpdate(update);
    form.reset({
      stage: update.stage,
      status: update.status,
      description: update.description,
      remarks: update.remarks || ""
    });
    setShowAddForm(true);
  };

  const handleDelete = async (updateId: string) => {
    if (!project) return;

    try {
      setLoading(true);
      const response = await projectsEnhanced.deleteStatusUpdate(project.id, updateId);
      
      if (response.success) {
        toast({
          title: "Success",
          description: "Status update deleted successfully",
        });
        
        // Remove from local state
        setStatusUpdates(prev => prev.filter(update => update._id !== updateId));
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete status update",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUpdate(null);
    setShowAddForm(false);
    form.reset({
      stage: "",
      status: "pending",
      description: "",
      remarks: ""
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status Updates - {project.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="updates" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="updates">Status Updates</TabsTrigger>
            <TabsTrigger value="add">Add Update</TabsTrigger>
          </TabsList>

          <TabsContent value="updates" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Recent Updates</h3>
              <Button onClick={() => setShowAddForm(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Update
              </Button>
            </div>

            {statusUpdates.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No status updates yet</p>
                  <p className="text-sm mt-1">Add the first status update to track project progress</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {statusUpdates
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .map((update) => {
                    const StatusIcon = statusIcons[update.status as keyof typeof statusIcons];
                    
                    return (
                      <Card key={update._id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <Badge className={statusColors[update.status as keyof typeof statusColors]} variant="outline">
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {update.status.replace('_', ' ')}
                              </Badge>
                              <span className="font-semibold">{update.stage}</span>
                            </div>
                            
                            <p className="text-sm">{update.description}</p>
                            
                            {update.remarks && (
                              <div className="p-2 bg-muted rounded text-sm">
                                <strong>Remarks:</strong> {update.remarks}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Updated: {formatDate(update.updatedAt)}</span>
                              <span>By: {update.updatedBy?.name || 'Unknown'}</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 ml-4">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(update)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleDelete(update._id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            {showAddForm && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingUpdate ? 'Edit Status Update' : 'Add Status Update'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="stage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stage</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Planning Phase" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="on_hold">On Hold</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <VoiceTextarea 
                                placeholder="Describe the current status and progress"
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="remarks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Remarks (Optional)</FormLabel>
                            <FormControl>
                              <VoiceTextarea 
                                placeholder="Additional remarks or notes"
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={handleCancelEdit}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                          {loading && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                          {editingUpdate ? 'Update' : 'Add'} Status
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {!showAddForm && (
              <div className="text-center py-8">
                <Button onClick={() => setShowAddForm(true)} size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Status Update
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}