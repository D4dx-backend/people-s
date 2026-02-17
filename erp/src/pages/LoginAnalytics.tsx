import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRBAC } from '@/hooks/useRBAC';
import { useToast } from '@/hooks/use-toast';
import { loginLogService, LoginStats } from '@/services/loginLogService';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp, Smartphone, MapPin } from 'lucide-react';

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const LoginAnalytics: React.FC = () => {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [deviceBreakdown, setDeviceBreakdown] = useState<any[]>([]);
  const [locationBreakdown, setLocationBreakdown] = useState<any[]>([]);
  const [otpStats, setOtpStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        const params = { startDate: startDate.toISOString(), endDate: new Date().toISOString() };

        const [statsRes, deviceRes, locationRes, otpRes] = await Promise.all([
          loginLogService.getLoginStats(params),
          loginLogService.getDeviceBreakdown(params),
          loginLogService.getLocationBreakdown(params),
          loginLogService.getOTPStats(params),
        ]);

        setStats(statsRes.data);
        setDeviceBreakdown(deviceRes.data?.breakdown || []);
        setLocationBreakdown(locationRes.data?.breakdown || []);
        setOtpStats(otpRes.data);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch analytics', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [period, toast]);

  if (!hasPermission('login_logs.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6"><p className="text-muted-foreground">You don't have permission to view login analytics.</p></Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded" />)}</div>
        <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="h-64 bg-muted animate-pulse rounded" />)}</div>
      </div>
    );
  }

  const actionStats = stats?.actionStats || [];
  const statusOverview = stats?.statusOverview || [];
  const dailyTrends = stats?.dailyTrends || [];
  const hourlyDistribution = stats?.hourlyDistribution || [];

  const successCount = statusOverview.find((s: any) => s._id === 'success')?.count || 0;
  const failedCount = statusOverview.find((s: any) => s._id === 'failed')?.count || 0;
  const totalCount = successCount + failedCount;
  const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Login Analytics</h1>
          <p className="text-muted-foreground mt-1">Visual insights into login patterns and authentication trends</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold">{totalCount}</div>
            <p className="text-sm text-muted-foreground">Total Logins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-green-600">{successRate}%</div>
            <p className="text-sm text-muted-foreground">Success Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-red-600">{failedCount}</div>
            <p className="text-sm text-muted-foreground">Failed Attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-blue-600">{deviceBreakdown.length}</div>
            <p className="text-sm text-muted-foreground">Device Types</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Daily Login Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" tickFormatter={(v: string) => v.slice(5)} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} />
                  <Line type="monotone" dataKey="success" stroke="#22c55e" name="Success" strokeWidth={2} />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" name="Failed" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>

        {/* Actions Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {actionStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={actionStats} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={100} label={({ _id, percent }: any) => `${_id?.replace(/_/g, ' ')} ${(percent * 100).toFixed(0)}%`}>
                    {actionStats.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>

        {/* Hourly Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Peak Login Hours</CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={hourlyDistribution.sort((a: any, b: any) => a._id - b._id)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" tickFormatter={(v: number) => `${v}:00`} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip labelFormatter={(v: number) => `${v}:00 - ${v}:59`} />
                  <Bar dataKey="count" fill="#8b5cf6" name="Logins" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4" /> Device Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {deviceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={deviceBreakdown} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={100}
                    label={({ _id, percent }: any) => `${_id || 'Unknown'} ${(percent * 100).toFixed(0)}%`}>
                    {deviceBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>

        {/* Location Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Top Login Locations</CardTitle>
          </CardHeader>
          <CardContent>
            {locationBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={locationBreakdown.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="_id" fontSize={12} width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06b6d4" name="Logins" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>

        {/* OTP Stats */}
        {otpStats && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">OTP Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{otpStats.totalRequested || 0}</div>
                  <p className="text-xs text-muted-foreground">OTPs Requested</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{otpStats.totalVerified || 0}</div>
                  <p className="text-xs text-muted-foreground">OTPs Verified</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {otpStats.totalRequested > 0 ? ((otpStats.avgAttemptsBeforeSuccess || 0)).toFixed(1) : '0'}
                  </div>
                  <p className="text-xs text-muted-foreground">Avg Attempts</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{otpStats.totalResent || 0}</div>
                  <p className="text-xs text-muted-foreground">OTPs Resent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default LoginAnalytics;
