import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useRBAC } from '@/hooks/useRBAC';
import { useToast } from '@/hooks/use-toast';
import { loginLogService, SuspiciousActivity as SuspiciousData } from '@/services/loginLogService';
import { format } from 'date-fns';
import { AlertTriangle, ShieldAlert, RefreshCw, Phone, Globe } from 'lucide-react';

const SuspiciousActivity: React.FC = () => {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();
  const [data, setData] = useState<SuspiciousData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await loginLogService.getSuspiciousActivity({ threshold: 5, hours: 24 });
      setData(result.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch suspicious activity', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (!hasPermission('login_logs.read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6"><p className="text-muted-foreground">You don't have permission to view suspicious activity.</p></Card>
      </div>
    );
  }

  const totalAlerts = (data?.failedByIP?.length || 0) + (data?.failedByPhone?.length || 0) + (data?.otpAbuse?.length || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><ShieldAlert className="h-6 w-6 text-orange-500" /> Suspicious Activity</h1>
          <p className="text-muted-foreground mt-1">Detect potential brute-force attacks, OTP abuse, and anomalies — last 24 hours</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={totalAlerts > 0 ? 'border-orange-300 bg-orange-50/50 dark:bg-orange-950/20' : ''}>
          <CardContent className="pt-6 text-center">
            <div className={`text-xl sm:text-3xl font-bold ${totalAlerts > 0 ? 'text-orange-600' : ''}`}>{totalAlerts}</div>
            <p className="text-sm text-muted-foreground">Total Alerts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-red-600">{data?.failedByIP?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Flagged IPs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-yellow-600">{data?.failedByPhone?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Flagged Phones</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl sm:text-3xl font-bold text-purple-600">{data?.otpAbuse?.length || 0}</div>
            <p className="text-sm text-muted-foreground">OTP Abuse</p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-muted animate-pulse rounded" />)}</div>
      ) : totalAlerts === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-green-700">No Suspicious Activity Detected</h3>
            <p className="text-muted-foreground mt-1">All login activity appears normal in the last 24 hours.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Failed by IP */}
          {data?.failedByIP && data.failedByIP.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-red-500" /> Failed Logins by IP Address
                  <Badge variant="destructive" className="ml-auto">{data.failedByIP.length} flagged</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Failed Attempts</TableHead>
                      <TableHead>Last Attempt</TableHead>
                      <TableHead>Phones Targeted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.failedByIP.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{item._id}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{item.count} attempts</Badge>
                        </TableCell>
                        <TableCell>{item.lastAttempt ? format(new Date(item.lastAttempt), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(item.phones || []).slice(0, 5).map((phone: string) => (
                              <Badge key={phone} variant="outline" className="text-xs">{phone}</Badge>
                            ))}
                            {(item.phones || []).length > 5 && <Badge variant="outline" className="text-xs">+{item.phones.length - 5} more</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed by Phone */}
          {data?.failedByPhone && data.failedByPhone.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4 text-yellow-500" /> Failed Logins by Phone Number
                  <Badge className="ml-auto bg-yellow-100 text-yellow-800">{data.failedByPhone.length} flagged</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Failed Attempts</TableHead>
                      <TableHead>Last Attempt</TableHead>
                      <TableHead>IPs Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.failedByPhone.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{item._id}</TableCell>
                        <TableCell>
                          <Badge className="bg-yellow-100 text-yellow-800">{item.count} attempts</Badge>
                        </TableCell>
                        <TableCell>{item.lastAttempt ? format(new Date(item.lastAttempt), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(item.ips || []).slice(0, 3).map((ip: string) => (
                              <Badge key={ip} variant="outline" className="font-mono text-xs">{ip}</Badge>
                            ))}
                            {(item.ips || []).length > 3 && <Badge variant="outline" className="text-xs">+{item.ips.length - 3} more</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* OTP Abuse */}
          {data?.otpAbuse && data.otpAbuse.length > 0 && (
            <Card className="border-purple-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-purple-500" /> Rapid OTP Request Abuse
                  <Badge className="ml-auto bg-purple-100 text-purple-800">{data.otpAbuse.length} flagged</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>OTP Requests</TableHead>
                      <TableHead>Last Request</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.otpAbuse.map((item: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{item._id}</TableCell>
                        <TableCell>
                          <Badge className="bg-purple-100 text-purple-800">{item.count} requests</Badge>
                        </TableCell>
                        <TableCell>{item.lastRequest ? format(new Date(item.lastRequest), 'dd MMM yyyy HH:mm') : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default SuspiciousActivity;
