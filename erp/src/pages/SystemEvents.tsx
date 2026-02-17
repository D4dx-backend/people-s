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
  Settings, 
  Server, 
  Search, 
  Eye, 
  Calendar,
  RefreshCw,
  Download,
  Filter,
  Database,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { useRBAC } from '@/hooks/useRBAC';
import { useToast } from '@/hooks/use-toast';
import { activityLogService } from '@/services/activityLogService';
import { format } from 'date-fns';

interface SystemEvent {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  action: string;
  resource: string;
  description: string;
  status: 'success' | 'failed' | 'warning' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  details: any;
  metadata?: {
    endpoint: string;
    method: string;
    statusCode: number;
    duration: number;
  };
}

const SYSTEM_ACTIONS = [
  'system_backup',
  'system_restore',
  'data_export',
  'data_import',
  'settings_updated',
  'configuration_changed',
  'system_maintenance',
  'database_cleanup',
  'cache_cleared',
  'service_restart'
];

const SystemEvents: React.FC = () => {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    action: '',
    severity: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const canViewLogs = hasPermission('activity_logs.read');

  useEffect(() => {
    if (canViewLogs) {
      fetchSystemEvents();
    }
  }, [canViewLogs, currentPage, pageSize]);

  useEffect(() => {
    if (canViewLogs) {
      const delayedSearch = setTimeout(() => {
        setCurrentPage(1);
        fetchSystemEvents();
      }, 500);
      
      return () => clearTimeout(delayedSearch);
    }
  }, [filters]);

  const fetchSystemEvents = async () => {
    try {
      setLoading(true);
      
      const queryParams = {
        page: currentPage,
        limit: pageSize,
        resource: 'system', // Filter for system resource
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== 'all')
        )
      };

      const response = await activityLogService.getActivityLogs(queryParams);
      
      if (response.success) {
        setEvents(response.data.logs);
        setTotalPages(response.data.pagination.pages);
        setTotalEvents(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Failed to fetch system events:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch system events',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      action: '',
      severity: '',
      status: '',
      startDate: '',
      endDate: ''
    });
  };

  const handleExport = async () => {
    try {
      const queryParams = {
        format: 'csv' as const,
        resource: 'system',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== 'all')
        )
      };

      await activityLogService.exportLogs(queryParams);
      
      toast({
        title: 'Success',
        description: 'System events exported successfully',
      });
    } catch (error) {
      console.error('Failed to export system events:', error);
      toast({
        title: 'Error',
        description: 'Failed to export system events',
        variant: 'destructive'
      });
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'system_backup':
      case 'system_restore':
        return <Database className="h-4 w-4 text-blue-500" />;
      case 'data_export':
      case 'data_import':
        return <Download className="h-4 w-4 text-green-500" />;
      case 'settings_updated':
      case 'configuration_changed':
        return <Settings className="h-4 w-4 text-purple-500" />;
      case 'system_maintenance':
        return <Wrench className="h-4 w-4 text-orange-500" />;
      default:
        return <Server className="h-4 w-4 text-gray-500" />;
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
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canViewLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Server className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view system events.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">System Events</h1>
          <p className="text-gray-600">Monitor system operations and maintenance activities</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSystemEvents}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search events..."
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
                  {SYSTEM_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action.replace('_', ' ').toUpperCase()}
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
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
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
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
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

      {/* System Events Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Server className="h-5 w-5 mr-2" />
              System Events ({totalEvents})
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
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                        Loading system events...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-gray-500">
                        <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        No system events found
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {format(new Date(event.timestamp), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(event.timestamp), 'HH:mm:ss')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center">
                          {getActionIcon(event.action)}
                          <div className="ml-2">
                            <div className="font-medium">
                              {event.action.replace('_', ' ').toUpperCase()}
                            </div>
                            <div className="text-sm text-gray-500 max-w-xs truncate">
                              {event.description}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div>
                          <div className="font-medium">{event.userId?.name || 'System'}</div>
                          <div className="text-sm text-gray-500">{event.userId?.role || 'Automated'}</div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        {event.metadata?.duration ? (
                          <span className="text-sm text-gray-600">
                            {event.metadata.duration > 1000 
                              ? `${(event.metadata.duration / 1000).toFixed(1)}s`
                              : `${event.metadata.duration}ms`
                            }
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Dialog open={showDetails && selectedEvent?._id === event._id} onOpenChange={setShowDetails}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedEvent(event)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>System Event Details</DialogTitle>
                            </DialogHeader>
                            
                            {selectedEvent && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Timestamp
                                    </label>
                                    <p className="text-sm text-gray-900">
                                      {format(new Date(selectedEvent.timestamp), 'PPpp')}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Action
                                    </label>
                                    <div className="flex items-center">
                                      {getActionIcon(selectedEvent.action)}
                                      <span className="ml-2 text-sm text-gray-900">
                                        {selectedEvent.action.replace('_', ' ').toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      User
                                    </label>
                                    <p className="text-sm text-gray-900">
                                      {selectedEvent.userId?.name || 'System'} ({selectedEvent.userId?.role || 'Automated'})
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Status
                                    </label>
                                    <Badge className={getStatusColor(selectedEvent.status)}>
                                      {selectedEvent.status}
                                    </Badge>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Severity
                                    </label>
                                    <Badge className={getSeverityColor(selectedEvent.severity)}>
                                      {selectedEvent.severity}
                                    </Badge>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      Duration
                                    </label>
                                    <p className="text-sm text-gray-900">
                                      {selectedEvent.metadata?.duration 
                                        ? selectedEvent.metadata.duration > 1000 
                                          ? `${(selectedEvent.metadata.duration / 1000).toFixed(1)} seconds`
                                          : `${selectedEvent.metadata.duration} milliseconds`
                                        : 'Not recorded'
                                      }
                                    </p>
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                  </label>
                                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                                    {selectedEvent.description}
                                  </p>
                                </div>
                                
                                {selectedEvent.metadata && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      System Metadata
                                    </label>
                                    <pre className="text-sm text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">
                                      {JSON.stringify(selectedEvent.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                
                                {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Additional Details
                                    </label>
                                    <pre className="text-sm text-gray-900 bg-gray-50 p-3 rounded overflow-x-auto">
                                      {JSON.stringify(selectedEvent.details, null, 2)}
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
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalEvents)} of {totalEvents} events
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

export default SystemEvents;