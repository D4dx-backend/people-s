import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getRecurringApplications, DashboardStats, RecurringApplication } from '@/services/recurringPaymentService';
import { Calendar, DollarSign, AlertCircle, CheckCircle, TrendingUp, Eye, Filter, Loader2, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';import { useApplicationFilters } from '@/hooks/useApplicationFilters';
import { GenericFilters } from '@/components/filters/GenericFilters';
const RecurringPaymentsDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [applications, setApplications] = useState<RecurringApplication[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const filterHook = useApplicationFilters();

  useEffect(() => {
    loadData();
  }, [
    filterHook.filters.searchTerm,
    filterHook.filters.projectFilter,
    filterHook.filters.schemeFilter,
    filterHook.filters.statusFilter,
    filterHook.filters.districtFilter,
    filterHook.filters.areaFilter,
    filterHook.filters.unitFilter,
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const filters = {
        search: filterHook.filters.searchTerm || undefined,
        project: filterHook.filters.projectFilter !== 'all' ? filterHook.filters.projectFilter : undefined,
        scheme: filterHook.filters.schemeFilter !== 'all' ? filterHook.filters.schemeFilter : undefined,
        status: filterHook.filters.statusFilter !== 'all' ? filterHook.filters.statusFilter : undefined,
        district: filterHook.filters.districtFilter !== 'all' ? filterHook.filters.districtFilter : undefined,
        area: filterHook.filters.areaFilter !== 'all' ? filterHook.filters.areaFilter : undefined,
        unit: filterHook.filters.unitFilter !== 'all' ? filterHook.filters.unitFilter : undefined,
      };
      const [statsData, appsData] = await Promise.all([
        getDashboardStats(filters),
        getRecurringApplications(filters),
      ]);
      setStats(statsData);
      setApplications(appsData.applications);
    } catch (error) {
      console.error('Error loading recurring payments data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statusColors = {
    active: "bg-success/10 text-success border-success/20",
    paused: "bg-warning/10 text-warning border-warning/20",
    completed: "bg-info/10 text-info border-info/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case 'monthly':
        return 'Monthly';
      case 'quarterly':
        return 'Quarterly';
      case 'semi_annually':
        return 'Semi-Annually';
      case 'annually':
        return 'Annually';
      default:
        return period;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading recurring payments data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring Payments</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/recurring-payments/schedule')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/recurring-payments/forecast')}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Forecast
          </Button>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{stats.totalPayments}</div>
              <p className="text-xs text-muted-foreground">
                {stats.scheduled} scheduled, {stats.completed} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
              <p className="text-xs text-muted-foreground">
                Require attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming (30d)</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{stats.upcoming.next30Days}</div>
              <p className="text-xs text-muted-foreground">
                {stats.upcoming.next7Days} in next 7 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold">{formatCurrency(stats.amounts.total)}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.amounts.pending)} pending
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <GenericFilters
          searchTerm={filterHook.filters.searchTerm}
          onSearchChange={filterHook.setSearchTerm}
          searchPlaceholder="Search by beneficiary name or application #..."
          showStatusFilter={true}
          statusFilter={filterHook.filters.statusFilter}
          onStatusChange={filterHook.setStatusFilter}
          statusOptions={[
            { value: 'all', label: 'All Statuses' },
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          showProjectFilter={true}
          projectFilter={filterHook.filters.projectFilter}
          onProjectChange={filterHook.setProjectFilter}
          projectOptions={filterHook.dropdownOptions.projectOptions}
          showSchemeFilter={true}
          schemeFilter={filterHook.filters.schemeFilter}
          onSchemeChange={filterHook.setSchemeFilter}
          schemeOptions={filterHook.dropdownOptions.schemeOptions}
          showDistrictFilter={true}
          districtFilter={filterHook.filters.districtFilter}
          onDistrictChange={filterHook.setDistrictFilter}
          districtOptions={filterHook.dropdownOptions.districtOptions}
          showAreaFilter={true}
          areaFilter={filterHook.filters.areaFilter}
          onAreaChange={filterHook.setAreaFilter}
          areaOptions={filterHook.dropdownOptions.areaOptions}
          showUnitFilter={true}
          unitFilter={filterHook.filters.unitFilter}
          onUnitChange={filterHook.setUnitFilter}
          unitOptions={filterHook.dropdownOptions.unitOptions}
          showDateFilters={false}
          onClearFilters={filterHook.clearAllFilters}
        />
      )}

      {/* Applications Table */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Recurring Applications</CardTitle>
          <CardDescription className="text-xs">
            {applications.length} found
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-10 hover:bg-transparent">
                  <TableHead className="h-10 w-[120px]">App #</TableHead>
                  <TableHead className="h-10">Beneficiary</TableHead>
                  <TableHead className="h-10">Scheme</TableHead>
                  <TableHead className="h-10">Period</TableHead>
                  <TableHead className="h-10 w-[200px]">Progress</TableHead>
                  <TableHead className="h-10">Next</TableHead>
                  <TableHead className="h-10">Status</TableHead>
                  <TableHead className="h-10 w-[80px]">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <CalendarClock className="h-8 w-8 text-muted-foreground opacity-50" />
                        <p className="text-sm text-muted-foreground">No recurring applications</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow key={app._id} className="h-12">
                      <TableCell className="font-medium text-xs">
                        {app.applicationNumber}
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        <div className="font-medium truncate max-w-[150px]">{app.beneficiary?.name || 'N/A'}</div>
                      </TableCell>
                      <TableCell className="text-xs py-2">{app.scheme?.name || 'N/A'}</TableCell>
                      <TableCell className="text-xs py-2">
                        {getPeriodLabel(app.recurringConfig.period)}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="text-xs w-8">
                            {Math.round((app.recurringConfig.completedPayments / app.recurringConfig.numberOfPayments) * 100)}%
                          </div>
                          <div className="flex-1 bg-secondary rounded-full h-1.5 w-24">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{
                                width: `${(app.recurringConfig.completedPayments / app.recurringConfig.numberOfPayments) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        {app.recurringConfig.nextPaymentDate
                          ? format(new Date(app.recurringConfig.nextPaymentDate), 'dd MMM yy')
                          : '-'}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[app.recurringConfig.status as keyof typeof statusColors] || "bg-muted text-muted-foreground"}`}>
                          {app.recurringConfig.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/recurring-payments/schedule/${app._id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Overdue Payments Alert */}
      {stats && stats.overdueList && stats.overdueList.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-destructive flex items-center text-sm">
              <AlertCircle className="h-4 w-4 mr-2" />
              Overdue Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {stats.overdueList.slice(0, 5).map((payment) => (
                <div key={payment._id} className="flex justify-between items-center p-2 bg-background/50 rounded-md border border-destructive/10">
                  <div className="text-xs">
                    <div className="font-medium">
                      {payment.application?.applicationNumber} <span className="text-muted-foreground mx-1">•</span> #{payment.paymentNumber}
                    </div>
                    <div className="text-muted-foreground">
                      {payment.beneficiary?.name} <span className="mx-1">•</span> {formatCurrency(payment.amount)}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className="text-xs text-destructive font-medium">
                      {payment.daysOverdue}d overdue
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2"
                      onClick={() => navigate(`/recurring-payments/payment/${payment._id}`)}
                    >
                      Pay
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RecurringPaymentsDashboard;
