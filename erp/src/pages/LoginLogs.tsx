import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useRBAC } from '@/hooks/useRBAC';
import { useToast } from '@/hooks/use-toast';
import { loginLogService, LoginLog } from '@/services/loginLogService';
import { format } from 'date-fns';
import { Search, Download, RefreshCw, Eye, LogIn, Shield, Smartphone, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

const LoginLogs: React.FC = () => {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LoginLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    status: '',
    userType: '',
    startDate: '',
    endDate: ''
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loginLogService.getLoginLogs({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });
      setLogs(result.data?.logs || []);
      if (result.data?.pagination) {
        setPagination(prev => ({ ...prev, ...result.data.pagination }));
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch login logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Success</Badge>;
      case 'failed': return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    const actionColors: Record<string, string> = {
      login_success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      login_failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      otp_requested: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      otp_resent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      logout: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      token_refresh: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    };
    return <Badge className={actionColors[action] || 'bg-gray-100 text-gray-800'}>{action.replace(/_/g, ' ')}</Badge>;
  };

  const getUserTypeBadge = (userType: string) => {
    return userType === 'admin'
      ? <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">Admin</Badge>
      : <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400">Beneficiary</Badge>;
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      await loginLogService.exportLogs({ ...filters, format });
      toast({ title: 'Success', description: `Login logs exported as ${format.toUpperCase()}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to export logs', variant: 'destructive' });
    }
  };

  if (!hasPermission('login_logs.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6"><p className="text-muted-foreground">You don't have permission to view login logs.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><LogIn className="h-6 w-6" /> Login Logs</h1>
          <p className="text-muted-foreground mt-1">Monitor all login attempts, OTP requests, and authentication events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchLogs()}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}><Download className="h-4 w-4 mr-1" /> JSON</Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by phone, IP, location..." className="pl-9"
                value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} />
            </div>
            <Select value={filters.action} onValueChange={(v) => setFilters(f => ({ ...f, action: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="otp_requested">OTP Requested</SelectItem>
                <SelectItem value="otp_resent">OTP Resent</SelectItem>
                <SelectItem value="login_success">Login Success</SelectItem>
                <SelectItem value="login_failed">Login Failed</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="token_refresh">Token Refresh</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.userType} onValueChange={(v) => setFilters(f => ({ ...f, userType: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="User Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="beneficiary">Beneficiary</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{pagination.total}</div>
            <p className="text-sm text-muted-foreground">Total Events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-600">{logs.filter(l => l.status === 'success').length}</div>
            <p className="text-sm text-muted-foreground">Successful (page)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-red-600">{logs.filter(l => l.status === 'failed').length}</div>
            <p className="text-sm text-muted-foreground">Failed (page)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-blue-600">{new Set(logs.map(l => l.phone)).size}</div>
            <p className="text-sm text-muted-foreground">Unique Phones (page)</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Login Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (<div key={i} className="h-12 bg-muted animate-pulse rounded" />))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No login logs found matching your filters.</div>
          ) : (
            <>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User Type</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedLog(log); setShowDetail(true); }}>
                    <TableCell className="whitespace-nowrap text-sm">{format(new Date(log.timestamp), 'dd MMM yyyy HH:mm:ss')}</TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell>{getUserTypeBadge(log.userType)}</TableCell>
                    <TableCell className="font-mono text-sm">{log.phone}</TableCell>
                    <TableCell className="text-sm">{log.userId?.name || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Smartphone className="h-3 w-3" />
                        {log.device?.browser || '-'} / {log.device?.os || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3" />
                        {log.location?.city || log.location?.country || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); setShowDetail(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Login Event Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action</label>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User Type</label>
                  <div className="mt-1">{getUserTypeBadge(selectedLog.userType)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <div className="mt-1 font-mono">{selectedLog.phone}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User</label>
                  <div className="mt-1">{selectedLog.userId?.name || 'Unknown'}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <div className="mt-1">{format(new Date(selectedLog.timestamp), 'dd MMM yyyy HH:mm:ss')}</div>
                </div>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                <div className="mt-1 font-mono">{selectedLog.ipAddress}</div>
              </div>

              {selectedLog.failureReason && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Failure Reason</label>
                  <div className="mt-1">
                    <Badge variant="destructive">{selectedLog.failureReason.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              )}

              {selectedLog.device && (
                <>
                  <Separator />
                  <h4 className="text-sm font-semibold">Device Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Type:</span> {selectedLog.device.type || '-'}</div>
                    <div><span className="text-muted-foreground">OS:</span> {selectedLog.device.os} {selectedLog.device.osVersion}</div>
                    <div><span className="text-muted-foreground">Browser:</span> {selectedLog.device.browser} {selectedLog.device.browserVersion}</div>
                    <div><span className="text-muted-foreground">Model:</span> {selectedLog.device.deviceVendor} {selectedLog.device.deviceModel || '-'}</div>
                  </div>
                </>
              )}

              {selectedLog.location && (selectedLog.location.city || selectedLog.location.country) && (
                <>
                  <Separator />
                  <h4 className="text-sm font-semibold">Location</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Country:</span> {selectedLog.location.country || '-'}</div>
                    <div><span className="text-muted-foreground">Region:</span> {selectedLog.location.region || '-'}</div>
                    <div><span className="text-muted-foreground">City:</span> {selectedLog.location.city || '-'}</div>
                  </div>
                </>
              )}

              {selectedLog.otpDetails && (
                <>
                  <Separator />
                  <h4 className="text-sm font-semibold">OTP Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedLog.otpDetails.channel && <div><span className="text-muted-foreground">Channel:</span> {selectedLog.otpDetails.channel}</div>}
                    {selectedLog.otpDetails.purpose && <div><span className="text-muted-foreground">Purpose:</span> {selectedLog.otpDetails.purpose}</div>}
                    {selectedLog.otpDetails.requestedAt && <div><span className="text-muted-foreground">Requested:</span> {format(new Date(selectedLog.otpDetails.requestedAt), 'HH:mm:ss')}</div>}
                    {selectedLog.otpDetails.verifiedAt && <div><span className="text-muted-foreground">Verified:</span> {format(new Date(selectedLog.otpDetails.verifiedAt), 'HH:mm:ss')}</div>}
                  </div>
                </>
              )}

              {selectedLog.userAgent && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                    <div className="mt-1 text-xs font-mono bg-muted p-2 rounded break-all">{selectedLog.userAgent}</div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginLogs;
