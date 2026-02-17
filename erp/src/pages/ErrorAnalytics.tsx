import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRBAC } from '@/hooks/useRBAC';
import { useToast } from '@/hooks/use-toast';
import { errorLogService, ErrorStats } from '@/services/errorLogService';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingDown, Bug, AlertTriangle } from 'lucide-react';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
const SEVERITY_COLORS: Record<string, string> = { critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };

const ErrorAnalytics: React.FC = () => {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [groupedErrors, setGroupedErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(period));
        const params = { startDate: startDate.toISOString(), endDate: new Date().toISOString() };

        const [statsRes, groupedRes] = await Promise.all([
          errorLogService.getErrorStats(params),
          errorLogService.getGroupedErrors(),
        ]);

        setStats(statsRes.data);
        setGroupedErrors(groupedRes.data?.groups || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to fetch error analytics', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [period, toast]);

  if (!hasPermission('error_logs.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6"><p className="text-muted-foreground">You don't have permission to view error analytics.</p></Card>
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

  const byType = stats?.byType || [];
  const bySeverity = stats?.bySeverity || [];
  const byStatus = stats?.byStatus || [];
  const dailyTrends = stats?.dailyTrends || [];
  const topErrors = stats?.topErrors || [];

  const totalErrors = byType.reduce((sum: number, t: any) => sum + t.count, 0);
  const resolvedCount = byStatus.find((s: any) => s._id === true)?.count || 0;
  const openCount = byStatus.find((s: any) => s._id === false)?.count || 0;
  const criticalCount = bySeverity.find((s: any) => s._id === 'critical')?.count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Error Analytics</h1>
          <p className="text-muted-foreground mt-1">Monitor error trends, severity distribution, and resolution rates</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold">{totalErrors}</div>
            <p className="text-sm text-muted-foreground">Total Errors</p>
          </CardContent>
        </Card>
        <Card className={criticalCount > 0 ? 'border-red-300 bg-red-50/50 dark:bg-red-950/20' : ''}>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-sm text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-orange-500">{openCount}</div>
            <p className="text-sm text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-green-600">
              {totalErrors > 0 ? ((resolvedCount / totalErrors) * 100).toFixed(0) : 0}%
            </div>
            <p className="text-sm text-muted-foreground">Resolution Rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Error Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingDown className="h-4 w-4" /> Error Trends</CardTitle>
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
                  <Line type="monotone" dataKey="count" stroke="#ef4444" name="Errors" strokeWidth={2} />
                  <Line type="monotone" dataKey="uniqueErrors" stroke="#3b82f6" name="Unique Errors" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>

        {/* By Severity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Severity</CardTitle>
          </CardHeader>
          <CardContent>
            {bySeverity.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={bySeverity} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={100}
                    label={({ _id, percent }: any) => `${_id} ${(percent * 100).toFixed(0)}%`}>
                    {bySeverity.map((entry: any, i: number) => (
                      <Cell key={i} fill={SEVERITY_COLORS[entry._id] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bug className="h-4 w-4" /> By Error Type</CardTitle>
          </CardHeader>
          <CardContent>
            {byType.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byType}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" tickFormatter={(v: string) => v.replace(/_/g, ' ')} fontSize={10} angle={-20} />
                  <YAxis fontSize={12} />
                  <Tooltip labelFormatter={(v: string) => v.replace(/_/g, ' ')} />
                  <Bar dataKey="count" fill="#8b5cf6" name="Count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>

        {/* Resolution Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resolution Status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={byStatus.map((s: any) => ({ ...s, label: s._id ? 'Resolved' : 'Open' }))} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100}
                    label={({ label, percent }: any) => `${label} ${(percent * 100).toFixed(0)}%`}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground">No data available</p>}
          </CardContent>
        </Card>
      </div>

      {/* Top Recurring Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Top Recurring Errors</CardTitle>
        </CardHeader>
        <CardContent>
          {topErrors.length > 0 ? (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Error Message</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Occurrences</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topErrors.slice(0, 10).map((err: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="max-w-sm truncate text-sm">{err.message}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{err.errorType?.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell>
                      <Badge className={
                        err.severity === 'critical' ? 'bg-red-600 text-white' :
                        err.severity === 'high' ? 'bg-red-100 text-red-800' :
                        err.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }>{err.severity}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{err.occurrenceCount}x</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {err.lastOccurrence ? new Date(err.lastOccurrence).toLocaleDateString() : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : <p className="text-center py-8 text-muted-foreground">No recurring errors found</p>}
        </CardContent>
      </Card>

      {/* Grouped Errors */}
      {groupedErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grouped by Fingerprint</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Total Occurrences</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedErrors.slice(0, 15).map((grp: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{grp._id?.slice(0, 12)}...</TableCell>
                    <TableCell className="max-w-sm truncate text-sm">{grp.message}</TableCell>
                    <TableCell><Badge variant="secondary">{grp.totalOccurrences}x</Badge></TableCell>
                    <TableCell className="text-sm">{grp.lastSeen ? new Date(grp.lastSeen).toLocaleDateString() : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ErrorAnalytics;
