import { useState } from "react";
import { Loader2, Heart, User, Phone, Mail, IndianRupee } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { donors, donations } from "@/lib/api";

interface QuickDonationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface QuickDonationData {
  // Donor Information (minimal)
  name: string;
  phone: string;
  email?: string;
  
  // Donation Information
  amount: number;
  method: string;
  purpose?: string;
  notes?: string;
  
  // Preferences
  anonymousDonation: boolean;
  communicationConsent: boolean;
}

export function QuickDonationModal({ 
  open, 
  onOpenChange, 
  onSuccess 
}: QuickDonationModalProps) {
  const [formData, setFormData] = useState<QuickDonationData>({
    name: '',
    phone: '',
    email: '',
    amount: 0,
    method: 'upi',
    purpose: '',
    notes: '',
    anonymousDonation: false,
    communicationConsent: true,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof QuickDonationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[+]?[\d\s\-()]{10,15}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Please enter a valid donation amount';
    }
    
    if (!formData.method) {
      newErrors.method = 'Please select a payment method';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      // Prepare donor data with minimal required fields
      const donorData = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email?.trim() || `${formData.phone}@donor.temp`, // Temporary email if not provided
        type: 'individual' as const,
        category: 'regular' as const,
        
        // Address - minimal structure
        address: {
          street: '',
          city: '',
          state: '',
          pincode: '',
          country: 'India'
        },
        
        // Donation preferences
        donationPreferences: {
          frequency: 'one-time' as const,
          preferredMethod: formData.method as any,
          anonymousDonation: formData.anonymousDonation
        },
        
        // Communication preferences
        communicationPreferences: {
          email: formData.communicationConsent && !!formData.email,
          sms: formData.communicationConsent,
          whatsapp: false,
          newsletter: formData.communicationConsent,
          donationReceipts: true
        },
        
        // Status
        status: 'active' as const,
        
        // Notes
        notes: formData.notes || `Quick donation: ₹${formData.amount} via ${formData.method}${formData.purpose ? ` for ${formData.purpose}` : ''}`
      };
      
      // Step 1: Create or find donor
      let donorId: string | null = null;
      try {
        const donorResponse = await donors.create(donorData);
        if (donorResponse.success && donorResponse.data) {
          donorId = donorResponse.data.donor?._id || donorResponse.data.donor?.id || donorResponse.data._id || donorResponse.data.id;
        }
      } catch (donorError: any) {
        // If donor already exists, that's okay — try to continue
        if (!donorError.message?.includes('already exists')) {
          throw donorError;
        }
      }

      // Step 2: Create the actual donation record
      const donationData = {
        donor: donorId,
        donorId: donorId,
        amount: formData.amount,
        method: formData.method,
        notes: formData.notes || '',
        isAnonymous: formData.anonymousDonation,
        purpose: formData.purpose || undefined,
      };

      try {
        const donationResponse = await donations.create(donationData);
        
        if (donationResponse.success) {
          toast({
            title: "Success",
            description: `Donation of ₹${formData.amount} recorded successfully!`,
          });
        } else {
          // Donation creation failed but donor was created
          toast({
            title: "Partial Success",
            description: "Donor saved but donation record could not be created. Please add the donation manually.",
            variant: "default",
          });
        }
      } catch (donationError: any) {
        // Donor was created but donation failed
        console.error('Donation creation failed:', donationError);
        toast({
          title: "Partial Success",
          description: "Donor saved but donation record could not be created. Please add the donation manually.",
          variant: "default",
        });
      }
      
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        email: '',
        amount: 0,
        method: 'upi',
        purpose: '',
        notes: '',
        anonymousDonation: false,
        communicationConsent: true,
      });
    } catch (error: any) {
      console.error('Quick donation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save donation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Quick Donation
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Capture minimal donor information for quick donation processing
          </p>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Donor Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Donor Information
            </h4>
            
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter donor's full name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter phone number"
                  className={`pl-10 ${errors.phone ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="email">Email (Optional)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                  className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email}</p>
              )}
            </div>
          </div>
          
          {/* Donation Information */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Donation Details
            </h4>
            
            <div>
              <Label htmlFor="amount">Donation Amount *</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  value={formData.amount || ''}
                  onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                  placeholder="Enter amount"
                  className={`pl-10 ${errors.amount ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.amount && (
                <p className="text-sm text-red-500 mt-1">{errors.amount}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="method">Payment Method *</Label>
              <Select
                value={formData.method}
                onValueChange={(value) => handleInputChange('method', value)}
              >
                <SelectTrigger className={errors.method ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
              {errors.method && (
                <p className="text-sm text-red-500 mt-1">{errors.method}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="purpose">Purpose (Optional)</Label>
              <Input
                id="purpose"
                value={formData.purpose}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
                placeholder="e.g., Education, Healthcare, Emergency Relief"
              />
            </div>
            
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional notes about the donation"
                rows={2}
              />
            </div>
          </div>
          
          {/* Preferences */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="anonymous"
                checked={formData.anonymousDonation}
                onCheckedChange={(checked) => 
                  handleInputChange('anonymousDonation', checked)
                }
              />
              <Label htmlFor="anonymous" className="text-sm">
                Make this an anonymous donation
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="communication"
                checked={formData.communicationConsent}
                onCheckedChange={(checked) => 
                  handleInputChange('communicationConsent', checked)
                }
              />
              <Label htmlFor="communication" className="text-sm">
                I consent to receive updates about programs and impact
              </Label>
            </div>
          </div>
        </form>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading}
            className="bg-gradient-primary"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Donor & Donation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}