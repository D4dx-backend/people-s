import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  IndianRupee, 
  TrendingUp, 
  Award,
  Edit,
  MessageSquare,
  Download

} from 'lucide-react';
import { useDonor } from '@/hooks/useDonors';
import { Donor } from '@/types/donor';
import { useRBAC } from '@/hooks/useRBAC';

// Removed tanstack/react-table dependency

interface DonorDetailsProps {
  donorId: string;
  onEdit: (donor: Donor) => void;
}

export const DonorDetails: React.FC<DonorDetailsProps> = ({ donorId, onEdit }) => {
  const { hasPermission } = useRBAC();
  const { data: donorData, isLoading: donorLoading } = useDonor(donorId);




  if (donorLoading) {
    return <div>Loading donor details...</div>;
  }

  // Handle different response structures
  // API returns: { success: true, data: { donor, donationHistory } }
  // donorService.getById returns: { donor, donationHistory }
  // So donorData is: { donor, donationHistory }
  const donor = donorData?.donor || donorData?.data?.donor || donorData?.data;
  const donationHistoryArray = donorData?.donationHistory || donorData?.data?.donationHistory || [];
  
  if (!donor) {
    console.error('Donor not found. donorData:', donorData);
    console.error('Donor ID:', donorId);
    return <div>Donor not found</div>;
  }

  // Extract donation stats - use donationStats from donor model, or calculate from donationHistory array
  const donationStats = donor.donationStats || {};
  
  // Calculate stats from donationHistory array if available
  const calculatedTotalDonated = donationHistoryArray.length > 0 
    ? donationHistoryArray.reduce((sum: number, d: any) => sum + (d.amount || 0), 0)
    : 0;
  const calculatedDonationCount = donationHistoryArray.length;
  
  // Use stats from model if available, otherwise use calculated values
  const totalDonated = donationStats.totalDonated || calculatedTotalDonated || 0;
  const donationCount = donationStats.donationCount || calculatedDonationCount || 0;
  const averageDonation = donationStats.averageDonation || (donationCount > 0 ? totalDonated / donationCount : 0);
  
  // Get first and last donation dates
  const sortedHistory = [...donationHistoryArray].sort((a: any, b: any) => 
    new Date(a.createdAt || a.date || 0).getTime() - new Date(b.createdAt || b.date || 0).getTime()
  );
  const firstDonation = donationStats.firstDonation || (sortedHistory.length > 0 ? (sortedHistory[0]?.createdAt || sortedHistory[0]?.date) : null);
  const lastDonation = donationStats.lastDonation || (sortedHistory.length > 0 ? (sortedHistory[sortedHistory.length - 1]?.createdAt || sortedHistory[sortedHistory.length - 1]?.date) : null);
  const largestDonation = donationStats.largestDonation || (donationHistoryArray.length > 0 ? Math.max(...donationHistoryArray.map((d: any) => d.amount || 0)) : 0);

  // Ensure preferences object exists with defaults
  const preferences = donor.preferences || {
    communicationMethod: 'email',
    frequency: 'one-time',
    programs: [],
    anonymousGiving: false
  };

  // Ensure other nested objects exist with defaults
  const address = donor.address || {
    street: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India'
  };

  const taxInfo = donor.taxInfo || {
    panNumber: '',
    gstNumber: ''
  };

  const tags = donor.tags || [];
  const notes = donor.notes || '';

  // Ensure nested user objects exist with defaults
  const createdBy = donor.createdBy || { name: 'Unknown', email: '' };
  const updatedBy = donor.updatedBy || { name: 'Unknown', email: '' };
  const assignedTo = donor.assignedTo || null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'blocked':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending_verification':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'patron':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'major':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'recurring':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-lg">
              {getInitials(donor.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-lg font-bold">{donor.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={getCategoryColor(donor.category)}>
                {donor.category}
              </Badge>
              <Badge className={getStatusColor(donor.status)}>
                {donor.status.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {donor.type}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <MessageSquare className="mr-2 h-4 w-4" />
            Message
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          {hasPermission('donors.update') && (
            <Button onClick={() => onEdit(donor)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Donated</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(totalDonated)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Donations</p>
                <p className="text-2xl font-bold">{donationCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(averageDonation)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Donation</p>
                <p className="text-lg font-semibold">
                  {lastDonation 
                    ? new Date(lastDonation).toLocaleDateString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Donor Information */}
      <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{donor.email}</p>
                    <p className="text-sm text-muted-foreground">Email</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{donor.phone}</p>
                    <p className="text-sm text-muted-foreground">Phone</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium">
                      {address.street}, {address.city}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {address.state} {address.pincode}, {address.country}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">Communication Method</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {preferences.communicationMethod || 'email'}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Donation Frequency</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {(preferences.frequency || 'one-time').replace('_', ' ')}
                  </p>
                </div>
                {preferences.programs && preferences.programs.length > 0 && (
                  <div>
                    <p className="font-medium">Preferred Programs</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preferences.programs.map((program: string) => (
                        <Badge key={program} variant="secondary" className="text-xs">
                          {program}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {preferences.anonymousGiving && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Anonymous Giving</Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tax Information */}
            {(taxInfo.panNumber || taxInfo.gstNumber) && (
              <Card>
                <CardHeader>
                  <CardTitle>Tax Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {taxInfo.panNumber && (
                    <div>
                      <p className="font-medium">PAN Number</p>
                      <p className="text-sm text-muted-foreground">{taxInfo.panNumber}</p>
                    </div>
                  )}
                  {taxInfo.gstNumber && (
                    <div>
                      <p className="font-medium">GST Number</p>
                      <p className="text-sm text-muted-foreground">{taxInfo.gstNumber}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tags and Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tags.length > 0 && (
                  <div>
                    <p className="font-medium mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {notes && (
                  <div>
                    <p className="font-medium mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground">{notes}</p>
                  </div>
                )}
                <Separator />
                <div className="text-xs text-muted-foreground">
                  <p>Created: {donor.createdAt ? new Date(donor.createdAt).toLocaleString() : 'N/A'}</p>
                  <p>Updated: {donor.updatedAt ? new Date(donor.updatedAt).toLocaleString() : 'N/A'}</p>
                  <p>Created by: {createdBy.name || 'Unknown'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
};