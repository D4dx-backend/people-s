import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import VoiceToTextButton from '@/components/ui/VoiceToTextButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { X, ChevronRight, ChevronLeft, User, Settings, Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useCreateDonor, useUpdateDonor } from '@/hooks/useDonors';
import { DonorFormData } from '@/types/donor';

const donorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  type: z.enum(['individual', 'corporate', 'foundation', 'trust']),
  address: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().optional().default(''),
    state: z.string().min(1, 'State is required'),
    pincode: z.string().optional().default(''),
    country: z.string().default('India'),
  }),
  preferences: z.object({
    communicationMethod: z.enum(['email', 'phone', 'sms', 'whatsapp']),
    anonymousGiving: z.boolean().default(false),
  }),
  donationPreferences: z.object({
    frequency: z.enum(['one-time', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom']).default('one-time'),
    customIntervalDays: z.number().min(1).optional(),
    preferredAmount: z.coerce.number().min(0).optional(),
    preferredMethod: z.enum(['upi', 'bank_transfer', 'card', 'cash', 'cheque']).default('upi'),
    anonymousDonation: z.boolean().default(false),
  }),
  taxInfo: z.object({
    panNumber: z.string().optional(),
    gstNumber: z.string().optional(),
  }),
  tags: z.array(z.string()).default([]),
  notes: z.string().default(''),
});

// All Indian states/UTs for dropdown
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

// Step 1 fields for partial validation
const step1Fields = ['name', 'phone', 'type', 'address.street', 'address.state'] as const;

interface DonorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donor?: any;
  mode: "create" | "edit";
  onSuccess?: (donor: any) => void;
}

export function DonorModal({ open, onOpenChange, donor, mode, onSuccess }: DonorModalProps) {
  const [step, setStep] = useState(1);
  const [newTag, setNewTag] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const createDonor = useCreateDonor();
  const updateDonor = useUpdateDonor();

  const form = useForm<DonorFormData>({
    resolver: zodResolver(donorSchema),
    defaultValues: {
      name: donor?.name || '',
      email: donor?.email || '',
      phone: donor?.phone || '',
      type: donor?.type || 'individual',
      address: {
        street: donor?.address?.street || '',
        city: donor?.address?.city || '',
        state: donor?.address?.state || 'Kerala',
        pincode: donor?.address?.pincode || '',
        country: 'India',
      },
      preferences: {
        communicationMethod: donor?.preferences?.communicationMethod || 'email',
        anonymousGiving: donor?.preferences?.anonymousGiving || false,
      },
      donationPreferences: {
        frequency: donor?.donationPreferences?.frequency || 'one-time',
        customIntervalDays: donor?.donationPreferences?.customIntervalDays || undefined,
        preferredAmount: donor?.donationPreferences?.preferredAmount || undefined,
        preferredMethod: donor?.donationPreferences?.preferredMethod || 'upi',
        anonymousDonation: donor?.donationPreferences?.anonymousDonation || false,
      },
      taxInfo: {
        panNumber: donor?.taxInfo?.panNumber || '',
        gstNumber: donor?.taxInfo?.gstNumber || '',
      },
      tags: donor?.tags || [],
      notes: donor?.notes || '',
    },
  });

  const isLoading = createDonor.isPending || updateDonor.isPending;

  const handleNext = async () => {
    const valid = await form.trigger(step1Fields as any);
    if (valid) setStep(2);
  };

  const handleBack = () => setStep(1);

  const onSubmit = async (data: DonorFormData) => {
    try {
      let result;
      if (mode === 'create') {
        result = await createDonor.mutateAsync(data);
      } else {
        result = await updateDonor.mutateAsync({ id: donor.id || donor._id, data });
      }

      onOpenChange(false);
      form.reset();
      setStep(1);

      if (onSuccess && result?.data) {
        onSuccess(result.data);
      }
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  const addTag = () => {
    if (newTag.trim() && !form.getValues('tags').includes(newTag.trim())) {
      const currentTags = form.getValues('tags');
      form.setValue('tags', [...currentTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags');
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) setStep(1);
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New Donor" : "Edit Donor"}</DialogTitle>
          {/* Step Indicator */}
          <div className="flex items-center gap-2 pt-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                step === 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <User className="h-3.5 w-3.5" />
              <span>1. Basic Info & Address</span>
            </button>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              type="button"
              onClick={() => { if (step === 2) return; handleNext(); }}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                step === 2
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>2. Preferences & Details</span>
            </button>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* ===== STEP 1: Basic Information + Address ===== */}
            {step === 1 && (
              <>
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter donor name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (Optional)</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="donor@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone (10 digits)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="9876543210"
                              maxLength={10}
                              {...field}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Donor Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="individual">Individual</SelectItem>
                              <SelectItem value="corporate">Corporate</SelectItem>
                              <SelectItem value="foundation">Foundation</SelectItem>
                              <SelectItem value="trust">Trust</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Address Information</h3>
                  <FormField
                    control={form.control}
                    name="address.street"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="House/Building, Street, Locality..."
                            className="min-h-[80px] resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="address.city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City / Town (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address.state"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>State</FormLabel>
                          <Popover open={stateOpen} onOpenChange={setStateOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={stateOpen}
                                  className={cn(
                                    "w-full justify-between font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value || "Select state"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[250px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search state..." />
                                <CommandList>
                                  <CommandEmpty>No state found.</CommandEmpty>
                                  <CommandGroup>
                                    {INDIAN_STATES.map((state) => (
                                      <CommandItem
                                        key={state}
                                        value={state}
                                        onSelect={() => {
                                          field.onChange(state);
                                          setStateOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === state ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {state}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="address.pincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pincode (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="6-digit pincode" maxLength={6} {...field} onChange={(e) => { field.onChange(e.target.value.replace(/\D/g, '')); }} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Country:</span>
                    <Badge variant="secondary">India</Badge>
                  </div>
                </div>
              </>
            )}

            {/* ===== STEP 2: Donation Preferences + Communication + Tax + Tags + Notes ===== */}
            {step === 2 && (
              <>
                {/* Donation Preferences */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Donation Preferences</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="donationPreferences.frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Donation Frequency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="one-time">One-time</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="half_yearly">Half-Yearly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="donationPreferences.preferredAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Amount (₹)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g. 5000"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="donationPreferences.preferredMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="upi">UPI</SelectItem>
                              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="cheque">Cheque</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {form.watch('donationPreferences.frequency') === 'custom' && (
                    <FormField
                      control={form.control}
                      name="donationPreferences.customIntervalDays"
                      render={({ field }) => (
                        <FormItem className="max-w-[200px]">
                          <FormLabel>Custom Interval (Days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="e.g. 45"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Communication Preferences */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Communication Preferences</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="preferences.communicationMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Communication Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                              <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="preferences.anonymousGiving"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Anonymous Giving Preference</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              Donor prefers to remain anonymous in public acknowledgments
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Tax Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Tax Information</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="taxInfo.panNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="XXXXXXXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="taxInfo.gstNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GST Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="XXXXXXXXXXXXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Tags</h3>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" onClick={addTag} variant="outline">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.watch('tags').map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Textarea
                            placeholder="Additional notes about the donor"
                            className="min-h-[100px] pr-12"
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
              </>
            )}

            {/* Footer with step-aware buttons */}
            <DialogFooter className="gap-2 sm:gap-0">
              {step === 1 ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : mode === "create" ? "Add Donor" : "Save Changes"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
