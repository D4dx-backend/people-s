import { useState, useEffect } from "react";
import { Plus, MapPin, Edit, Trash2, Loader2, Search, Filter, X } from "lucide-react";
import { locations, type Location } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { LocationModal } from "@/components/modals/LocationModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdvancedPagination } from "@/components/ui/pagination";
import { useRBAC } from "@/hooks/useRBAC";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/common/ExportButton";
import { locationExportColumns } from "@/utils/exportColumns";

export default function Areas() {
  const { toast } = useToast();
  const { hasPermission } = useRBAC();
  
  const canViewLocations = hasPermission('settings.read');
  const canUpdateLocations = hasPermission('settings.update');

  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => locations.export(params),
    filenamePrefix: 'areas',
    pdfTitle: 'Areas Report',
    pdfColumns: locationExportColumns,
    getFilterParams: () => ({
      type: 'area',
      search: search || undefined,
      parent: selectedDistrict || undefined,
    }),
  });
  
  const [loading, setLoading] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [areaList, setAreaList] = useState<Location[]>([]);
  const [districtList, setDistrictList] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    if (canViewLocations) {
      loadDistricts();
      loadAreas();
    }
  }, [canViewLocations]);

  const loadDistricts = async () => {
    try {
      setLoadingDistricts(true);
      const response = await locations.getByType('district', { active: true });
      
      if (response.success) {
        setDistrictList(Array.isArray(response.data?.locations) ? response.data.locations : []);
      }
    } catch (error) {
      console.error('Failed to load districts:', error);
    } finally {
      setLoadingDistricts(false);
    }
  };

  const loadAreas = async (page = pagination.page, searchTerm = search, districtFilter = selectedDistrict) => {
    try {
      setLoading(true);
      const params: any = {
        type: 'area',
        page,
        limit: pagination.limit,
        search: searchTerm || undefined
      };

      // Add district filter if selected
      if (districtFilter) {
        params.parent = districtFilter;
      }

      const response = await locations.getAll(params);

      if (response.success) {
        setAreaList(Array.isArray(response.data?.locations) ? response.data.locations : []);
        setPagination(prev => ({
          ...prev,
          page: response.data?.pagination?.page || 1,
          total: response.data?.pagination?.total || 0,
          pages: response.data?.pagination?.pages || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load areas:', error);
      toast({
        title: "Error",
        description: "Failed to load areas. Please try again.",
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
          description: "Area deleted successfully",
        });
        await loadAreas();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete area. Please try again.",
        variant: "destructive",
      });
    }

    setSelectedLocation(null);
    setShowDeleteModal(false);
  };

  const handleSave = async () => {
    await loadAreas();
    setShowModal(false);
    setShowEditModal(false);
    setSelectedLocation(null);
  };

  const handleSearch = async (value: string) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadAreas(1, value, selectedDistrict);
  };

  const handleDistrictFilter = async (districtId: string) => {
    setSelectedDistrict(districtId);
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadAreas(1, search, districtId);
  };

  const handleClearFilter = async () => {
    setSelectedDistrict('');
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadAreas(1, search, '');
  };

  const handlePageChange = async (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    await loadAreas(page, search, selectedDistrict);
  };

  const handleItemsPerPageChange = async (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
    await loadAreas(1, search, selectedDistrict);
  };

  if (!canViewLocations) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view areas.
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
        locationType="area"
        onSave={handleSave}
      />
      <LocationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        locationType="area"
        location={selectedLocation}
        mode="edit"
        onSave={handleSave}
      />
      <DeleteConfirmModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDeleteConfirm}
        title="Delete Area"
        description="This will permanently delete this area and all associated data. This action cannot be undone."
        itemName={selectedLocation?.name}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Areas</h1>
          <p className="text-muted-foreground mt-1">Manage area master data</p>
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
              Add Area
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>Area Master Data</CardTitle>
          </div>
          
          {/* Filters Row */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            
            {/* District Filter */}
            <Select 
              value={selectedDistrict} 
              onValueChange={handleDistrictFilter}
              disabled={loadingDistricts}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={loadingDistricts ? "Loading..." : districtList.length === 0 ? "No districts" : "Filter by District"} />
              </SelectTrigger>
              <SelectContent>
                {districtList.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No districts available</div>
                ) : (
                  districtList.map((district) => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedDistrict && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearFilter}
                className="h-9 px-3"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            {/* Search */}
            <div className="relative flex-1 max-w-sm ml-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search areas..."
                className="pl-10"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Active Filter Display */}
          {selectedDistrict && (
            <div className="flex gap-2">
              <Badge variant="secondary" className="gap-2">
                District: {districtList.find(d => d.id === selectedDistrict)?.name}
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading areas...</span>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {areaList.map((area) => (
                  <div
                    key={area.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border rounded-lg p-4 hover:shadow-elegant transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-secondary flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-secondary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{area.name}</h3>
                          <Badge className={area.isActive ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                            {area.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Code: {area.code} • District: {area.parent?.name}
                        </p>
                        {area.contactPerson?.name && (
                          <p className="text-sm text-muted-foreground">
                            Admin: {area.contactPerson.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-xl font-bold">{area.childrenCount || 0}</p>
                        <p className="text-xs text-muted-foreground">Units</p>
                      </div>
                      {canUpdateLocations && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(area)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteClick(area)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {areaList.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {search ? 'No areas found matching your search.' : 'No areas found. Create your first area to get started.'}
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
