import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Search, 
  Eye, 
  Activity,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useRBAC } from '@/hooks/useRBAC';
import { useToast } from '@/hooks/use-toast';
import { activityLogService, ActivityLog, ActivityLogFilters } from '@/services/activityLogService';
import { format } from 'date-fns';

const UserActivity: React.FC = () => {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState<ActivityLogFilters>({
    search: '',
    action: '',
    resource: '',
    status: '',
    severity: '',
    startDate: '',
    endDate: ''
  });
  const [filterOptions, setFilterOptions] = useState<{ actions: string[]; resources: string[] }>({ actions: [], resources: [] });

  const canViewLogs = hasPermission('activity_logs.read');

  const fetchLogs = useCallback(async () => {
    if (!canViewLogs) return;
    setLoading(true);
    try {
      const cleanFilters: Record<string, string | number> = {
        page: pagination.page,
        limit: 10,
      };
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') cleanFilters[key] = value;
      });

      const response = await activityLogService.getActivityLogs(cleanFilters as ActivityLogFilters);
      
      if (response.success && response.data) {
        setLogs(response.data.logs || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0,
          pages: response.data.pagination?.pages || 0
        }));
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch activity logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, filters, canViewLogs, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const response = await activityLogService.getFilterOptions();
        if (response.success && response.data) {
          setFilterOptions({
            actions: response.data.actions || [],
            resources: response.data.resources || []
          });
        }
      } catch {
        // Ignore filter option errors
      }
    };
    if (canViewLogs) fetchFilterOptions();
  }, [canViewLogs]);

  // Reset to page 1 when filters change
  const handleFilterChange = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value === 'all' ? '' : value }));
    setPagination(p => ({ ...p, page: 1 }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    };
    return <Badge className={colors[status] || colors.info}>{status}</Badge>;
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return <Badge className={colors[severity] || 'bg-gray-100 text-gray-800'}>{severity}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const roleColors: Record<string, string> = {
      super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      state_admin: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      district_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      area_admin: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
      unit_admin: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
      project_coordinator: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      scheme_coordinator: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      beneficiary: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return <Badge className={roleColors[role] || 'bg-gray-100 text-gray-800'}>{role?.replace(/_/g, ' ').toUpperCase()}</Badge>;
  };

  const formatAction = (action: string) => {
    return action?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleExport = async () => {
    try {
      await activityLogService.exportLogs({ ...filters, format: 'csv' });
      toast({ title: 'Success', description: 'Activity logs exported successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to export logs', variant: 'destructive' });
    }
  };

  if (!canViewLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <User className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view user activity.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6" /> User Activity
          </h1>
          <p className="text-gray-600 mt-1">All user activities — who did what, when, and from where</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by user, description, IP..."
                className="pl-9"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
            <Select value={filters.action || 'all'} onValueChange={(v) => handleFilterChange('action', v)}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {filterOptions.actions.map(action => (
                  <SelectItem key={action} value={action}>{formatAction(action)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.resource || 'all'} onValueChange={(v) => handleFilterChange('resource', v)}>
              <SelectTrigger><SelectValue placeholder="Resource" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {filterOptions.resources.map(res => (
                  <SelectItem key={res} value={res}>{res?.replace(/_/g, ' ').toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status || 'all'} onValueChange={(v) => handleFilterChange('status', v)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" /> Activity Log
            </CardTitle>
            <span className="text-sm text-muted-foreground">{pagination.total} total entries</span>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              No activity logs found.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow 
                      key={log._id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedLog(log); setShowDetail(true); }}
                    >
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium">
                              {format(new Date(log.timestamp), 'dd MMM yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(log.timestamp), 'hh:mm:ss a')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{log.userId?.name || 'System'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(log.userId?.role || 'unknown')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {formatAction(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{log.resource?.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
                        {log.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(log.status)}
                          <span className="text-xs capitalize">{log.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
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
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.pages} ({pagination.total} entries)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum: number;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === pagination.page ? 'default' : 'outline'}
                          size="sm"
                          className="w-8 h-8 p-0"
                          onClick={() => setPagination(p => ({ ...p, page: pageNum }))}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
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
              <Activity className="h-5 w-5" /> Activity Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* Timestamp */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{format(new Date(selectedLog.timestamp), 'EEEE, dd MMMM yyyy')}</div>
                  <div className="text-sm text-muted-foreground">{format(new Date(selectedLog.timestamp), 'hh:mm:ss a')}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User</label>
                  <div className="mt-1 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedLog.userId?.name || 'System'}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Role</label>
                  <div className="mt-1">{getRoleBadge(selectedLog.userId?.role || 'unknown')}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Action</label>
                  <div className="mt-1">
                    <Badge variant="outline">{formatAction(selectedLog.action)}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Resource</label>
                  <div className="mt-1 capitalize">{selectedLog.resource?.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Severity</label>
                  <div className="mt-1">{getSeverityBadge(selectedLog.severity)}</div>
                </div>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="mt-1 text-sm bg-muted p-3 rounded">{selectedLog.description}</p>
              </div>

              {/* Changes (before/after diff) */}
              {(selectedLog as any).changes && (selectedLog as any).changes.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Changes (Before → After)</label>
                  <div className="mt-1 border rounded overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Field</th>
                          <th className="px-3 py-2 text-left font-medium text-red-600">Old Value</th>
                          <th className="px-3 py-2 text-left font-medium text-green-600">New Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {(selectedLog as any).changes.map((change: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-mono text-xs font-medium">{change.field}</td>
                            <td className="px-3 py-2 font-mono text-xs text-red-700 bg-red-50">
                              {change.oldValue != null ? String(change.oldValue) : '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-green-700 bg-green-50">
                              {change.newValue != null ? String(change.newValue) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">IP Address</label>
                  <div className="mt-1 font-mono text-sm">{selectedLog.ipAddress}</div>
                </div>
                {selectedLog.location && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                    <div className="mt-1 text-sm">
                      {[selectedLog.location.city, selectedLog.location.region, selectedLog.location.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                )}
              </div>

              {selectedLog.metadata && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedLog.metadata.method && (
                      <div>
                        <span className="text-muted-foreground">Method:</span>{' '}
                        <Badge variant="outline">{selectedLog.metadata.method}</Badge>
                      </div>
                    )}
                    {selectedLog.metadata.endpoint && (
                      <div>
                        <span className="text-muted-foreground">Endpoint:</span>{' '}
                        <code className="text-xs bg-muted px-1 rounded">{selectedLog.metadata.endpoint}</code>
                      </div>
                    )}
                    {selectedLog.metadata.statusCode && (
                      <div>
                        <span className="text-muted-foreground">Status Code:</span> {selectedLog.metadata.statusCode}
                      </div>
                    )}
                    {selectedLog.metadata.duration && (
                      <div>
                        <span className="text-muted-foreground">Duration:</span> {selectedLog.metadata.duration}ms
                      </div>
                    )}
                  </div>
                </>
              )}

              {selectedLog.userAgent && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User Agent</label>
                  <div className="mt-1 text-xs font-mono bg-muted p-2 rounded break-all">{selectedLog.userAgent}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserActivity;