import React, { useState, useEffect } from 'react';
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
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Calendar,
  User,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import { useRBAC } from '@/hooks/useRBAC';
import { useToast } from '@/hooks/use-toast';
import { activityLogService } from '@/services/activityLogService';
import { format } from 'date-fns';

interface ActivityLog {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  action: string;
  resource: string;
  resourceId?: string;
  description: string;
  details: any;
  ipAddress: string;
  userAgent?: string;
  location?: {
    country: string;
    region: string;
    city: string;
  };
  status: 'success' | 'failed' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: {
    endpoint: string;
    method: string;
    statusCode: number;
    duration: number;
  };
  changes?: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  timestamp: string;
}

interface ActivityLogFilters {
  search: string;
  action: string;
  resource: string;
  status: string;
  severity: string;
  userId: string;
  startDate: string;
  endDate: string;
  ipAddress: string;
}

const ActivityLogs: React.FC = () => {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  
  // Filters
  const [filters, setFilters] = useState<ActivityLogFilters>({
    search: '',
    action: '',
    resource: '',
    status: '',
    severity: '',
    userId: '',
    startDate: '',
    endDate: '',
    ipAddress: ''
  });
  
  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    actions: [],
    resources: [],
    statuses: [],
    severities: []
  });

  // Check permissions
  const canViewLogs = hasPermission('activity_logs.read');
  const canExportLogs = hasPermission('activity_logs.export');

  useEffect(() => {
    if (canViewLogs) {
      fetchLogs();
      fetchFilterOptions();
    }
  }, [canViewLogs, currentPage, pageSize]);

  useEffect(() => {
    if (canViewLogs) {
      const delayedSearch = setTimeout(() => {
        setCurrentPage(1);
        fetchLogs();
      }, 500);
      
      return () => clearTimeout(delayedSearch);
    }
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const queryParams = {
        page: currentPage,
        limit: pageSize,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== 'all')
        )
      };

      const response = await activityLogService.getActivityLogs(queryParams);
      
      if (response.success) {
        setLogs(response.data.logs);
        setTotalPages(response.data.pagination.pages);
        setTotalLogs(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await activityLogService.getFilterOptions();
      if (response.success) {
        setFilterOptions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  };

  const handleFilterChange = (key: keyof ActivityLogFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      action: '',
      resource: '',
      status: '',
      severity: '',
      userId: '',
      startDate: '',
      endDate: '',
      ipAddress: ''
    });
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const queryParams = {
        format,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== 'all')
        )
      };

      await activityLogService.exportLogs(queryParams);
      
      toast({
        title: 'Success',
        description: `Activity logs exported successfully as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error('Failed to export logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to export activity logs',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatLocation = (location?: { country: string; region: string; city: string }) => {
    if (!location) return 'Unknown';
    return `${location.city}, ${location.region}, ${location.country}`;
  };

  if (!canViewLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view activity logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-600">Monitor system activities and user actions</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {canExportLogs && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('json')}>
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  Export as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action
              </label>
              <Select
                value={filters.action}
                onValueChange={(value) => handleFilterChange('action', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {filterOptions.actions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resource
              </label>
              <Select
                value={filters.resource}
                onValueChange={(value) => handleFilterChange('resource', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All resources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All resources</SelectItem>
                  {filterOptions.resources.map((resource) => (
                    <SelectItem key={resource} value={resource}>
                      {resource}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {filterOptions.statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity
              </label>
              <Select
                value={filters.severity}
                onValueChange={(value) => handleFilterChange('severity', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  {filterOptions.severities.map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Activity Logs ({totalLogs})
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => setPageSize(parseInt(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                        Loading activity logs...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="text-gray-500">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        No activity logs found
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log._id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {format(new Date(log.timestamp), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(log.timestamp), 'HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          <div>
                            <div className="font-medium">{log.userId?.name || 'Unknown'}</div>
                            <div className="text-sm text-gray-500">{log.userId?.role}</div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline">
                          {log.action}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="secondary">
                          {log.resource}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center">
                          {getStatusIcon(log.status)}
                          <span className="ml-2 capitalize">{log.status}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={getSeverityColor(log.severity)}>
                          {log.severity}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-mono text-sm">{log.ipAddress}</div>
                          {log.location && (
                            <div className="text-xs text-gray-500">
                              {formatLocation(log.location)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Dialog open={showDetails && selectedLog?._id === log._id} onOpenChange={setShowDetails}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Activity Log Details</DialogTitle>
                            </DialogHeader>
                            
                            {selectedLog && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Timestamp
                                    </label>
                                    <p className="text-sm text-gray-900">
                                      {format(new Date(selectedLog.timestamp), 'PPpp')}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      User
                                    </label>
                                    <p className="text-sm text-gray-900">
                                      {selectedLog.userId?.name} ({selectedLog.userId?.role})
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Action
                                    </label>
                                    <p className="text-sm text-gray-900">{selectedLog.action}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Resource
                                    </label>
                                    <p className="text-sm text-gray-900">{selectedLog.resource}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Status
                                    </label>
                                    <div className="flex items-center">
                                      {getStatusIcon(selectedLog.status)}
                                      <span className="ml-2 capitalize">{selectedLog.status}</span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Severity
                                    </label>
                                    <Badge className={getSeverityColor(selectedLog.severity)}>
                                      {selectedLog.severity}
                                    </Badge>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      IP Address
                                    </label>
                                    <p className="text-sm text-gray-900 font-mono">{selectedLog.ipAddress}</p>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Location
                                    </label>
                                    <p className="text-sm text-gray-900">
                                      {formatLocation(selectedLog.location)}
                                    </p>
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                  </label>
                                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                                    {selectedLog.description}
                                  </p>
                                </div>

                                {selectedLog.changes && selectedLog.changes.length > 0 && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Changes (Before → After)
                                    </label>
                                    <div className="border rounded overflow-hidden">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-medium text-gray-600">Field</th>
                                            <th className="px-3 py-2 text-left font-medium text-red-600">Old Value</th>
                                            <th className="px-3 py-2 text-left font-medium text-green-600">New Value</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {selectedLog.changes.map((change, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                              <td className="px-3 py-2 font-mono text-xs font-medium">{change.field}</td>
                                              <td className="px-3 py-2 font-mono text-xs text-red-700 bg-red-50">
                                                {change.oldValue != null ? (typeof change.oldValue === 'object' ? JSON.stringify(change.oldValue) : String(change.oldValue)) : '—'}
                                              </td>
                                              <td className="px-3 py-2 font-mono text-xs text-green-700 bg-green-50">
                                                {change.newValue != null ? (typeof change.newValue === 'object' ? JSON.stringify(change.newValue) : String(change.newValue)) : '—'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                                
                                {selectedLog.userAgent && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      User Agent
                                    </label>
                                    <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded font-mono">
                                      {selectedLog.userAgent}
                                    </p>
                                  </div>
                                )}
                                
                                {selectedLog.metadata && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Request Metadata
                                    </label>
                                    <pre className="text-sm text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">
                                      {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                
                                {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Additional Details
                                    </label>
                                    <pre className="text-sm text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">
                                      {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} logs
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLogs;