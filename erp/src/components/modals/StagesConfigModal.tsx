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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Settings, Users, CheckSquare, MessageSquare, FileUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { schemes, type Scheme } from "@/lib/api";

// Form schema for status stages
const commentRoleSchema = z.object({
  enabled: z.boolean().default(false),
  required: z.boolean().default(false)
});

const requiredDocumentSchema = z.object({
  name: z.string().min(1, "Document name is required").max(200, "Name must be less than 200 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  isRequired: z.boolean().default(true)
});

const stagesSchema = z.object({
  statusStages: z.array(z.object({
    name: z.string().min(1, "Stage name is required").max(100, "Name must be less than 100 characters"),
    description: z.string().max(500, "Description must be less than 500 characters").optional(),
    order: z.number().min(1, "Order must be at least 1"),
    isRequired: z.boolean().default(true),
    allowedRoles: z.array(z.string()).min(1, "At least one role must be selected"),
    commentConfig: z.object({
      unitAdmin: commentRoleSchema.default({ enabled: false, required: false }),
      areaAdmin: commentRoleSchema.default({ enabled: false, required: false }),
      districtAdmin: commentRoleSchema.default({ enabled: false, required: false })
    }).default({}),
    requiredDocuments: z.array(requiredDocumentSchema).default([])
  })).min(1, "At least one stage is required")
});

type FormData = z.infer<typeof stagesSchema>;

interface StagesConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheme: Scheme | null;
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

export function StagesConfigModal({ open, onOpenChange, scheme, onSuccess }: StagesConfigModalProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(stagesSchema),
    defaultValues: {
      statusStages: [
        {
          name: "Application Received",
          description: "Initial application submission and registration",
          order: 1,
          isRequired: true,
          allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin'],
          commentConfig: {
            unitAdmin: { enabled: false, required: false },
            areaAdmin: { enabled: false, required: false },
            districtAdmin: { enabled: false, required: false }
          },
          requiredDocuments: []
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "statusStages"
  });

  // Load existing stages when scheme changes
  useEffect(() => {
    if (scheme && scheme.statusStages && scheme.statusStages.length > 0) {
      form.reset({
        statusStages: scheme.statusStages.map((stage: any) => ({
          name: stage.name,
          description: stage.description || "",
          order: stage.order,
          isRequired: stage.isRequired !== false,
          allowedRoles: stage.allowedRoles || ['super_admin'],
          commentConfig: {
            unitAdmin: {
              enabled: stage.commentConfig?.unitAdmin?.enabled || false,
              required: stage.commentConfig?.unitAdmin?.required || false
            },
            areaAdmin: {
              enabled: stage.commentConfig?.areaAdmin?.enabled || false,
              required: stage.commentConfig?.areaAdmin?.required || false
            },
            districtAdmin: {
              enabled: stage.commentConfig?.districtAdmin?.enabled || false,
              required: stage.commentConfig?.districtAdmin?.required || false
            }
          },
          requiredDocuments: (stage.requiredDocuments || []).map((doc: any) => ({
            name: doc.name,
            description: doc.description || "",
            isRequired: doc.isRequired !== false
          }))
        }))
      });
    } else if (scheme) {
      // Reset to default checklist stages
      form.reset({
        statusStages: [
          {
            name: "Application Received",
            description: "Tick when application is submitted and registered in the system",
            order: 1,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin']
          },
          {
            name: "Document Verification",
            description: "Tick after verifying all submitted documents and checking eligibility criteria",
            order: 2,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin']
          },
          {
            name: "Field Verification",
            description: "Tick after completing physical verification and field assessment (if required)",
            order: 3,
            isRequired: false,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin']
          },
          {
            name: "Interview Process",
            description: "Tick after conducting beneficiary interview and assessment",
            order: 4,
            isRequired: scheme?.applicationSettings?.requiresInterview || false,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin', 'unit_admin', 'scheme_coordinator']
          },
          {
            name: "Final Review",
            description: "Tick after completing final review and making approval decision",
            order: 5,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin']
          },
          {
            name: "Approved",
            description: "Tick when application is approved and ready for disbursement",
            order: 6,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin']
          },
          {
            name: "Disbursement",
            description: "Tick when money has been disbursed to the beneficiary",
            order: 7,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin']
          },
          {
            name: "Completed",
            description: "Tick when entire application process is completed successfully",
            order: 8,
            isRequired: true,
            allowedRoles: ['super_admin', 'state_admin', 'district_admin', 'area_admin']
          }
        ]
      });
    }
  }, [scheme, form]);

  const onSubmit = async (data: FormData) => {
    if (!scheme) return;

    try {
      setLoading(true);

      // Validate order uniqueness
      const orders = data.statusStages.map(stage => stage.order);
      const uniqueOrders = [...new Set(orders)];
      if (orders.length !== uniqueOrders.length) {
        toast({
          title: "Validation Error",
          description: "Stage orders must be unique",
          variant: "destructive",
        });
        return;
      }

      // Update scheme with new status stages
      const response = await schemes.update(scheme.id, {
        statusStages: data.statusStages
      });

      if (response.success) {
        toast({
          title: "Success",
          description: "Status stages updated successfully",
        });
        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Failed to update status stages:', error);
      
      let errorMessage = "Failed to update status stages. Please try again.";
      
      if (error.message?.includes('401') || error.message?.includes('Authentication')) {
        errorMessage = "Authentication required. Please log in to save changes.";
      } else if (error.message?.includes('403') || error.message?.includes('Forbidden') || error.message?.includes('insufficient')) {
        errorMessage = "You don't have permission to modify this scheme's status stages.";
      } else if (error.message?.includes('404')) {
        errorMessage = "Scheme not found. Please check if the scheme still exists.";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Save failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addStage = () => {
    const maxOrder = Math.max(...fields.map(field => form.getValues(`statusStages.${fields.indexOf(field)}.order`)), 0);
    append({
      name: "New Checklist Item",
      description: "Tick when this task is completed",
      order: maxOrder + 1,
      isRequired: true,
      allowedRoles: ['super_admin'],
      commentConfig: {
        unitAdmin: { enabled: false, required: false },
        areaAdmin: { enabled: false, required: false },
        districtAdmin: { enabled: false, required: false }
      },
      requiredDocuments: []
    });
  };

  const removeStage = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      // Reorder remaining stages
      const currentStages = form.getValues("statusStages");
      currentStages.forEach((stage, i) => {
        if (i >= index) {
          form.setValue(`statusStages.${i}.order`, i + 1);
        }
      });
    }
  };

  if (!scheme) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            Configure Application Checklist - {scheme.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Set up checklist stages that users will tick off as they process each application. 
            Each stage represents a completion milestone in the application workflow.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    Application Checklist Stages
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Configure checklist stages that users will tick off for each application
                  </p>
                </div>
                <Button type="button" onClick={addStage} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stage
                </Button>
              </div>

              {/* Status Stages Accordion */}
              <Accordion type="multiple" className="w-full space-y-2">
                {fields.map((field, index) => {
                  const stageName = form.watch(`statusStages.${index}.name`) || `Stage ${index + 1}`;
                  const isRequired = form.watch(`statusStages.${index}.isRequired`);
                  
                  return (
                    <AccordionItem 
                      key={field.id} 
                      value={`stage-${index}`}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full mr-4">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs">
                              #{index + 1}
                            </Badge>
                            <span className="font-medium text-left">
                              {stageName || "Unnamed Stage"}
                            </span>
                            {isRequired && (
                              <Badge variant="secondary" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStage(index);
                              }}
                              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </AccordionTrigger>
                      
                      <AccordionContent className="pt-4 pb-6">
                        <div className="space-y-6">
                          {/* Basic Information */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`statusStages.${index}.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Checklist Item Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., Document Verification" {...field} />
                                  </FormControl>
                                  <FormDescription>
                                    This will appear as a checklist item for users
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`statusStages.${index}.order`}
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
                                  <FormDescription>
                                    Order in the checklist
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`statusStages.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Instructions for Users</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Describe what users need to do to complete this checklist item"
                                    className="resize-none"
                                    rows={3}
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Clear instructions on what needs to be completed for this stage
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Role Permissions */}
                          <FormField
                            control={form.control}
                            name={`statusStages.${index}.allowedRoles`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  Who Can Mark as Complete
                                </FormLabel>
                                <div className="grid grid-cols-2 gap-2 mt-2 p-4 border rounded-lg bg-muted/20">
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
                                <FormDescription>
                                  Select which roles can tick this checklist item as complete
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Stage Settings */}
                          <FormField
                            control={form.control}
                            name={`statusStages.${index}.isRequired`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                  <FormLabel className="text-base">Required Checklist Item</FormLabel>
                                  <FormDescription className="text-sm">
                                    Must be completed before application can proceed
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

                          {/* Comment Configuration */}
                          <div className="rounded-lg border p-4 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare className="h-4 w-4 text-primary" />
                              <h4 className="font-medium text-sm">Comment Configuration</h4>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">
                              Configure which admin roles need to add a comment at this stage
                            </p>

                            {/* Unit Admin Comment */}
                            <div className="flex flex-row items-center justify-between rounded-md border p-3 bg-muted/10">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">Unit Admin Comment</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Enable</span>
                                  <Switch
                                    checked={form.watch(`statusStages.${index}.commentConfig.unitAdmin.enabled`)}
                                    onCheckedChange={(val) => {
                                      form.setValue(`statusStages.${index}.commentConfig.unitAdmin.enabled`, val);
                                      if (!val) form.setValue(`statusStages.${index}.commentConfig.unitAdmin.required`, false);
                                    }}
                                  />
                                </div>
                                {form.watch(`statusStages.${index}.commentConfig.unitAdmin.enabled`) && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Required</span>
                                    <Switch
                                      checked={form.watch(`statusStages.${index}.commentConfig.unitAdmin.required`)}
                                      onCheckedChange={(val) => form.setValue(`statusStages.${index}.commentConfig.unitAdmin.required`, val)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Area Admin Comment */}
                            <div className="flex flex-row items-center justify-between rounded-md border p-3 bg-muted/10">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">Area Admin Comment</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Enable</span>
                                  <Switch
                                    checked={form.watch(`statusStages.${index}.commentConfig.areaAdmin.enabled`)}
                                    onCheckedChange={(val) => {
                                      form.setValue(`statusStages.${index}.commentConfig.areaAdmin.enabled`, val);
                                      if (!val) form.setValue(`statusStages.${index}.commentConfig.areaAdmin.required`, false);
                                    }}
                                  />
                                </div>
                                {form.watch(`statusStages.${index}.commentConfig.areaAdmin.enabled`) && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Required</span>
                                    <Switch
                                      checked={form.watch(`statusStages.${index}.commentConfig.areaAdmin.required`)}
                                      onCheckedChange={(val) => form.setValue(`statusStages.${index}.commentConfig.areaAdmin.required`, val)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* District Admin Comment */}
                            <div className="flex flex-row items-center justify-between rounded-md border p-3 bg-muted/10">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">District Admin Comment</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Enable</span>
                                  <Switch
                                    checked={form.watch(`statusStages.${index}.commentConfig.districtAdmin.enabled`)}
                                    onCheckedChange={(val) => {
                                      form.setValue(`statusStages.${index}.commentConfig.districtAdmin.enabled`, val);
                                      if (!val) form.setValue(`statusStages.${index}.commentConfig.districtAdmin.required`, false);
                                    }}
                                  />
                                </div>
                                {form.watch(`statusStages.${index}.commentConfig.districtAdmin.enabled`) && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Required</span>
                                    <Switch
                                      checked={form.watch(`statusStages.${index}.commentConfig.districtAdmin.required`)}
                                      onCheckedChange={(val) => form.setValue(`statusStages.${index}.commentConfig.districtAdmin.required`, val)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Required Documents */}
                          <div className="rounded-lg border p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileUp className="h-4 w-4 text-primary" />
                                <h4 className="font-medium text-sm">Required Documents</h4>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const currentDocs = form.getValues(`statusStages.${index}.requiredDocuments`) || [];
                                  form.setValue(`statusStages.${index}.requiredDocuments`, [
                                    ...currentDocs,
                                    { name: "", description: "", isRequired: true }
                                  ]);
                                }}
                              >
                                <Plus className="mr-1 h-3 w-3" />
                                Add Document
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Define documents that must be uploaded at this stage
                            </p>

                            {(form.watch(`statusStages.${index}.requiredDocuments`) || []).map((_, docIdx) => (
                              <div key={docIdx} className="flex items-start gap-3 p-3 rounded-md border bg-muted/10">
                                <div className="flex-1 space-y-2">
                                  <Input
                                    placeholder="Document name (e.g., Aadhaar Card)"
                                    value={form.watch(`statusStages.${index}.requiredDocuments.${docIdx}.name`)}
                                    onChange={(e) => form.setValue(`statusStages.${index}.requiredDocuments.${docIdx}.name`, e.target.value)}
                                  />
                                  <Input
                                    placeholder="Description (optional)"
                                    value={form.watch(`statusStages.${index}.requiredDocuments.${docIdx}.description`) || ""}
                                    onChange={(e) => form.setValue(`statusStages.${index}.requiredDocuments.${docIdx}.description`, e.target.value)}
                                  />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground">Required</span>
                                    <Switch
                                      checked={form.watch(`statusStages.${index}.requiredDocuments.${docIdx}.isRequired`)}
                                      onCheckedChange={(val) => form.setValue(`statusStages.${index}.requiredDocuments.${docIdx}.isRequired`, val)}
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const currentDocs = form.getValues(`statusStages.${index}.requiredDocuments`) || [];
                                      form.setValue(
                                        `statusStages.${index}.requiredDocuments`,
                                        currentDocs.filter((_, i) => i !== docIdx)
                                      );
                                    }}
                                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}

                            {(form.watch(`statusStages.${index}.requiredDocuments`) || []).length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                No documents configured for this stage
                              </p>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              {fields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No checklist stages configured yet.</p>
                  <p className="text-sm">Add your first stage to get started.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                Save Stages
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}