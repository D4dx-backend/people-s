import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import VoiceTextarea from '@/components/ui/VoiceTextarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projects, schemes } from '@/lib/api';
import { useRecordDonation } from '@/hooks/useDonors';
import { toast } from '@/hooks/use-toast';

const donationSchema = z.object({
  amount: z.number().min(1, 'Amount must be greater than 0'),
  date: z.date(),
  purpose: z.enum(['project', 'scheme']),
  purposeId: z.string().min(1, 'Please select a project or scheme'),
  method: z.enum(['cash', 'cheque', 'online', 'bank_transfer', 'upi']),
  mode: z.enum(['one-time', 'monthly', 'quarterly', 'yearly']),
  receiptNumber: z.string().optional(),
  notes: z.string().optional(),
});

interface DonationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donor: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  } | null;
  isAnonymous?: boolean;
}

export function DonationModal({ open, onOpenChange, donor, isAnonymous = false }: DonationModalProps) {
  const [purposeOptions, setPurposeOptions] = useState<Array<{ id: string; name: string }>>([]);
  const recordDonation = useRecordDonation();

  const form = useForm({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      amount: 0,
      date: new Date(),
      purpose: 'project' as const,
      purposeId: '',
      method: 'cash' as const,
      mode: 'one-time' as const,
      receiptNumber: '',
      notes: '',
    },
  });

  const purpose = form.watch('purpose');

  // Fetch projects
  const { data: projectsData } = useQuery({
    queryKey: ['projects', { status: 'active' }],
    queryFn: () => projects.getAll({ status: 'active', limit: 100 }),
  });

  // Fetch schemes
  const { data: schemesData } = useQuery({
    queryKey: ['schemes', { status: 'active' }],
    queryFn: () => schemes.getAll({ status: 'active', limit: 100 }),
  });

  // Update purpose options when purpose type changes
  useEffect(() => {
    if (purpose === 'project' && projectsData?.data?.projects) {
      setPurposeOptions(
        projectsData.data.projects.map(p => ({ id: p.id, name: p.name }))
      );
    } else if (purpose === 'scheme' && schemesData?.data?.schemes) {
      setPurposeOptions(
        schemesData.data.schemes.map(s => ({ id: s.id, name: s.name }))
      );
    }
    // Reset purposeId when purpose type changes
    form.setValue('purposeId', '');
  }, [purpose, projectsData, schemesData, form]);

  const onSubmit = async (data: any) => {
    const donationData = {
      donorId: donor?.id || null,
      amount: data.amount,
      date: data.date.toISOString(),
      purpose: data.purpose,
      purposeId: data.purposeId,
      method: data.method,
      mode: data.mode,
      receiptNumber: data.receiptNumber,
      notes: data.notes,
      isAnonymous,
    };

    await recordDonation.mutateAsync(donationData);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Donation</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {isAnonymous ? (
              "Recording anonymous donation"
            ) : donor ? (
              <>Recording donation for: <strong>{donor.name}</strong> ({donor.phone})</>
            ) : (
              "Recording donation"
            )}
          </p>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter amount" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Donation Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select purpose type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="project">Project</SelectItem>
                        <SelectItem value="scheme">Scheme</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purposeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {purpose === 'project' ? 'Select Project' : 'Select Scheme'}
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${purpose}`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {purposeOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="online">Online Payment</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Donation Mode</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select donation mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="one-time">One-time</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="receiptNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt Number (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter receipt number if available" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <VoiceTextarea 
                      placeholder="Additional notes about the donation"
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={recordDonation.isPending}>
                {recordDonation.isPending ? 'Recording...' : 'Record Donation'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}