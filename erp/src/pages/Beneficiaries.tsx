import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, CheckCircle, UserCheck, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '../components/ui/pagination';
import { BeneficiaryModal } from '../components/modals/BeneficiaryModal';
import { DeleteBeneficiaryModal } from '../components/modals/DeleteBeneficiaryModal';
import { GenericFilters } from '../components/filters/GenericFilters';
import { useBeneficiaryFilters } from '../hooks/useBeneficiaryFilters';
import { useExport } from '@/hooks/useExport';
import ExportButton from '@/components/common/ExportButton';
import { beneficiaryExportColumns } from '@/utils/exportColumns';
import { beneficiaries as beneficiariesApi } from '../lib/api';
import { useToast } from '@/hooks/use-toast';
import { useRBAC } from '@/hooks/useRBAC';

interface Application {
  _id: string;
  applicationNumber: string;
  scheme: string | {
    _id: string;
    name: string;
    code: string;
  };
  project: string | {
    _id: string;
    name: string;
    code: string;
  };
}

interface Beneficiary {
  _id: string;
  name: string;
  phone: string;
  state: { _id: string; name: string; code: string } | null;
  district: { _id: string; name: string; code: string } | null;
  area: { _id: string; name: string; code: string } | null;
  unit: { _id: string; name: string; code: string } | null;
  status: 'active' | 'inactive' | 'pending';
  isVerified: boolean;
  verifiedBy?: { name: string } | null;
  verifiedAt?: string;
  createdBy: { name: string } | null;
  createdAt: string;
  applications: Application[] | string[]; // Can be array of objects or IDs
  source?: 'direct' | 'interview';
  interviewId?: string;
  approvedAt?: string;
}

interface PaginationInfo {
  current: number;
  pages: number;
  total: number;
  limit: number;
}

const Beneficiaries: React.FC = () => {
  const { toast } = useToast();
  const { hasAnyPermission, hasPermission } = useRBAC();
  const filterHook = useBeneficiaryFilters();
  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => beneficiariesApi.export(params),
    filenamePrefix: 'beneficiaries',
    pdfTitle: 'Beneficiaries Report',
    pdfColumns: beneficiaryExportColumns,
    getFilterParams: () => filterHook.getExportParams(),
  });
  
  const canViewBeneficiaries = hasAnyPermission(['beneficiaries.read.all', 'beneficiaries.read.regional', 'beneficiaries.read.own']);
  const canCreateBeneficiaries = hasPermission('beneficiaries.create');
  const canUpdateBeneficiaries = hasPermission('beneficiaries.update.regional');
  
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10
  });
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh trigger
  
  const [showFilters, setShowFilters] = useState(false);
  const [showBeneficiaryModal, setShowBeneficiaryModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');

  // Load beneficiaries with filters
  useEffect(() => {
    if (!canViewBeneficiaries) {
      setLoading(false);
      return;
    }

    const fetchBeneficiaries = async () => {
      try {
        setLoading(true);
        const params = filterHook.getApiParams(filterHook.filters.currentPage, pagination.limit);
        params.includeApprovedInterviews = true;

        const response = await beneficiariesApi.getAll(params);
        if (response.success) {
          setBeneficiaries(response.data.beneficiaries);
          setPagination(response.data.pagination);
        } else {
          throw new Error(response.message || 'Failed to fetch beneficiaries');
        }
      } catch (error) {
        console.error('Error fetching beneficiaries:', error);
        toast({
          title: "Error",
          description: "Failed to fetch beneficiaries",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBeneficiaries();
  }, [
    canViewBeneficiaries,
    filterHook.filters.currentPage,
    filterHook.filters.searchTerm,
    filterHook.filters.statusFilter,
    filterHook.filters.projectFilter,
    filterHook.filters.districtFilter,
    filterHook.filters.areaFilter,
    filterHook.filters.unitFilter,
    filterHook.filters.schemeFilter,
    filterHook.filters.genderFilter,
    filterHook.filters.verificationFilter,
    filterHook.filters.fromDate,
    filterHook.filters.toDate,
    filterHook.filters.quickDateFilter,
    pagination.limit,
    refreshKey, // Add refreshKey to trigger re-fetch
  ]);

  if (!canViewBeneficiaries) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don't have permission to view beneficiaries.</p>
        </div>
      </div>
    );
  }

  const handleCreateBeneficiary = () => {
    setSelectedBeneficiary(null);
    setModalMode('create');
    setShowBeneficiaryModal(true);
  };

  const handleViewBeneficiary = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setModalMode('view');
    setShowBeneficiaryModal(true);
  };

  const handleEditBeneficiary = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setModalMode('edit');
    setShowBeneficiaryModal(true);
  };

  const handleDeleteBeneficiary = (beneficiary: Beneficiary) => {
    setSelectedBeneficiary(beneficiary);
    setShowDeleteModal(true);
  };

  const handleVerifyBeneficiary = async (beneficiary: Beneficiary) => {
    try {
      await beneficiariesApi.verify(beneficiary._id);
      toast({
        title: "Success",
        description: "Beneficiary verified successfully"
      });
      // Force refresh by updating refreshKey
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error verifying beneficiary:', error);
      toast({
        title: "Error",
        description: "Failed to verify beneficiary",
        variant: "destructive"
      });
    }
  };

  const handleBeneficiaryModalClose = (shouldRefresh?: boolean) => {
    setShowBeneficiaryModal(false);
    setSelectedBeneficiary(null);
    if (shouldRefresh) {
      // Force refresh by updating refreshKey
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleDeleteModalClose = (shouldRefresh?: boolean) => {
    setShowDeleteModal(false);
    setSelectedBeneficiary(null);
    if (shouldRefresh) {
      // Force refresh by updating refreshKey
      setRefreshKey(prev => prev + 1);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <BeneficiaryModal
        isOpen={showBeneficiaryModal}
        onClose={handleBeneficiaryModalClose}
        beneficiary={selectedBeneficiary}
        mode={modalMode}
      />
      
      <DeleteBeneficiaryModal
        isOpen={showDeleteModal}
        onClose={handleDeleteModalClose}
        beneficiary={selectedBeneficiary}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-bold">Beneficiaries</h1>
          <p className="text-muted-foreground mt-1">Manage and track beneficiaries</p>
        </div>
        <div className="flex gap-2">
          {canUpdateBeneficiaries && (
            <Button 
              variant="outline" 
              onClick={() => {
                filterHook.setVerificationFilter('unverified');
                setShowFilters(true);
              }}
              className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Pending Verification
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
          {canCreateBeneficiaries && (
            <Button onClick={handleCreateBeneficiary}>
              <Plus className="mr-2 h-4 w-4" />
              Add Beneficiary
            </Button>
          )}
          <ExportButton
            onExportCSV={() => exportCSV()}
            onExportPDF={() => exportPDF()}
            onPrint={() => printData()}
            exporting={exporting}
          />
        </div>
      </div>

      {showFilters && (
        <GenericFilters
        searchTerm={filterHook.filters.searchTerm}
        onSearchChange={filterHook.setSearchTerm}
        searchPlaceholder="Search by name or phone..."
        showStatusFilter={true}
        statusFilter={filterHook.filters.statusFilter}
        onStatusChange={filterHook.setStatusFilter}
        statusOptions={[
          { value: "all", label: "All Status" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
          { value: "pending", label: "Pending" },
        ]}
        showProjectFilter={true}
        projectFilter={filterHook.filters.projectFilter}
        onProjectChange={filterHook.setProjectFilter}
        projectOptions={filterHook.dropdownOptions.projectOptions}
        showDistrictFilter={true}
        districtFilter={filterHook.filters.districtFilter}
        onDistrictChange={filterHook.setDistrictFilter}
        districtOptions={filterHook.dropdownOptions.districtOptions}
        showAreaFilter={true}
        areaFilter={filterHook.filters.areaFilter}
        onAreaChange={filterHook.setAreaFilter}
        areaOptions={filterHook.dropdownOptions.areaOptions}
        showUnitFilter={true}
        unitFilter={filterHook.filters.unitFilter}
        onUnitChange={filterHook.setUnitFilter}
        unitOptions={filterHook.dropdownOptions.unitOptions}
        showSchemeFilter={true}
        schemeFilter={filterHook.filters.schemeFilter}
        onSchemeChange={filterHook.setSchemeFilter}
        schemeOptions={filterHook.dropdownOptions.schemeOptions}
        showGenderFilter={true}
        genderFilter={filterHook.filters.genderFilter}
        onGenderChange={filterHook.setGenderFilter}
        showVerificationFilter={true}
        verificationFilter={filterHook.filters.verificationFilter}
        onVerificationChange={filterHook.setVerificationFilter}
        showDateFilters={true}
        fromDate={filterHook.filters.fromDate}
        onFromDateChange={filterHook.setFromDate}
        toDate={filterHook.filters.toDate}
        onToDateChange={filterHook.setToDate}
        showQuickDateFilter={true}
        quickDateFilter={filterHook.filters.quickDateFilter}
        onQuickDateFilterChange={filterHook.setQuickDateFilter}
        onClearFilters={filterHook.clearAllFilters}
      />
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading beneficiaries...</p>
              </div>
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">No beneficiaries found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Beneficiary</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Schemes</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Projects</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {beneficiaries.map((beneficiary) => {
                    // Extract unique schemes and projects
                    const schemes = beneficiary.applications.length > 0 && typeof beneficiary.applications[0] === 'object'
                      ? Array.from(new Set((beneficiary.applications as Application[])
                          .map(app => app.scheme && typeof app.scheme === 'object' ? app.scheme.name : null)
                          .filter(Boolean)))
                      : [];
                    const projects = beneficiary.applications.length > 0 && typeof beneficiary.applications[0] === 'object'
                      ? Array.from(new Set((beneficiary.applications as Application[])
                          .map(app => app.project && typeof app.project === 'object' ? app.project.name : null)
                          .filter(Boolean)))
                      : [];

                    return (
                      <tr key={beneficiary._id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{beneficiary.name}</div>
                          <div className="text-sm text-muted-foreground">{beneficiary.phone}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {beneficiary.source === 'interview' && (
                              <Badge variant="outline" className="text-xs">From Interview</Badge>
                            )}
                            {!beneficiary.isVerified && (
                              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                                Unverified
                              </Badge>
                            )}
                            {beneficiary.status === 'pending' && (
                              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                Pending
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>{beneficiary.district?.name || 'N/A'}</div>
                          <div className="text-xs text-muted-foreground">
                            {beneficiary.area?.name || 'N/A'}, {beneficiary.unit?.name || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {schemes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {schemes.slice(0, 2).map((scheme, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {scheme}
                                </Badge>
                              ))}
                              {schemes.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{schemes.length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {projects.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {projects.slice(0, 1).map((project, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {project}
                                </Badge>
                              ))}
                              {projects.length > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  +{projects.length - 1}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(beneficiary.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewBeneficiary(beneficiary)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canUpdateBeneficiaries && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditBeneficiary(beneficiary)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {!beneficiary.isVerified && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleVerifyBeneficiary(beneficiary)}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteBeneficiary(beneficiary)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {pagination.pages > 1 && (
        <div className="mt-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => filterHook.setCurrentPage(Math.max(1, filterHook.filters.currentPage - 1))}
                  className={filterHook.filters.currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {[...Array(pagination.pages)].map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    onClick={() => filterHook.setCurrentPage(i + 1)}
                    isActive={filterHook.filters.currentPage === i + 1}
                    className="cursor-pointer"
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => filterHook.setCurrentPage(Math.min(pagination.pages, filterHook.filters.currentPage + 1))}
                  className={filterHook.filters.currentPage === pagination.pages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default Beneficiaries;
