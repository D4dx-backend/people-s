import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getBudgetForecast, BudgetForecast } from '@/services/recurringPaymentService';
import { ArrowLeft, TrendingUp, Download, Calendar, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

const BudgetForecastPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<BudgetForecast | null>(null);
  const [months, setMonths] = useState(12);
  const [filters, setFilters] = useState({
    scheme: '',
    project: '',
  });

  useEffect(() => {
    loadForecast();
  }, [months, filters]);

  const loadForecast = async () => {
    try {
      setLoading(true);
      const data = await getBudgetForecast(months, filters);
      setForecast(data.forecast);
    } catch (error) {
      console.error('Error loading forecast:', error);
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

  const exportToCSV = () => {
    if (!forecast) return;

    const csvContent = [
      ['Budget Forecast Report'],
      [''],
      ['Summary'],
      ['Total Amount', forecast.summary.totalAmount],
      ['Total Payments', forecast.summary.totalPayments],
      ['Overdue Amount', forecast.summary.overdueAmount],
      ['Overdue Payments', forecast.summary.overduePayments],
      ['Average Payment', forecast.summary.averagePayment],
      [''],
      ['Monthly Forecast'],
      ['Month', 'Total Amount', 'Payment Count', 'Overdue Count', 'Scheduled Count'],
      ...forecast.monthlyForecast.map((m) => [
        m.month,
        m.totalAmount,
        m.paymentCount,
        m.overdueCount,
        m.scheduledCount,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-forecast-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading budget forecast...</p>
        </div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Budget Forecast</h1>
              <p className="text-muted-foreground mt-1">Projected recurring payment expenses</p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrendingUp className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Forecast Data Available</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              There are currently no recurring payment applications to generate a forecast. 
              Create recurring payment schedules to see budget projections.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/recurring-payments/dashboard')}>
                <Calendar className="mr-2 h-4 w-4" />
                View Dashboard
              </Button>
              <Button variant="outline" onClick={() => navigate('/applications')}>
                View Applications
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Budget Forecast</h1>
            <p className="text-muted-foreground mt-1">Projected recurring payment expenses</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={months.toString()} onValueChange={(val) => setMonths(parseInt(val))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Months</SelectItem>
              <SelectItem value="6">6 Months</SelectItem>
              <SelectItem value="12">12 Months</SelectItem>
              <SelectItem value="24">24 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(forecast.summary.totalAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">{forecast.summary.totalPayments} payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Payment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(forecast.summary.averagePayment)}</div>
            <p className="text-xs text-muted-foreground mt-1">Per payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(forecast.summary.overdueAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">{forecast.summary.overduePayments} payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Average</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(forecast.summary.totalAmount / forecast.monthlyForecast.length)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Payment Forecast</CardTitle>
          <CardDescription>Projected payments for the next {months} months</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={forecast.monthlyForecast}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelStyle={{ color: '#000' }}
              />
              <Legend />
              <Bar dataKey="totalAmount" fill="#0088FE" name="Total Amount" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Payment Count Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Count Trend</CardTitle>
          <CardDescription>Number of payments scheduled per month</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecast.monthlyForecast}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip labelStyle={{ color: '#000' }} />
              <Legend />
              <Line type="monotone" dataKey="paymentCount" stroke="#8884d8" name="Total Payments" />
              <Line type="monotone" dataKey="scheduledCount" stroke="#82ca9d" name="Scheduled" />
              <Line type="monotone" dataKey="overdueCount" stroke="#ff6b6b" name="Overdue" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scheme Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by Scheme</CardTitle>
            <CardDescription>Distribution of payments across schemes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={forecast.schemeBreakdown}
                  dataKey="totalAmount"
                  nameKey="scheme"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.scheme}: ${formatCurrency(entry.totalAmount)}`}
                >
                  {forecast.schemeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Project Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by Project</CardTitle>
            <CardDescription>Distribution of payments across projects</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={forecast.projectBreakdown}
                  dataKey="totalAmount"
                  nameKey="project"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.project}: ${formatCurrency(entry.totalAmount)}`}
                >
                  {forecast.projectBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scheme Details */}
        <Card>
          <CardHeader>
            <CardTitle>Scheme Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {forecast.schemeBreakdown.map((scheme, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg hover:shadow-elegant transition-shadow">
                  <div>
                    <div className="font-medium">{scheme.scheme}</div>
                    <div className="text-sm text-muted-foreground">{scheme.count} payments</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(scheme.totalAmount)}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(scheme.totalAmount / scheme.count)}/payment
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {forecast.projectBreakdown.map((project, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg hover:shadow-elegant transition-shadow">
                  <div>
                    <div className="font-medium">{project.project}</div>
                    <div className="text-sm text-muted-foreground">{project.count} payments</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(project.totalAmount)}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(project.totalAmount / project.count)}/payment
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BudgetForecastPage;
