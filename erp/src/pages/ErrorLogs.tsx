import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useRBAC } from '@/hooks/useRBAC';
import { useToast } from '@/hooks/use-toast';
import { errorLogService, ErrorLog } from '@/services/errorLogService';
import { format } from 'date-fns';
import { Search, Download, RefreshCw, Eye, AlertTriangle, Bug, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const ErrorLogs: React.FC = () => {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    search: '',
    errorType: '',
    severity: '',
    isResolved: '',
    startDate: '',
    endDate: ''
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await errorLogService.getErrorLogs({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });
      setLogs(result.data?.errors || []);
      if (result.data?.pagination) {
        setPagination(prev => ({ ...prev, ...result.data.pagination }));
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch error logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, string> = {
      critical: 'bg-red-600 text-white',
      high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      low: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return <Badge className={variants[severity] || 'bg-gray-100 text-gray-800'}>{severity}</Badge>;
  };

  const getStatusBadge = (isResolved: boolean) => {
    return isResolved
      ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" /> Resolved</Badge>
      : <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Open</Badge>;
  };

  const handleResolve = async () => {
    if (!selectedLog) return;
    setResolving(true);
    try {
      await errorLogService.markResolved(selectedLog._id, resolveNote);
      toast({ title: 'Success', description: 'Error marked as resolved' });
      setShowResolve(false);
      setResolveNote('');
      fetchLogs();
    } catch {
      toast({ title: 'Error', description: 'Failed to mark as resolved', variant: 'destructive' });
    } finally {
      setResolving(false);
    }
  };

  const handleExport = async (fmt: 'json' | 'csv') => {
    try {
      await errorLogService.exportLogs({ ...filters, format: fmt });
      toast({ title: 'Success', description: `Error logs exported as ${fmt.toUpperCase()}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to export logs', variant: 'destructive' });
    }
  };

  if (!hasPermission('error_logs.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6"><p className="text-muted-foreground">You don't have permission to view error logs.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><Bug className="h-6 w-6" /> Error Logs</h1>
          <p className="text-muted-foreground mt-1">Track and manage application errors with severity levels and resolution</p>
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
              <Input placeholder="Search error messages, URLs..." className="pl-9"
                value={filters.search} onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))} />
            </div>
            <Select value={filters.errorType} onValueChange={(v) => setFilters(f => ({ ...f, errorType: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Error Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="validation_error">Validation</SelectItem>
                <SelectItem value="authentication_error">Authentication</SelectItem>
                <SelectItem value="authorization_error">Authorization</SelectItem>
                <SelectItem value="database_error">Database</SelectItem>
                <SelectItem value="network_error">Network</SelectItem>
                <SelectItem value="not_found">Not Found</SelectItem>
                <SelectItem value="rate_limit">Rate Limit</SelectItem>
                <SelectItem value="server_error">Server</SelectItem>
                <SelectItem value="external_service_error">External Service</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.severity} onValueChange={(v) => setFilters(f => ({ ...f, severity: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.isResolved} onValueChange={(v) => setFilters(f => ({ ...f, isResolved: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="false">Open</SelectItem>
                <SelectItem value="true">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold">{pagination.total}</div>
            <p className="text-xs text-muted-foreground">Total Errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-red-600">{logs.filter(l => l.severity === 'critical').length}</div>
            <p className="text-xs text-muted-foreground">Critical (page)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-red-500">{logs.filter(l => l.severity === 'high').length}</div>
            <p className="text-xs text-muted-foreground">High (page)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-orange-500">{logs.filter(l => !l.isResolved).length}</div>
            <p className="text-xs text-muted-foreground">Open (page)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-green-600">{logs.filter(l => l.isResolved).length}</div>
            <p className="text-xs text-muted-foreground">Resolved (page)</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Error Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No error logs found matching your filters.</div>
          ) : (
            <>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status Code</TableHead>
                  <TableHead className="max-w-xs">Message</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Occurrences</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log._id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedLog(log); setShowDetail(true); }}>
                    <TableCell className="whitespace-nowrap text-sm">{format(new Date(log.lastOccurrence || log.createdAt), 'dd MMM HH:mm:ss')}</TableCell>
                    <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{log.errorType?.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{log.statusCode}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{log.message}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">{log.request?.url || '-'}</TableCell>
                    <TableCell>
                      {log.occurrenceCount > 1 && <Badge variant="secondary">{log.occurrenceCount}x</Badge>}
                      {log.occurrenceCount <= 1 && <span className="text-sm text-muted-foreground">1</span>}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.isResolved)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); setShowDetail(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!log.isResolved && hasPermission('error_logs.manage') && (
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); setShowResolve(true); }}>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                      </div>
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Error Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Severity</label>
                  <div className="mt-1">{getSeverityBadge(selectedLog.severity)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <div className="mt-1"><Badge variant="outline">{selectedLog.errorType?.replace(/_/g, ' ')}</Badge></div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status Code</label>
                  <div className="mt-1 font-mono">{selectedLog.statusCode}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedLog.isResolved)}</div>
                </div>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground">Error Message</label>
                <div className="mt-1 p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800 text-sm">{selectedLog.message}</div>
              </div>

              {selectedLog.stack && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stack Trace</label>
                  <pre className="mt-1 p-3 bg-muted rounded text-xs overflow-x-auto max-h-48 overflow-y-auto font-mono">{selectedLog.stack}</pre>
                </div>
              )}

              {selectedLog.request && (
                <>
                  <Separator />
                  <h4 className="text-sm font-semibold">Request Context</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Method:</span> <Badge variant="outline">{selectedLog.request.method}</Badge></div>
                    <div><span className="text-muted-foreground">URL:</span> <span className="font-mono text-xs">{selectedLog.request.url}</span></div>
                  </div>
                  {selectedLog.request.params && Object.keys(selectedLog.request.params).length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground">Params</label>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs font-mono">{JSON.stringify(selectedLog.request.params, null, 2)}</pre>
                    </div>
                  )}
                  {selectedLog.request.query && Object.keys(selectedLog.request.query).length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground">Query</label>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs font-mono">{JSON.stringify(selectedLog.request.query, null, 2)}</pre>
                    </div>
                  )}
                  {selectedLog.request.body && Object.keys(selectedLog.request.body).length > 0 && (
                    <div>
                      <label className="text-xs text-muted-foreground">Body (sanitized)</label>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs font-mono max-h-32 overflow-y-auto">{JSON.stringify(selectedLog.request.body, null, 2)}</pre>
                    </div>
                  )}
                </>
              )}

              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Occurrences:</span> <strong>{selectedLog.occurrenceCount}</strong></div>
                <div><span className="text-muted-foreground">First seen:</span> {selectedLog.firstOccurrence ? format(new Date(selectedLog.firstOccurrence), 'dd MMM yyyy HH:mm') : '-'}</div>
                <div><span className="text-muted-foreground">Last seen:</span> {selectedLog.lastOccurrence ? format(new Date(selectedLog.lastOccurrence), 'dd MMM yyyy HH:mm') : '-'}</div>
                <div><span className="text-muted-foreground">IP:</span> <span className="font-mono">{selectedLog.ipAddress || '-'}</span></div>
              </div>

              {selectedLog.isResolved && (
                <>
                  <Separator />
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-semibold text-green-800 dark:text-green-400">Resolution</h4>
                    <div className="text-sm mt-1">
                      <span className="text-muted-foreground">Resolved by:</span> {selectedLog.resolvedBy?.name || '-'} &mdash;{' '}
                      {selectedLog.resolvedAt && format(new Date(selectedLog.resolvedAt), 'dd MMM yyyy HH:mm')}
                    </div>
                    {selectedLog.resolutionNote && <p className="text-sm mt-1">{selectedLog.resolutionNote}</p>}
                  </div>
                </>
              )}

              {selectedLog.fingerprint && (
                <div className="text-xs text-muted-foreground">
                  Fingerprint: <code className="font-mono">{selectedLog.fingerprint}</code>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={showResolve} onOpenChange={setShowResolve}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Error as Resolved</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Add an optional resolution note for this error:</p>
            <div className="p-2 bg-muted rounded text-sm font-mono truncate">{selectedLog?.message}</div>
            <Textarea placeholder="Resolution note (optional)..." value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResolve(false)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={resolving}>
              <CheckCircle className="h-4 w-4 mr-1" /> {resolving ? 'Resolving...' : 'Mark Resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ErrorLogs;
