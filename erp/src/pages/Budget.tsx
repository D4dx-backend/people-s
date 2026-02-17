import { useState, useEffect } from "react";
import { Download, TrendingUp, TrendingDown, IndianRupee, FileText, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { budget } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";

export default function Budget() {
  const { hasAnyPermission, hasPermission } = useRBAC();
  
  // Permission checks
  const canViewBudget = hasAnyPermission(['finances.read.all', 'finances.read.regional']);
  
  const [selectedPeriod, setSelectedPeriod] = useState("current_year");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [projectBudgets, setProjectBudgets] = useState<any[]>([]);
  const [schemeBudgets, setSchemeBudgets] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  useEffect(() => {
    if (canViewBudget) {
      loadBudgetData();
    }
  }, [canViewBudget, selectedPeriod]);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewRes,
        projectsRes,
        schemesRes,
        transactionsRes,
        summaryRes,
        categoryRes
      ] = await Promise.all([
        budget.getOverview(selectedPeriod),
        budget.getProjects(selectedPeriod),
        budget.getSchemes(selectedPeriod),
        budget.getTransactions(10, { period: selectedPeriod }),
        budget.getMonthlySummary(undefined, undefined, selectedPeriod),
        budget.getByCategory(selectedPeriod)
      ]);

      if (overviewRes.success) setOverview(overviewRes.data.overview);
      if (projectsRes.success) setProjectBudgets(projectsRes.data.projects);
      if (schemesRes.success) setSchemeBudgets(schemesRes.data.schemes);
      if (transactionsRes.success) setRecentTransactions(transactionsRes.data.transactions);
      if (summaryRes.success) setMonthlySummary(summaryRes.data.summary);
      if (categoryRes.success) setCategoryData(categoryRes.data.categories);

    } catch (err: any) {
      setError(err.message || 'Failed to load budget data');
      toast({
        title: "Error",
        description: "Failed to load budget data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) { // 1 crore or more
      return `₹${(amount / 10000000).toFixed(1)}Cr`;
    } else if (amount >= 100000) { // 1 lakh or more
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) { // 1 thousand or more
      return `₹${(amount / 1000).toFixed(1)}K`;
    } else {
      return `₹${amount.toFixed(0)}`;
    }
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Access denied check
  if (!canViewBudget) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <IndianRupee className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view budget information.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading budget data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const totalBudget = overview?.totalBudget || 0;
  const totalAllocated = overview?.totalAllocated || 0;
  const totalSpent = overview?.totalSpent || 0;
  const totalPending = overview?.totalPending || 0;
  const availableBalance = overview?.availableBalance || 0;
  const utilizationRate = overview?.utilizationRate || 0;
  const allocationRate = overview?.allocationRate || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Budget Management</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage financial resources across projects and schemes
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">This Month</SelectItem>
              <SelectItem value="current_quarter">This Quarter</SelectItem>
              <SelectItem value="current_year">This Year</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Budget"
          value={formatCurrency(totalBudget)}
          icon={TrendingUp}
          trend={{ 
            value: utilizationRate, 
            isPositive: utilizationRate > 0 && utilizationRate < 90,
            label: `${formatPercentage(utilizationRate)} utilized`
          }}
        />
        <StatsCard
          title="Allocated Amount"
          value={formatCurrency(totalAllocated)}
          icon={FileText}
          trend={{ 
            value: allocationRate, 
            isPositive: allocationRate > 0,
            label: `${formatPercentage(allocationRate)} of budget`
          }}
        />
        <StatsCard
          title="Disbursed Amount"
          value={formatCurrency(totalSpent)}
          icon={TrendingDown}
          trend={{ 
            value: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0, 
            isPositive: true,
            label: `${formatPercentage(totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0)} of allocated`
          }}
        />
        <StatsCard
          title="Available Balance"
          value={formatCurrency(availableBalance)}
          icon={IndianRupee}
          trend={{ 
            value: totalBudget > 0 ? (availableBalance / totalBudget) * 100 : 0, 
            isPositive: availableBalance > 0,
            label: `${formatPercentage(totalBudget > 0 ? (availableBalance / totalBudget) * 100 : 0)} remaining`
          }}
        />
      </div>

      {/* Additional metrics row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Payments</p>
                <p className="text-xl font-bold">{formatCurrency(totalPending)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{overview?.pendingPayments || 0} payments</p>
                <p className="text-xs text-orange-600">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Projects</p>
                <p className="text-xl font-bold">{overview?.projectCount || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{overview?.schemeCount || 0} schemes</p>
                <p className="text-xs text-green-600">Running</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved Applications</p>
                <p className="text-xl font-bold">{overview?.approvedApplications || 0}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{overview?.completedPayments || 0} completed</p>
                <p className="text-xs text-blue-600">Beneficiaries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Project Budget</TabsTrigger>
          <TabsTrigger value="schemes">Scheme Budget</TabsTrigger>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Budget Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Real-time budget utilization across all active projects
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {projectBudgets.map((project) => (
                  <div key={project.id} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{project.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            project.status === 'active' ? 'bg-green-100 text-green-700' :
                            project.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {project.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {project.code} • {project.category.replace('_', ' ')} • 
                          {project.schemesCount} schemes • {project.applicationsCount} applications
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-lg">{formatCurrency(project.totalBudget)}</p>
                        <p className="text-sm text-muted-foreground">Total Budget</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Allocated</p>
                        <p className="font-medium text-blue-600">{formatCurrency(project.allocated)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Disbursed</p>
                        <p className="font-medium text-green-600">{formatCurrency(project.spent)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pending</p>
                        <p className="font-medium text-orange-600">{formatCurrency(project.pending || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-medium text-gray-600">{formatCurrency(project.available)}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Budget Utilization</span>
                        <span className="font-medium">{formatPercentage(project.utilizationRate)}</span>
                      </div>
                      <Progress value={project.utilizationRate} className="h-2" />
                      
                      <div className="flex justify-between text-sm">
                        <span>Allocation Rate</span>
                        <span className="font-medium">{formatPercentage(project.allocationRate)}</span>
                      </div>
                      <Progress value={project.allocationRate} className="h-2 bg-blue-100" />
                    </div>
                  </div>
                ))}
                
                {projectBudgets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No project budget data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schemes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheme Budget Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">
                Detailed financial tracking for each scheme with application metrics
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {schemeBudgets.map((scheme) => (
                  <div key={scheme.id} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{scheme.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            scheme.status === 'active' ? 'bg-green-100 text-green-700' :
                            scheme.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {scheme.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {scheme.code} • {scheme.project?.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {scheme.totalApplications} applications • {scheme.approvedApplications} approved • 
                          {formatPercentage(scheme.successRate)} success rate
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-lg">{formatCurrency(scheme.totalBudget)}</p>
                        <p className="text-sm text-muted-foreground">Total Budget</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Allocated</p>
                        <p className="font-medium text-blue-600">{formatCurrency(scheme.allocated)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Disbursed</p>
                        <p className="font-medium text-green-600">{formatCurrency(scheme.spent)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pending</p>
                        <p className="font-medium text-orange-600">{formatCurrency(scheme.pending || 0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-medium text-gray-600">{formatCurrency(scheme.available)}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Budget Utilization</span>
                        <span className="font-medium">{formatPercentage(scheme.utilizationRate)}</span>
                      </div>
                      <Progress value={scheme.utilizationRate} className="h-2" />
                      
                      <div className="flex justify-between text-sm">
                        <span>Allocation Efficiency</span>
                        <span className="font-medium">{formatPercentage(scheme.allocationRate)}</span>
                      </div>
                      <Progress value={scheme.allocationRate} className="h-2 bg-blue-100" />
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Applications: </span>
                        <span className="text-green-600">{scheme.approvedApplications} approved</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-orange-600">{scheme.pendingApplications} pending</span>
                      </div>
                      <div className="text-sm font-medium">
                        Success Rate: {formatPercentage(scheme.successRate)}
                      </div>
                    </div>
                  </div>
                ))}
                
                {schemeBudgets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No scheme budget data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <p className="text-sm text-muted-foreground">
                Latest payment transactions with detailed tracking information
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{transaction.paymentNumber}</p>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            transaction.status === 'completed' ? 'bg-green-100 text-green-700' :
                            transaction.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                            transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            transaction.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {transaction.status}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            transaction.type === 'full_payment' ? 'bg-purple-100 text-purple-700' :
                            transaction.type === 'installment' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {transaction.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{transaction.beneficiaryName}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.schemeName} • {transaction.projectName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          App: {transaction.applicationNumber} • 
                          Method: {transaction.method?.replace('_', ' ')} • 
                          {transaction.processingDays ? `${transaction.processingDays} days` : 'Processing'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-lg">{formatCurrency(transaction.amount)}</p>
                        {transaction.netAmount && transaction.netAmount !== transaction.amount && (
                          <p className="text-sm text-muted-foreground">
                            Net: {formatCurrency(transaction.netAmount)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(transaction.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {transaction.installment && (
                      <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
                        Installment {transaction.installment.number} of {transaction.installment.total}
                        {transaction.installment.description && ` - ${transaction.installment.description}`}
                      </div>
                    )}
                    
                    {transaction.timeline && (
                      <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                        <span>Initiated: {transaction.timeline.initiated ? new Date(transaction.timeline.initiated).toLocaleDateString() : 'N/A'}</span>
                        {transaction.timeline.completed && (
                          <span>Completed: {new Date(transaction.timeline.completed).toLocaleDateString()}</span>
                        )}
                        <span>Verification: {transaction.verification?.status || 'pending'}</span>
                      </div>
                    )}
                  </div>
                ))}
                
                {recentTransactions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <IndianRupee className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent transactions found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget by Category</CardTitle>
              <p className="text-sm text-muted-foreground">
                Financial performance analysis across different project categories
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {categoryData.map((category) => (
                  <div key={category.category} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-lg capitalize">{category.categoryName}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {category.projectCount} projects • {category.schemeCount} schemes • 
                          {category.beneficiaryCount} beneficiaries
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Avg project budget: {formatCurrency(category.avgProjectBudget)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-xl">{formatCurrency(category.totalBudget)}</p>
                        <p className="text-sm text-muted-foreground">Total Budget</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Allocated</p>
                        <p className="font-medium text-blue-600">{formatCurrency(category.totalAllocated)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Disbursed</p>
                        <p className="font-medium text-green-600">{formatCurrency(category.totalSpent)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-medium text-gray-600">{formatCurrency(category.available)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Applications</p>
                        <p className="font-medium text-purple-600">{category.applicationCount}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Budget Utilization</span>
                          <span className="font-medium">{formatPercentage(category.utilizationRate)}</span>
                        </div>
                        <Progress value={category.utilizationRate} className="h-2" />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Allocation Rate</span>
                          <span className="font-medium">{formatPercentage(category.allocationRate)}</span>
                        </div>
                        <Progress value={category.allocationRate} className="h-2 bg-blue-100" />
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>Disbursement Efficiency</span>
                          <span className="font-medium">{formatPercentage(category.efficiency)}</span>
                        </div>
                        <Progress value={category.efficiency} className="h-2 bg-green-100" />
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t text-sm">
                      <div>
                        <span className="text-muted-foreground">Impact: </span>
                        <span className="font-medium">{category.beneficiaryCount} beneficiaries served</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg per beneficiary: </span>
                        <span className="font-medium">
                          {category.beneficiaryCount > 0 ? 
                            formatCurrency(category.totalSpent / category.beneficiaryCount) : 
                            'N/A'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {categoryData.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No category data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}