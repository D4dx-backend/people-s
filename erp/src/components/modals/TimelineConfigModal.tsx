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
import VoiceToTextButton from '@/components/ui/VoiceToTextButton';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Clock, Percent, Settings, Calendar, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { schemes, type Scheme } from "@/lib/api";

// Form schema for distribution timeline
const timelineSchema = z.object({
  distributionTimeline: z.array(z.object({
    description: z.string().min(1, "Description is required").max(200, "Description must be less than 200 characters"),
    percentage: z.number().min(0, "Percentage must be non-negative").max(100, "Percentage cannot exceed 100"),
    daysFromApproval: z.number().min(0, "Days must be non-negative"),
    requiresVerification: z.boolean().default(true),
    notes: z.string().max(500, "Notes must be less than 500 characters").optional()
  })).min(1, "At least one distribution step is required")
});

type FormData = z.infer<typeof timelineSchema>;

interface TimelineConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheme: Scheme | null;
  onSuccess: () => void;
}

export function TimelineConfigModal({ open, onOpenChange, scheme, onSuccess }: TimelineConfigModalProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(timelineSchema),
    defaultValues: {
      distributionTimeline: [
        {
          description: "Initial Payment (First Installment)",
          percentage: 50,
          daysFromApproval: 7,
          requiresVerification: true,
          notes: "First installment after approval"
        },
        {
          description: "Progress Payment (Second Installment)",
          percentage: 30,
          daysFromApproval: 60,
          requiresVerification: true,
          notes: "Payment after progress verification"
        },
        {
          description: "Final Payment (Completion)",
          percentage: 20,
          daysFromApproval: 120,
          requiresVerification: true,
          notes: "Final payment upon completion"
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "distributionTimeline"
  });

  // Load existing timeline when scheme changes
  useEffect(() => {
    if (scheme) {
      // Show the scheme's current distribution timeline
      // If scheme has no timeline, it should have been set with defaults during creation
      const timelineToShow = scheme.distributionTimeline && scheme.distributionTimeline.length > 0 
        ? scheme.distributionTimeline 
        : [
            // Fallback defaults (should not be needed if backend is working correctly)
            {
              description: "Initial Payment (First Installment)",
              percentage: 50,
              daysFromApproval: 7,
              isAutomatic: false,
              requiresVerification: true,
              notes: "First installment after approval"
            },
            {
              description: "Progress Payment (Second Installment)",
              percentage: 30,
              daysFromApproval: 60,
              isAutomatic: false,
              requiresVerification: true,
              notes: "Payment after progress verification"
            },
            {
              description: "Final Payment (Completion)",
              percentage: 20,
              daysFromApproval: 120,
              isAutomatic: false,
              requiresVerification: true,
              notes: "Final payment upon completion"
            }
          ];

      form.reset({
        distributionTimeline: timelineToShow.map(step => ({
          description: step.description || "",
          percentage: step.percentage || 0,
          daysFromApproval: step.daysFromApproval || 0,
          requiresVerification: step.requiresVerification !== false,
          notes: step.notes || ""
        }))
      });
    }
  }, [scheme, form]);

  const onSubmit = async (data: FormData) => {
    if (!scheme) return;

    try {
      setLoading(true);

      // Validate total percentage
      const totalPercentage = data.distributionTimeline.reduce((sum, step) => sum + step.percentage, 0);
      if (totalPercentage > 100) {
        toast({
          title: "Validation Error",
          description: "Total distribution percentage cannot exceed 100%",
          variant: "destructive",
        });
        return;
      }

      // Update scheme with new distribution timeline
      const response = await schemes.update(scheme.id, {
        distributionTimeline: data.distributionTimeline
      });

      if (response.success) {
        toast({
          title: "Success",
          description: "Distribution timeline updated successfully. Related applications will be updated automatically.",
        });
        
        // Show additional info about application updates
        setTimeout(() => {
          toast({
            title: "Info",
            description: "All approved applications for this scheme will have their distribution timelines updated based on the new configuration.",
          });
        }, 2000);
        
        onSuccess();
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update distribution timeline",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    append({
      description: "",
      percentage: 0,
      daysFromApproval: 0,
      requiresVerification: true,
      notes: ""
    });
  };

  const removeStep = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };



  // Calculate total percentage
  const totalPercentage = form.watch("distributionTimeline").reduce((sum, step) => sum + (step.percentage || 0), 0);

  if (!scheme) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Configure Distribution Timeline - {scheme.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure how money will be distributed to beneficiaries over time. 
            {scheme.distributionTimeline && scheme.distributionTimeline.length > 0 
              ? "Current configuration is shown below and can be modified."
              : "Default phases are loaded and can be customized."
            }
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Accordion type="multiple" defaultValue={["overview", "steps"]} className="w-full">
              {/* Timeline Overview Section */}
              <AccordionItem value="overview">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Timeline Overview
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {/* Total Percentage Indicator */}
                  <Card className={`p-4 ${totalPercentage > 100 ? 'border-red-500 bg-red-50' : totalPercentage === 100 ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        <span className="font-medium">Total Percentage:</span>
                      </div>
                      <div className={`text-lg font-bold ${totalPercentage > 100 ? 'text-red-600' : totalPercentage === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {totalPercentage}%
                      </div>
                    </div>
                    {totalPercentage > 100 && (
                      <p className="text-sm text-red-600 mt-1">Total percentage cannot exceed 100%</p>
                    )}
                    {totalPercentage < 100 && (
                      <p className="text-sm text-yellow-600 mt-1">Remaining: {100 - totalPercentage}%</p>
                    )}
                    {totalPercentage === 100 && (
                      <p className="text-sm text-green-600 mt-1">Perfect! All percentages allocated.</p>
                    )}
                  </Card>

                  {/* Timeline Summary */}
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">Timeline Summary</span>
                    </div>
                    <div className="space-y-2">
                      {fields.map((field, index) => {
                        const step = form.watch(`distributionTimeline.${index}`);
                        return (
                          <div key={field.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                            <span>{step.description || `Step ${index + 1}`}</span>
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>{step.percentage}%</span>
                              <span>Day {step.daysFromApproval}</span>
                              {step.requiresVerification && <CheckCircle className="h-3 w-3" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </AccordionContent>
              </AccordionItem>

              {/* Distribution Steps Section */}
              <AccordionItem value="steps">
                <AccordionTrigger className="text-lg font-semibold">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Distribution Steps Configuration
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Configure how money will be distributed to beneficiaries over time
                      </p>
                    </div>
                    <Button type="button" onClick={addStep} variant="outline" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Step
                    </Button>
                  </div>

                  {/* Distribution Steps */}
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <Accordion key={field.id} type="single" collapsible className="border rounded-lg">
                        <AccordionItem value={`step-${index}`} className="border-none">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center justify-between w-full mr-4">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                <span className="font-medium">
                                  Step {index + 1}: {form.watch(`distributionTimeline.${index}.description`) || "Untitled Step"}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{form.watch(`distributionTimeline.${index}.percentage`) || 0}%</span>
                                <span>Day {form.watch(`distributionTimeline.${index}.daysFromApproval`) || 0}</span>
                                {form.watch(`distributionTimeline.${index}.requiresVerification`) && (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                                {fields.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeStep(index);
                                    }}
                                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                  control={form.control}
                                  name={`distributionTimeline.${index}.description`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Description</FormLabel>
                                      <FormControl>
                                        <Input placeholder="e.g., Initial Payment" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`distributionTimeline.${index}.percentage`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Percentage (%)</FormLabel>
                                      <FormControl>
                                        <Input 
                                          type="number" 
                                          min="0" 
                                          max="100"
                                          placeholder="0"
                                          {...field}
                                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`distributionTimeline.${index}.daysFromApproval`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Days from Approval</FormLabel>
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
                                name={`distributionTimeline.${index}.notes`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                      <div className="relative">
                                        <Textarea 
                                          placeholder="Additional notes for this distribution step"
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
                                name={`distributionTimeline.${index}.requiresVerification`}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">Requires Verification</FormLabel>
                                      <FormDescription>
                                        Manual verification required before processing payment
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
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || totalPercentage > 100}>
                {loading && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                Save Timeline
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}