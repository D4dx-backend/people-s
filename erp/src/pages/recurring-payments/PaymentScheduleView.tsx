import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getApplicationSchedule, recordPayment, RecurringPayment } from '@/services/recurringPaymentService';
import { format } from 'date-fns';
import { Calendar, CheckCircle, AlertCircle, XCircle, DollarSign, ArrowLeft, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import VoiceToTextButton from '@/components/ui/VoiceToTextButton';

const PaymentScheduleView = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [schedule, setSchedule] = useState<RecurringPayment[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<RecurringPayment | null>(null);
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'bank_transfer',
    transactionReference: '',
    notes: '',
  });

  useEffect(() => {
    if (applicationId) {
      loadSchedule();
    }
  }, [applicationId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const data = await getApplicationSchedule(applicationId!);
      setApplication(data.application);
      setSchedule(data.schedule);
      setSummary(data.summary);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = (payment: RecurringPayment) => {
    setSelectedPayment(payment);
    setPaymentForm({
      amount: payment.amount.toString(),
      method: 'bank_transfer',
      transactionReference: '',
      notes: '',
    });
    setShowRecordDialog(true);
  };

  const submitPayment = async () => {
    if (!selectedPayment) return;

    try {
      setRecordingPayment(true);
      await recordPayment(selectedPayment._id, {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method as any,
        transactionReference: paymentForm.transactionReference,
        notes: paymentForm.notes,
      });
      setShowRecordDialog(false);
      loadSchedule(); // Reload to get updated data
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    } finally {
      setRecordingPayment(false);
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
    cancelled: "bg-muted text-muted-foreground border-muted",
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'scheduled':
        return 'bg-info';
      case 'due':
        return 'bg-warning';
      case 'overdue':
        return 'bg-destructive';
      case 'cancelled':
        return 'bg-muted';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'overdue':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-muted-foreground" />;
      default:
        return <Calendar className="h-5 w-5 text-info" />;
    }
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

  if (!application) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Application not found or has no recurring payments.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Application Payment Schedule</h1>
            <p className="text-muted-foreground mt-1">
              {application.applicationNumber} - {application.beneficiary?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Application Info */}
      <Card>
        <CardHeader>
          <CardTitle>Application Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Scheme</div>
              <div className="font-medium">{application.scheme?.name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Recurring Period</div>
              <div className="font-medium capitalize">{application.recurringConfig?.period?.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Payments</div>
              <div className="font-medium">{application.recurringConfig?.numberOfPayments}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Amount Per Payment</div>
              <div className="font-medium">{formatCurrency(application.recurringConfig?.amountPerPayment)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{summary.completed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.scheduled}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{summary.overdue}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Timeline</CardTitle>
          <CardDescription>Track all scheduled and completed payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {schedule.map((payment, index) => (
              <div
                key={payment._id}
                className={`flex items-start gap-4 p-4 rounded-lg border hover:shadow-elegant transition-shadow ${
                  payment.status === 'overdue' ? 'border-destructive/20 bg-destructive/5' : 'border-border'
                }`}
              >
                <div className="flex-shrink-0 mt-1">{getStatusIcon(payment.status)}</div>
                
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">Payment #{payment.paymentNumber}</span>
                    <Badge variant="outline" className={statusColors[payment.status as keyof typeof statusColors] || "bg-muted text-muted-foreground"}>{payment.status.toUpperCase()}</Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>{payment.description}</div>
                    <div className="flex gap-4">
                      <span>
                        <strong>Amount:</strong> {formatCurrency(payment.amount)}
                      </span>
                      <span>
                        <strong>Scheduled:</strong> {format(new Date(payment.scheduledDate), 'dd MMM yyyy')}
                      </span>
                      {payment.actualPaymentDate && (
                        <span>
                          <strong>Paid:</strong> {format(new Date(payment.actualPaymentDate), 'dd MMM yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {payment.notes && (
                    <div className="mt-2 text-sm text-muted-foreground italic">{payment.notes}</div>
                  )}
                </div>
                
                <div className="flex-shrink-0">
                  {payment.status !== 'completed' && payment.status !== 'cancelled' && (
                    <Button
                      size="sm"
                      onClick={() => handleRecordPayment(payment)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Record Payment
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Recording payment #{selectedPayment?.paymentNumber} of {selectedPayment?.totalPayments}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                placeholder="Enter amount"
              />
            </div>

            <div>
              <Label htmlFor="method">Payment Method</Label>
              <Select
                value={paymentForm.method}
                onValueChange={(value) => setPaymentForm({ ...paymentForm, method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="digital_wallet">Digital Wallet</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reference">Transaction Reference</Label>
              <Input
                id="reference"
                value={paymentForm.transactionReference}
                onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                placeholder="Enter transaction reference number"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <div className="relative">
                <Textarea
                  id="notes"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  placeholder="Any additional notes"
                  rows={3}
                  className="pr-12"
                />
                <div className="absolute right-2 top-2">
                  <VoiceToTextButton
                    onTranscript={(text) => setPaymentForm(prev => ({ ...prev, notes: prev.notes ? prev.notes + ' ' + text : text }))}
                    size="icon"
                    className="h-8 w-8"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordDialog(false)} disabled={recordingPayment}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={recordingPayment}>
              {recordingPayment ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentScheduleView;
