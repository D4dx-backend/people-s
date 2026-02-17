import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import VoiceToTextButton from '@/components/ui/VoiceToTextButton';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Settings, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { projectsEnhanced, type Project } from "@/lib/api";

// Form schema for project stages configuration
const stagesConfigSchema = z.object({
  stages: z.array(z.object({
    name: z.string().min(1, "Stage name is required").max(100, "Name must be less than 100 characters"),
    description: z.string().max(500, "Description must be less than 500 characters").optional(),
    order: z.number().min(1, "Order must be at least 1"),
    isRequired: z.boolean().default(true),
    allowedRoles: z.array(z.string()).min(1, "At least one role must be selected"),
    estimatedDuration: z.number().min(0, "Duration must be non-negative").optional()
  })).min(1, "At least one stage is required"),
  enablePublicTracking: z.boolean().default(false),
  notificationSettings: z.object({
    emailNotifications: z.boolean().default(true),
    smsNotifications: z.boolean().default(false)
  }).optional()
});

type FormData = z.infer<typeof stagesConfigSchema>;

interface ProjectStagesConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onSuccess: () => void;
}

const roleOptions = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'state_admin', label: 'State Admin' },
  { value: 'district_admin', label: 'District Admin' },
  { value: 'area_admin', label: 'Area Admin' },
  { value: 'unit_admin', label: 'Unit Admin' },
  { value: 'project_coordinator', label: 'Project Coordinator' },
  { value: 'scheme_coordinator', label: 'Scheme Coordinator' }
];

export function ProjectStagesConfigModal({ open, onOpenChange, project, onSuccess }: ProjectStagesConfigModalProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(stagesConfigSchema),
    defaultValues: {
      stages: [
        {
          name: "Project Initiation",
          description: "Initial project setup and planning",
          order: 1,
          isRequired: true,
          allowedRoles: ['super_admin', 'state_admin', 'project_coordinator'],
          estimatedDuration: 7
        }
      ],
      enablePublicTracking: false,
      notificationSettings: {
        emailNotifications: true,
        smsNotifications: false
      }
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "stages"
  });

  // Load existing configuration when project changes
  useEffect(() => {
    if (project) {
      loadConfiguration();
    }
  }, [project]);

  const loadConfiguration = async () => {
    if (!project) return;

    try {
      const response = await projectsEnhanced.getStatusConfiguration(project.id);
      
      if (response.success && response.data?.statusConfiguration) {
        const config = response.data.statusConfiguration;
        
        form.reset({
          stages: config.stages || [
            {
              name: "Project Initiation",
              description: "Initial project setup and planning",
              order: 1,
              isRequired: true,
              allowedRoles: ['super_admin', 'state_admin', 'project_coordinator'],
              estimatedDuration: 7
            }
          ],
          enablePublicTracking: config.enablePublicTracking || false,
          notificationSettings: config.notificationSettings || {
            emailNotifications: true,
            smsNotifications: false
          }
        });
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!project) return;

    try {
      setLoading(true);

      // Validate order uniqueness
      const orders = data.stages.map(stage => stage.order);
      const uniqueOrders = [...new Set(orders)];
      if (orders.length !== uniqueOrders.length) {
        toast({
          title: "Validation Error",
          description: "Stage orders must be unique",
          variant: "destructive",
        });
        return;
      }

      const response = await projectsEnhanced.updateStatusConfiguration(project.id, data);

      if (response.success) {
        toast({
          title: "Success",
          description: "Project stages configuration updated successfully",
        });
        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update stages configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addStage = () => {
    const maxOrder = Math.max(...fields.map((_, index) => form.getValues(`stages.${index}.order`)), 0);
    append({
      name: "",
      description: "",
      order: maxOrder + 1,
      isRequired: true,
      allowedRoles: ['super_admin'],
      estimatedDuration: 0
    });
  };

  const removeStage = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      // Reorder remaining stages
      const currentStages = form.getValues("stages");
      currentStages.forEach((stage, i) => {
        if (i >= index) {
          form.setValue(`stages.${i}.order`, i + 1);
        }
      });
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure Project Stages - {project.name}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Stages Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Project Stages</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure the workflow stages for this project
                  </p>
                </div>
                <Button type="button" onClick={addStage} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stage
                </Button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <Card key={field.id} className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                        <span className="font-medium">Stage {index + 1}</span>
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeStage(index)}
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`stages.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stage Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Project Initiation" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`stages.${index}.order`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Order</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="1"
                                placeholder="1"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`stages.${index}.estimatedDuration`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration (days)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`stages.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Textarea 
                                placeholder="Describe what happens in this stage"
                                className="resize-none pr-12"
                                {...field}
                              />
                              <div className="absolute right-2 top-2">
                                <VoiceToTextButton
                                  onTranscript={(text) => field.onChange(field.value ? field.value + ' ' + text : text)}
                                  size="icon"
                                  className="h-8 w-8"
                                />
                              </div>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`stages.${index}.allowedRoles`}
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Allowed Roles
                          </FormLabel>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {roleOptions.map((role) => (
                              <div key={role.value} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${index}-${role.value}`}
                                  checked={field.value?.includes(role.value)}
                                  onCheckedChange={(checked) => {
                                    const currentRoles = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentRoles, role.value]);
                                    } else {
                                      field.onChange(currentRoles.filter(r => r !== role.value));
                                    }
                                  }}
                                />
                                <label htmlFor={`${index}-${role.value}`} className="text-sm">
                                  {role.label}
                                </label>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`stages.${index}.isRequired`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 mt-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Required Stage</FormLabel>
                            <FormDescription>
                              This stage must be completed before proceeding
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </Card>
                ))}
              </div>
            </div>

            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="enablePublicTracking"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Public Tracking</FormLabel>
                        <FormDescription>
                          Allow public access to project status tracking
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notificationSettings.emailNotifications"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Email Notifications</FormLabel>
                        <FormDescription>
                          Send email notifications for status updates
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notificationSettings.smsNotifications"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">SMS Notifications</FormLabel>
                        <FormDescription>
                          Send SMS notifications for critical updates
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                Save Configuration
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}