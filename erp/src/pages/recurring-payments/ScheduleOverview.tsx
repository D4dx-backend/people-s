import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { getUpcomingPayments, getOverduePayments, RecurringPayment } from '@/services/recurringPaymentService';
import { Calendar, DollarSign, AlertCircle, ArrowLeft, Eye, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const ScheduleOverview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [upcomingPayments, setUpcomingPayments] = useState<RecurringPayment[]>([]);
  const [overduePayments, setOverduePayments] = useState<RecurringPayment[]>([]);
  const [timeframe, setTimeframe] = useState(30); // Days

  useEffect(() => {
    loadData();
  }, [timeframe]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [upcoming, overdue] = await Promise.all([
        getUpcomingPayments(timeframe),
        getOverduePayments(),
      ]);
      setUpcomingPayments(Array.isArray(upcoming.payments) ? upcoming.payments : []);
      setOverduePayments(Array.isArray(overdue.payments) ? overdue.payments : []);
    } catch (error) {
      console.error('Error loading schedule data:', error);
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
    scheduled: "bg-info/10 text-info border-info/20",
    due: "bg-warning/10 text-warning border-warning/20",
    overdue: "bg-destructive/10 text-destructive border-destructive/20",
    completed: "bg-success/10 text-success border-success/20",
    processing: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  const getStatusBadge = (payment: RecurringPayment) => {
    const status = payment.status;
    return (
      <Badge variant="outline" className={statusColors[status as keyof typeof statusColors] || "bg-muted text-muted-foreground"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const calculateDaysUntil = (date: string) => {
    const targetDate = new Date(date);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading payment schedule...</p>
        </div>
      </div>
    );
  }

  const totalUpcoming = upcomingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalOverdue = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Payment Schedule</h1>
          <p className="text-muted-foreground">Quick view of upcoming and overdue payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/recurring-payments/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/recurring-payments/forecast')}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Forecast
          </Button>
        </div>
      </div>

      {/* Timeframe Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Timeframe</CardTitle>
          <CardDescription>Select the number of days to look ahead for upcoming payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {[7, 15, 30, 60, 90].map((days) => (
              <Button
                key={days}
                variant={timeframe === days ? 'default' : 'outline'}
                onClick={() => setTimeframe(days)}
                size="sm"
              >
                {days} Days
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Payments</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overduePayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {formatCurrency(totalOverdue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming ({timeframe} days)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingPayments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {formatCurrency(totalUpcoming)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalOverdue + totalUpcoming)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Combined overdue and upcoming
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Payments */}
      {overduePayments.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Overdue Payments ({overduePayments.length})
            </CardTitle>
            <CardDescription>These payments are past their due date and require immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overduePayments.map((payment) => {
                const daysOverdue = Math.abs(calculateDaysUntil(payment.scheduledDate));
                return (
                  <div
                    key={payment._id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-destructive/5 rounded-lg border border-destructive/20 hover:shadow-elegant transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-sm">
                          {payment.application?.applicationNumber || 'N/A'}
                        </h4>
                        {getStatusBadge(payment)}
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                          {daysOverdue} days overdue
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Beneficiary:</span>
                          <p className="font-medium">{payment.beneficiary?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Scheme:</span>
                          <p className="font-medium">{payment.scheme?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <p className="font-bold text-destructive">{formatCurrency(payment.amount || 0)}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Due: {format(new Date(payment.scheduledDate), 'dd MMM yyyy')}
                        {payment.description && ` • ${payment.description}`}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/recurring-payments/schedule/${payment.application?._id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Payments ({upcomingPayments.length})
          </CardTitle>
          <CardDescription>Payments scheduled within the next {timeframe} days</CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming payments in the next {timeframe} days</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingPayments.map((payment) => {
                const daysUntil = calculateDaysUntil(payment.scheduledDate);
                const isUrgent = daysUntil <= 7;
                return (
                  <div
                    key={payment._id}
                    className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border transition-shadow hover:shadow-elegant ${
                      isUrgent ? 'bg-warning/5 border-warning/20' : 'bg-card border-border'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-sm">
                          {payment.application?.applicationNumber || 'N/A'}
                        </h4>
                        {getStatusBadge(payment)}
                        {isUrgent && (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                            Due in {daysUntil} days
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Beneficiary:</span>
                          <p className="font-medium">{payment.beneficiary?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Scheme:</span>
                          <p className="font-medium">{payment.scheme?.name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <p className="font-bold">{formatCurrency(payment.amount || 0)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Payment:</span>
                          <p className="font-medium">
                            {payment.paymentNumber} of {payment.totalPayments}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Scheduled: {format(new Date(payment.scheduledDate), 'dd MMM yyyy')}
                        {payment.description && ` • ${payment.description}`}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/recurring-payments/schedule/${payment.application?._id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleOverview;
