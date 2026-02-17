import { useState, useEffect } from "react";
import { Plus, Map, Edit, Trash2, Loader2, Search } from "lucide-react";
import { locations, type Location } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { LocationModal } from "@/components/modals/LocationModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdvancedPagination } from "@/components/ui/pagination";
import { useRBAC } from "@/hooks/useRBAC";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/common/ExportButton";
import { locationExportColumns } from "@/utils/exportColumns";

export default function Districts() {
  const { toast } = useToast();
  const { hasPermission } = useRBAC();
  
  const canViewLocations = hasPermission('settings.read');
  const canUpdateLocations = hasPermission('settings.update');

  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => locations.export(params),
    filenamePrefix: 'districts',
    pdfTitle: 'Districts Report',
    pdfColumns: locationExportColumns,
    getFilterParams: () => ({
      type: 'district',
      search: search || undefined,
    }),
  });
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [districtList, setDistrictList] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    if (canViewLocations) {
      loadDistricts();
    }
  }, [canViewLocations]);

  const loadDistricts = async (page = pagination.page, searchTerm = search) => {
    try {
      setLoading(true);
      const response = await locations.getAll({
        type: 'district',
        page,
        limit: pagination.limit,
        search: searchTerm || undefined
      });

      if (response.success) {
        setDistrictList(Array.isArray(response.data?.locations) ? response.data.locations : []);
        setPagination(prev => ({
          ...prev,
          page: response.data?.pagination?.page || 1,
          total: response.data?.pagination?.total || 0,
          pages: response.data?.pagination?.pages || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load districts:', error);
      toast({
        title: "Error",
        description: "Failed to load districts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (location: Location) => {
    setSelectedLocation(location);
    setShowEditModal(true);
  };

  const handleDeleteClick = (location: Location) => {
    setSelectedLocation(location);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedLocation) return;

    try {
      const response = await locations.delete(selectedLocation.id);

      if (response.success) {
        toast({
          title: "Success",
          description: "District deleted successfully",
        });
        await loadDistricts();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete district. Please try again.",
        variant: "destructive",
      });
    }

    setSelectedLocation(null);
    setShowDeleteModal(false);
  };

  const handleSave = async () => {
    await loadDistricts();
    setShowModal(false);
    setShowEditModal(false);
    setSelectedLocation(null);
  };

  const handleSearch = async (value: string) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadDistricts(1, value);
  };

  const handlePageChange = async (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    await loadDistricts(page, search);
  };

  const handleItemsPerPageChange = async (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
    await loadDistricts(1, search);
  };

  if (!canViewLocations) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Map className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view districts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LocationModal
        open={showModal}
        onOpenChange={setShowModal}
        mode="create"
        locationType="district"
        onSave={handleSave}
      />
      <LocationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        locationType="district"
        location={selectedLocation}
        mode="edit"
        onSave={handleSave}
      />
      <DeleteConfirmModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDeleteConfirm}
        title="Delete District"
        description="This will permanently delete this district and all associated data. This action cannot be undone."
        itemName={selectedLocation?.name}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Districts</h1>
          <p className="text-muted-foreground mt-1">Manage district master data</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            onExportCSV={() => exportCSV()}
            onExportPDF={() => exportPDF()}
            onPrint={() => printData()}
            exporting={exporting}
          />
          {canUpdateLocations && (
            <Button className="bg-gradient-primary shadow-glow" onClick={() => setShowModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add District
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>District Master Data</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search districts..."
                className="pl-10"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading districts...</span>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {districtList.map((district) => (
                  <div
                    key={district.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border rounded-lg p-4 hover:shadow-elegant transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                        {district.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{district.name}</h3>
                          <Badge className={district.isActive ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                            {district.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Code: {district.code}
                        </p>
                        {district.contactPerson?.name && (
                          <p className="text-sm text-muted-foreground">
                            Admin: {district.contactPerson.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-xl font-bold">{district.childrenCount || 0}</p>
                        <p className="text-xs text-muted-foreground">Areas</p>
                      </div>
                      {canUpdateLocations && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(district)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteClick(district)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {districtList.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {search ? 'No districts found matching your search.' : 'No districts found. Create your first district to get started.'}
                  </div>
                )}
              </div>

              {pagination.pages > 1 && (
                <AdvancedPagination
                  currentPage={pagination.page}
                  totalPages={pagination.pages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  className="mt-4"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
