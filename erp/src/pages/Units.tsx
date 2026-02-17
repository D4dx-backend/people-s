import { useState, useEffect } from "react";
import { Plus, Building2, Edit, Trash2, Loader2, Search, Filter, X } from "lucide-react";
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

export default function Units() {
  const { toast } = useToast();
  const { hasPermission } = useRBAC();
  
  const canViewLocations = hasPermission('settings.read');
  const canUpdateLocations = hasPermission('settings.update');

  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => locations.export(params),
    filenamePrefix: 'units',
    pdfTitle: 'Units Report',
    pdfColumns: locationExportColumns,
    getFilterParams: () => ({
      type: 'unit',
      search: search || undefined,
      parent: selectedArea || undefined,
    }),
  });
  
  const [loading, setLoading] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [unitList, setUnitList] = useState<Location[]>([]);
  const [districtList, setDistrictList] = useState<Location[]>([]);
  const [areaList, setAreaList] = useState<Location[]>([]);
  const [filteredAreaList, setFilteredAreaList] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    if (canViewLocations) {
      loadDistricts();
      loadAllAreas();
      loadUnits();
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

  const loadAllAreas = async () => {
    try {
      setLoadingAreas(true);
      const response = await locations.getByType('area', { active: true });
      
      if (response.success) {
        const locations = Array.isArray(response.data?.locations) ? response.data.locations : [];
        setAreaList(locations);
        setFilteredAreaList(locations);
      }
    } catch (error) {
      console.error('Failed to load areas:', error);
    } finally {
      setLoadingAreas(false);
    }
  };

  const loadUnits = async (page = pagination.page, searchTerm = search, areaFilter = selectedArea) => {
    try {
      setLoading(true);
      const params: any = {
        type: 'unit',
        page,
        limit: pagination.limit,
        search: searchTerm || undefined
      };

      // Add area filter if selected
      if (areaFilter) {
        params.parent = areaFilter;
      }

      const response = await locations.getAll(params);

      if (response.success) {
        setUnitList(Array.isArray(response.data?.locations) ? response.data.locations : []);
        setPagination(prev => ({
          ...prev,
          page: response.data?.pagination?.page || 1,
          total: response.data?.pagination?.total || 0,
          pages: response.data?.pagination?.pages || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load units:', error);
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
          description: "Unit deleted successfully",
        });
        await loadUnits();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete unit. Please try again.",
        variant: "destructive",
      });
    }

    setSelectedLocation(null);
    setShowDeleteModal(false);
  };

  const handleSave = async () => {
    await loadUnits();
    setShowModal(false);
    setShowEditModal(false);
    setSelectedLocation(null);
  };

  const handleSearch = async (value: string) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadUnits(1, value, selectedArea);
  };

  const handleDistrictFilter = async (districtId: string) => {
    console.log('District selected:', districtId);
    setSelectedDistrict(districtId);
    setSelectedArea(''); // Clear area selection when district changes
    
    // Filter areas by selected district
    if (districtId) {
      const filtered = areaList.filter(area => {
        const matches = area.parent?.id === districtId;
        console.log(`Area ${area.name} parent:`, area.parent?.id, 'matches:', matches);
        return matches;
      });
      console.log('Filtered areas:', filtered.length, 'out of', areaList.length);
      setFilteredAreaList(filtered);
    } else {
      setFilteredAreaList(areaList);
    }
    
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadUnits(1, search, ''); // Clear area filter
  };

  const handleAreaFilter = async (areaId: string) => {
    setSelectedArea(areaId);
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadUnits(1, search, areaId);
  };

  const handleClearFilter = async () => {
    setSelectedDistrict('');
    setSelectedArea('');
    setFilteredAreaList(areaList);
    setPagination(prev => ({ ...prev, page: 1 }));
    await loadUnits(1, search, '');
  };

  const handlePageChange = async (page: number) => {
    setPagination(prev => ({ ...prev, page }));
    await loadUnits(page, search, selectedArea);
  };

  const handleItemsPerPageChange = async (limit: number) => {
    setPagination(prev => ({ ...prev, limit, page: 1 }));
    await loadUnits(1, search, selectedArea);
  };

  if (!canViewLocations) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view units.
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
        locationType="unit"
        onSave={handleSave}
      />
      <LocationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        locationType="unit"
        location={selectedLocation}
        mode="edit"
        onSave={handleSave}
      />
      <DeleteConfirmModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDeleteConfirm}
        title="Delete Unit"
        description="This will permanently delete this unit and all associated data. This action cannot be undone."
        itemName={selectedLocation?.name}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Units</h1>
          <p className="text-muted-foreground mt-1">Manage unit master data</p>
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
              Add Unit
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>Unit Master Data</CardTitle>
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

            {/* Area Filter */}
            <Select 
              value={selectedArea} 
              onValueChange={handleAreaFilter}
              disabled={loadingAreas || !selectedDistrict}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={!selectedDistrict ? "Select district first" : loadingAreas ? "Loading..." : filteredAreaList.length === 0 ? "No areas" : "Filter by Area"} />
              </SelectTrigger>
              <SelectContent>
                {filteredAreaList.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    {!selectedDistrict ? "Please select a district first" : "No areas available"}
                  </div>
                ) : (
                  filteredAreaList.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {(selectedDistrict || selectedArea) && (
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
                placeholder="Search units..."
                className="pl-10"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Active Filters Display */}
          {(selectedDistrict || selectedArea) && (
            <div className="flex gap-2">
              {selectedDistrict && (
                <Badge variant="secondary" className="gap-2">
                  District: {districtList.find(d => d.id === selectedDistrict)?.name}
                </Badge>
              )}
              {selectedArea && (
                <Badge variant="secondary" className="gap-2">
                  Area: {filteredAreaList.find(a => a.id === selectedArea)?.name}
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading units...</span>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {unitList.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border rounded-lg p-4 hover:shadow-elegant transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{unit.name}</h3>
                          <Badge className={unit.isActive ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
                            {unit.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Code: {unit.code} • Area: {unit.parent?.name}
                        </p>
                        {unit.contactPerson?.name && (
                          <p className="text-sm text-muted-foreground">
                            Admin: {unit.contactPerson.name}
                          </p>
                        )}
                        {unit.contactPerson?.phone && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {unit.contactPerson.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-xl font-bold">{unit.population || 0}</p>
                        <p className="text-xs text-muted-foreground">Population</p>
                      </div>
                      {canUpdateLocations && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(unit)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteClick(unit)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {unitList.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {search ? 'No units found matching your search.' : 'No units found. Create your first unit to get started.'}
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
