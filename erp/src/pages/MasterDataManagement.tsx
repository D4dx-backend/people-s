import { useState, useEffect } from "react";
import { Plus, Settings, Edit, Trash2, Copy, Eye, Filter, Search, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { masterData, type MasterData } from "@/lib/api";
import { useRBAC } from "@/hooks/useRBAC";
import { MasterDataModal } from "@/components/modals/MasterDataModal";
import { MasterDataDetailsModal } from "@/components/modals/MasterDataDetailsModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Type configurations
const typeConfigs = {
  scheme_stages: {
    label: "Scheme Stages",
    description: "Configure stages for scheme management",
    icon: "🎯",
    color: "bg-blue-100 text-blue-800 border-blue-200"
  },
  project_stages: {
    label: "Project Stages", 
    description: "Configure stages for project tracking",
    icon: "🏗️",
    color: "bg-green-100 text-green-800 border-green-200"
  },
  application_stages: {
    label: "Application Stages",
    description: "Configure stages for application processing",
    icon: "📋",
    color: "bg-purple-100 text-purple-800 border-purple-200"
  },
  distribution_timeline_templates: {
    label: "Distribution Templates",
    description: "Configure money distribution timelines",
    icon: "💰",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200"
  },
  status_configurations: {
    label: "Status Configurations",
    description: "Configure general status settings",
    icon: "⚙️",
    color: "bg-gray-100 text-gray-800 border-gray-200"
  }
};

// Status colors
const statusColors = {
  draft: "bg-gray-100 text-gray-800 border-gray-200",
  active: "bg-green-100 text-green-800 border-green-200",
  inactive: "bg-red-100 text-red-800 border-red-200",
  archived: "bg-orange-100 text-orange-800 border-orange-200"
};

// Scope colors
const scopeColors = {
  global: "bg-blue-100 text-blue-800",
  state: "bg-purple-100 text-purple-800",
  district: "bg-green-100 text-green-800",
  area: "bg-yellow-100 text-yellow-800",
  unit: "bg-pink-100 text-pink-800",
  project_specific: "bg-indigo-100 text-indigo-800",
  scheme_specific: "bg-cyan-100 text-cyan-800"
};

export default function MasterDataManagement() {
  const { hasPermission } = useRBAC();
  const [masterDataList, setMasterDataList] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMasterData, setSelectedMasterData] = useState<MasterData | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter states
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [scopeFilter, setScopeFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10
  });

  // Check permissions
  const canViewMasterData = hasPermission('master_data.read');
  const canCreateMasterData = hasPermission('master_data.create');
  const canUpdateMasterData = hasPermission('master_data.update');
  const canDeleteMasterData = hasPermission('master_data.delete');

  // Load master data
  useEffect(() => {
    if (canViewMasterData) {
      loadMasterData();
    }
  }, [canViewMasterData, currentPage, searchTerm, typeFilter, statusFilter, scopeFilter]);

  const loadMasterData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page: currentPage,
        limit: 10
      };

      if (searchTerm) params.search = searchTerm;
      if (typeFilter !== "all") params.type = typeFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (scopeFilter !== "all") params.scope = scopeFilter;

      const response = await masterData.getAll(params);
      
      if (response.success && response.data) {
        setMasterDataList(response.data.masterData);
        setPagination(response.data.pagination);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load master data');
      toast({
        title: "Error",
        description: "Failed to load master data configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedMasterData(null);
    setShowCreateModal(true);
  };

  const handleEdit = (item: MasterData) => {
    setSelectedMasterData(item);
    setShowEditModal(true);
  };

  const handleViewDetails = (item: MasterData) => {
    setSelectedMasterData(item);
    setShowDetailsModal(true);
  };

  const handleClone = async (item: MasterData) => {
    try {
      const response = await masterData.clone(item.id);
      if (response.success) {
        toast({
          title: "Success",
          description: "Master data configuration cloned successfully",
        });
        loadMasterData();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clone configuration",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (item: MasterData) => {
    setSelectedMasterData(item);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedMasterData) return;

    try {
      setDeleting(true);
      const response = await masterData.delete(selectedMasterData.id);
      
      if (response.success) {
        toast({
          title: "Success",
          description: "Master data configuration deleted successfully",
        });
        loadMasterData();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete configuration",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setSelectedMasterData(null);
    }
  };

  const handleModalSuccess = () => {
    loadMasterData();
    setShowCreateModal(false);
    setShowEditModal(false);
    setSelectedMasterData(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setStatusFilter("active");
    setScopeFilter("all");
    setCurrentPage(1);
  };

  // Filter data for tabs
  const getFilteredDataForTab = (tabType: string) => {
    if (tabType === "all") return masterDataList;
    return masterDataList.filter(item => item.type === tabType);
  };

  const filteredDataForCurrentTab = getFilteredDataForTab(activeTab);

  if (!canViewMasterData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view master data configurations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Master Data Management</h1>
          <p className="text-muted-foreground mt-1">Configure stages, templates, and system settings</p>
        </div>
        {canCreateMasterData && (
          <Button onClick={handleCreate} className="bg-gradient-primary shadow-glow">
            <Plus className="mr-2 h-4 w-4" />
            New Configuration
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Configurations</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
          </div>
          
          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search configurations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(typeConfigs).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.icon} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={scopeFilter} onValueChange={setScopeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scopes</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="state">State</SelectItem>
                <SelectItem value="district">District</SelectItem>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="unit">Unit</SelectItem>
                <SelectItem value="project_specific">Project Specific</SelectItem>
                <SelectItem value="scheme_specific">Scheme Specific</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
              <TabsTrigger value="all">
                All ({masterDataList.length})
              </TabsTrigger>
              {Object.entries(typeConfigs).map(([key, config]) => (
                <TabsTrigger key={key} value={key}>
                  {config.icon} {config.label.split(' ')[0]} ({masterDataList.filter(item => item.type === key).length})
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading configurations...</p>
                  </div>
                </div>
              ) : error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : filteredDataForCurrentTab.length === 0 ? (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No configurations found</p>
                  {canCreateMasterData && (
                    <Button onClick={handleCreate} className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Configuration
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredDataForCurrentTab.map((item) => {
                    const typeConfig = typeConfigs[item.type as keyof typeof typeConfigs];
                    
                    return (
                      <Card key={item.id} className="hover:shadow-elegant transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">{typeConfig.icon}</span>
                                <div>
                                  <h3 className="text-lg font-semibold">{item.name}</h3>
                                  <p className="text-sm text-muted-foreground">{item.description}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={typeConfig.color} variant="outline">
                                  {typeConfig.label}
                                </Badge>
                                <Badge className={statusColors[item.status]} variant="outline">
                                  {item.status}
                                </Badge>
                                <Badge className={scopeColors[item.scope]} variant="outline">
                                  {item.scope.replace('_', ' ')}
                                </Badge>
                                {item.category && (
                                  <Badge variant="outline">
                                    {item.category}
                                  </Badge>
                                )}
                                <Badge variant="outline">
                                  v{item.version}
                                </Badge>
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Usage Count:</span>
                                  <span className="ml-1 font-medium">{item.usageCount}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Effective From:</span>
                                  <span className="ml-1 font-medium">
                                    {new Date(item.effectiveFrom).toLocaleDateString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Created By:</span>
                                  <span className="ml-1 font-medium">{item.createdBy.name}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Last Used:</span>
                                  <span className="ml-1 font-medium">
                                    {item.lastUsed ? new Date(item.lastUsed).toLocaleDateString() : 'Never'}
                                  </span>
                                </div>
                              </div>

                              {item.tags && item.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-sm text-muted-foreground">Tags:</span>
                                  {item.tags.map((tag, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 ml-4">
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)}>
                                <Eye className="mr-1 h-3 w-3" />
                                View
                              </Button>
                              {canUpdateMasterData && (
                                <Button variant="outline" size="sm" onClick={() => handleEdit(item)}>
                                  <Edit className="mr-1 h-3 w-3" />
                                  Edit
                                </Button>
                              )}
                              {canCreateMasterData && (
                                <Button variant="outline" size="sm" onClick={() => handleClone(item)}>
                                  <Copy className="mr-1 h-3 w-3" />
                                  Clone
                                </Button>
                              )}
                              {canDeleteMasterData && item.usageCount === 0 && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => handleDelete(item)}
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Modals */}
      <MasterDataModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        mode="create"
        onSuccess={handleModalSuccess}
      />

      <MasterDataModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        masterData={selectedMasterData}
        mode="edit"
        onSuccess={handleModalSuccess}
      />

      <MasterDataDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        masterData={selectedMasterData}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedMasterData?.name}"? This action cannot be undone.
              {selectedMasterData?.usageCount > 0 && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  Warning: This configuration is currently being used {selectedMasterData.usageCount} times.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Delete Configuration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}