import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { getUpcomingPayments, getOverduePayments, RecurringPayment } from '@/services/recurringPaymentService';
import { Calendar, DollarSign, AlertCircle, ArrowLeft, Eye, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ScheduleOverview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [upcomingPayments, setUpcomingPayments] = useState<RecurringPayment[]>([]);
  const [overduePayments, setOverduePayments] = useState<RecurringPayment[]>([]);
  const [timeframe, setTimeframe] = useState(30);

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
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    due: "bg-yellow-50 text-yellow-700 border-yellow-200",
    overdue: "bg-red-50 text-red-700 border-red-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    processing: "bg-purple-50 text-purple-700 border-purple-200",
  };

  const calculateDaysUntil = (date: string) => {
    const targetDate = new Date(date);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/recurring-payments/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payment Schedule</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(timeframe)} onValueChange={(v) => setTimeframe(Number(v))}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              {[7, 15, 30, 60, 90].map((days) => (
                <SelectItem key={days} value={String(days)}>Next {days} Days</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/recurring-payments/forecast')}
            className="h-8"
          >
            <TrendingUp className="mr-2 h-3 w-3" />
            Forecast
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-destructive">{overduePayments.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalOverdue)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{upcomingPayments.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalUpcoming)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium">Total Liability</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">
              {formatCurrency(totalOverdue + totalUpcoming)}
            </div>
            <p className="text-xs text-muted-foreground">
              Overdue + Upcoming
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Payments */}
      {overduePayments.length > 0 && (
        <Card className="border-destructive/20 shadow-sm">
          <CardHeader className="p-4 pb-2 bg-destructive/5 rounded-t-lg">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Overdue Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="h-8 hover:bg-transparent">
                  <TableHead className="h-8 text-xs w-[100px]">App #</TableHead>
                  <TableHead className="h-8 text-xs">Beneficiary</TableHead>
                  <TableHead className="h-8 text-xs">Due Date</TableHead>
                  <TableHead className="h-8 text-xs">Amount</TableHead>
                  <TableHead className="h-8 text-xs w-[100px] text-right">Overdue By</TableHead>
                  <TableHead className="h-8 text-xs w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overduePayments.map((payment) => {
                  const daysOverdue = Math.abs(calculateDaysUntil(payment.scheduledDate));
                  return (
                    <TableRow key={payment._id} className="h-10 hover:bg-destructive/5">
                      <TableCell className="font-medium text-xs">{payment.application?.applicationNumber}</TableCell>
                      <TableCell className="text-xs py-1">
                        <div className="font-medium">{payment.beneficiary?.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{payment.scheme?.name}</div>
                      </TableCell>
                      <TableCell className="text-xs py-1 text-destructive font-medium">
                        {format(new Date(payment.scheduledDate), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-xs py-1 font-bold">
                        {formatCurrency(payment.amount || 0)}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-right">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/20 text-destructive bg-white">
                          {daysOverdue}d
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1">
                         <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/recurring-payments/schedule/${payment.application?._id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Payments */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming Payments
          </CardTitle>
          <CardDescription className="text-xs">Next {timeframe} days</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="h-8 hover:bg-transparent">
                <TableHead className="h-8 text-xs w-[100px]">App #</TableHead>
                <TableHead className="h-8 text-xs">Beneficiary</TableHead>
                <TableHead className="h-8 text-xs">Scheduled</TableHead>
                <TableHead className="h-8 text-xs">Amount</TableHead>
                <TableHead className="h-8 text-xs">Inst.</TableHead>
                <TableHead className="h-8 text-xs text-right">Status</TableHead>
                <TableHead className="h-8 text-xs w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                    No upcoming payments in this period
                  </TableCell>
                </TableRow>
              ) : (
                upcomingPayments.map((payment) => {
                  const daysUntil = calculateDaysUntil(payment.scheduledDate);
                  const isUrgent = daysUntil <= 7;
                  return (
                    <TableRow key={payment._id} className="h-10">
                      <TableCell className="font-medium text-xs">{payment.application?.applicationNumber}</TableCell>
                      <TableCell className="text-xs py-1">
                        <div className="font-medium truncate max-w-[150px]">{payment.beneficiary?.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{payment.scheme?.name}</div>
                      </TableCell>
                      <TableCell className="text-xs py-1">
                        <div className={isUrgent ? "text-orange-600 font-medium" : ""}>
                          {format(new Date(payment.scheduledDate), 'dd MMM yyyy')}
                        </div>
                        {isUrgent && <div className="text-[10px] text-orange-600">in {daysUntil} days</div>}
                      </TableCell>
                      <TableCell className="text-xs py-1 font-medium">
                        {formatCurrency(payment.amount || 0)}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-muted-foreground">
                        {payment.paymentNumber}/{payment.totalPayments}
                      </TableCell>
                      <TableCell className="text-xs py-1 text-right">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[payment.status as keyof typeof statusColors] || "bg-gray-50 text-gray-600"}`}>
                          {payment.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => navigate(`/recurring-payments/schedule/${payment.application?._id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleOverview;
