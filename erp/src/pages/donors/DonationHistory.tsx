import { useState } from "react";
import { History, Calendar, IndianRupee, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useDonationHistory } from "@/hooks/useDonations";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/common/ExportButton";
import { donationExportColumns } from "@/utils/exportColumns";
import { donations as donationsApi } from "@/lib/api";

export default function DonationHistory() {
  const [filters, setFilters] = useState({
    search: '',
    method: 'all',
    purpose: 'all',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 10,
  });

  // Use donation history hook for paginated data
  const { data: donationHistory, isLoading } = useDonationHistory(filters);

  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => donationsApi.export(params),
    filenamePrefix: 'donations',
    pdfTitle: 'Donation History Report',
    pdfColumns: donationExportColumns,
    getFilterParams: () => ({
      search: filters.search || undefined,
      method: filters.method !== 'all' ? filters.method : undefined,
      purpose: filters.purpose !== 'all' ? filters.purpose : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    // Convert "all" back to empty string for API
    const filterValue = value === "all" ? "" : value;
    setFilters(prev => ({
      ...prev,
      [key]: filterValue,
      page: 1, // Reset to first page when filtering
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Donation History</h1>
          <p className="text-muted-foreground mt-1">
            Complete history of all donations (anonymous and identified)
          </p>
        </div>
        <ExportButton
          onExportCSV={() => exportCSV()}
          onExportPDF={() => exportPDF()}
          onPrint={() => printData()}
          exporting={exporting}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Donations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Input
                placeholder="Search donations..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
            
            <Select
              value={filters.method || "all"}
              onValueChange={(value) => handleFilterChange('method', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.purpose || "all"}
              onValueChange={(value) => handleFilterChange('purpose', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Purpose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Purposes</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="scheme">Scheme</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => setFilters({
              search: '',
              method: 'all',
              purpose: 'all',
              dateFrom: '',
              dateTo: '',
              page: 1,
              limit: 10,
            })}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Donation History List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Donations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading donation history...</p>
            </div>
          ) : donationHistory?.donations?.length ? (
            <div className="space-y-4">
              {(donationHistory?.donations || []).map((donation) => (
                <div key={donation.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-full">
                        <IndianRupee className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {donation.donor?.name || 'Anonymous Donor'}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(donation.createdAt).toLocaleDateString()}
                          </span>
                          <span>Method: {donation.method}</span>
                          <span>Purpose: {donation.purpose}</span>
                          {donation.donationNumber && <span>#{donation.donationNumber}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-600">
                        {formatCurrency(donation.amount)}
                      </p>
                      <Badge className={getStatusColor(donation.status)}>
                        {donation.status}
                      </Badge>
                    </div>
                  </div>
                  {donation.receiptNumber && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Receipt: {donation.receiptNumber}
                    </div>
                  )}
                  {donation.notes && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Notes: {donation.notes}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Pagination */}
              {donationHistory?.pagination && donationHistory.pagination.pages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((donationHistory.pagination.current - 1) * donationHistory.pagination.limit) + 1} to{' '}
                    {Math.min(donationHistory.pagination.current * donationHistory.pagination.limit, donationHistory.pagination.total)} of{' '}
                    {donationHistory.pagination.total} donations
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={donationHistory.pagination.current <= 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {donationHistory.pagination.current} of {donationHistory.pagination.pages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={donationHistory.pagination.current >= donationHistory.pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No donation history found</h3>
              <p className="text-muted-foreground">
                No donations match your current filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}