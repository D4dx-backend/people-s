import { useState, useEffect } from "react";
import { Plus, MapPin, Building2, Map, Users, Edit, Trash2, ChevronDown, Loader2 } from "lucide-react";
import { locations, type Location } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { LocationModal } from "@/components/modals/LocationModal";
import { DeleteConfirmModal } from "@/components/modals/DeleteConfirmModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdvancedPagination } from "@/components/ui/pagination";
import { Search } from "lucide-react";
import { useRBAC } from "@/hooks/useRBAC";

export default function Locations() {
  const { toast } = useToast();
  const { hasPermission } = useRBAC();
  
  // Permission checks
  const canViewLocations = hasPermission('settings.read');
  const canUpdateLocations = hasPermission('settings.update');
  
  const [loading, setLoading] = useState(true);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [editType, setEditType] = useState<'district' | 'area' | 'unit'>('district');
  const [deleteType, setDeleteType] = useState<'district' | 'area' | 'unit'>('district');

  // Access denied check
  if (!canViewLocations) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view locations.
          </p>
        </div>
      </div>
    );
  }

  // Real data from API
  const [districtList, setDistrictList] = useState<Location[]>([]);
  const [areaList, setAreaList] = useState<Location[]>([]);
  const [unitList, setUnitList] = useState<Location[]>([]);
  const [stats, setStats] = useState({
    totalDistricts: 0,
    totalAreas: 0,
    totalUnits: 0
  });

  // Pagination state
  const [districtPagination, setDistrictPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [areaPagination, setAreaPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [unitPagination, setUnitPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Search state
  const [districtSearch, setDistrictSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');

  // Load data on component mount
  useEffect(() => {
    loadLocationData();
  }, []);

  const loadLocationData = async () => {
    try {
      setLoading(true);

      // Load stats first
      const statsRes = await locations.getStats();
      if (statsRes.success) {
        const statsByType = statsRes.data?.byType || [];
        setStats({
          totalDistricts: statsByType.find(s => s._id === 'district')?.count || 0,
          totalAreas: statsByType.find(s => s._id === 'area')?.count || 0,
          totalUnits: statsByType.find(s => s._id === 'unit')?.count || 0
        });
      }

      // Load paginated data
      await Promise.all([
        loadDistricts(),
        loadAreas(),
        loadUnits()
      ]);
    } catch (error) {
      console.error('Failed to load location data:', error);
      toast({
        title: "Error",
        description: "Failed to load location data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDistricts = async (page = districtPagination.page, search = districtSearch) => {
    try {
      const response = await locations.getAll({
        type: 'district',
        page,
        limit: districtPagination.limit,
        search: search || undefined
      });

      if (response.success) {
        setDistrictList(Array.isArray(response.data?.locations) ? response.data.locations : []);
        setDistrictPagination(prev => ({
          ...prev,
          page: response.data?.pagination?.page || 1,
          total: response.data?.pagination?.total || 0,
          pages: response.data?.pagination?.pages || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load districts:', error);
    }
  };

  const loadAreas = async (page = areaPagination.page, search = areaSearch) => {
    try {
      const response = await locations.getAll({
        type: 'area',
        page,
        limit: areaPagination.limit,
        search: search || undefined
      });

      if (response.success) {
        setAreaList(Array.isArray(response.data?.locations) ? response.data.locations : []);
        setAreaPagination(prev => ({
          ...prev,
          page: response.data?.pagination?.page || 1,
          total: response.data?.pagination?.total || 0,
          pages: response.data?.pagination?.pages || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load areas:', error);
    }
  };

  const loadUnits = async (page = unitPagination.page, search = unitSearch) => {
    try {
      const response = await locations.getAll({
        type: 'unit',
        page,
        limit: unitPagination.limit,
        search: search || undefined
      });

      if (response.success) {
        setUnitList(Array.isArray(response.data?.locations) ? response.data.locations : []);
        setUnitPagination(prev => ({
          ...prev,
          page: response.data?.pagination?.page || 1,
          total: response.data?.pagination?.total || 0,
          pages: response.data?.pagination?.pages || 0
        }));
      }
    } catch (error) {
      console.error('Failed to load units:', error);
    }
  };

  const handleEdit = (location: Location, type: 'district' | 'area' | 'unit') => {
    setSelectedLocation(location);
    setEditType(type);
    setShowEditModal(true);
  };

  const handleDeleteClick = (location: Location, type: 'district' | 'area' | 'unit') => {
    setSelectedLocation(location);
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedLocation) return;

    try {
      const response = await locations.delete(selectedLocation.id);

      if (response.success) {
        toast({
          title: "Success",
          description: `${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)} deleted successfully`,
        });

        // Reload data to reflect changes
        await loadLocationData();
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: `Failed to delete ${deleteType}. Please try again.`,
        variant: "destructive",
      });
    }

    setSelectedLocation(null);
    setShowDeleteModal(false);
  };

  const handleSave = async () => {
    // Reload data after any changes
    await loadLocationData();

    setShowDistrictModal(false);
    setShowAreaModal(false);
    setShowUnitModal(false);
    setShowEditModal(false);
    setSelectedLocation(null);
  };

  // Search handlers
  const handleDistrictSearch = async (value: string) => {
    setDistrictSearch(value);
    setDistrictPagination(prev => ({ ...prev, page: 1 }));
    await loadDistricts(1, value);
  };

  const handleAreaSearch = async (value: string) => {
    setAreaSearch(value);
    setAreaPagination(prev => ({ ...prev, page: 1 }));
    await loadAreas(1, value);
  };

  const handleUnitSearch = async (value: string) => {
    setUnitSearch(value);
    setUnitPagination(prev => ({ ...prev, page: 1 }));
    await loadUnits(1, value);
  };

  // Pagination handlers
  const handleDistrictPageChange = async (page: number) => {
    setDistrictPagination(prev => ({ ...prev, page }));
    await loadDistricts(page, districtSearch);
  };

  const handleDistrictItemsPerPageChange = async (limit: number) => {
    setDistrictPagination(prev => ({ ...prev, limit, page: 1 }));
    await loadDistricts(1, districtSearch);
  };

  const handleAreaPageChange = async (page: number) => {
    setAreaPagination(prev => ({ ...prev, page }));
    await loadAreas(page, areaSearch);
  };

  const handleAreaItemsPerPageChange = async (limit: number) => {
    setAreaPagination(prev => ({ ...prev, limit, page: 1 }));
    await loadAreas(1, areaSearch);
  };

  const handleUnitPageChange = async (page: number) => {
    setUnitPagination(prev => ({ ...prev, page }));
    await loadUnits(page, unitSearch);
  };

  const handleUnitItemsPerPageChange = async (limit: number) => {
    setUnitPagination(prev => ({ ...prev, limit, page: 1 }));
    await loadUnits(1, unitSearch);
  };

  return (
    <div className="space-y-6">
      <LocationModal
        open={showDistrictModal}
        onOpenChange={setShowDistrictModal}
        mode="create"
        locationType="district"
        onSave={handleSave}
      />
      <LocationModal
        open={showAreaModal}
        onOpenChange={setShowAreaModal}
        mode="create"
        locationType="area"
        onSave={handleSave}
      />
      <LocationModal
        open={showUnitModal}
        onOpenChange={setShowUnitModal}
        mode="create"
        locationType="unit"
        onSave={handleSave}
      />
      <LocationModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        locationType={editType}
        location={selectedLocation}
        mode="edit"
        onSave={handleSave}
      />
      <DeleteConfirmModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${deleteType.charAt(0).toUpperCase() + deleteType.slice(1)}`}
        description={`This will permanently delete this ${deleteType} and all associated data. This action cannot be undone.`}
        itemName={selectedLocation?.name}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">Location Management</h1>
          <p className="text-muted-foreground mt-1">Manage districts, areas, and units across Kerala</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-gradient-primary shadow-glow">
              <Plus className="mr-2 h-4 w-4" />
              Add Location
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setShowDistrictModal(true)}>
              <Map className="mr-2 h-4 w-4" />
              Add District
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowAreaModal(true)}>
              <MapPin className="mr-2 h-4 w-4" />
              Add Area
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowUnitModal(true)}>
              <Building2 className="mr-2 h-4 w-4" />
              Add Unit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading locations...</span>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Districts</p>
                    <p className="text-xl font-bold">{stats.totalDistricts}</p>
                  </div>
                  <div className="rounded-full bg-gradient-primary p-3">
                    <Map className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Areas</p>
                    <p className="text-xl font-bold">{stats.totalAreas}</p>
                  </div>
                  <div className="rounded-full bg-gradient-secondary p-3">
                    <MapPin className="h-6 w-6 text-secondary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Units</p>
                    <p className="text-xl font-bold">{stats.totalUnits}</p>
                  </div>
                  <div className="rounded-full bg-gradient-primary p-3">
                    <Building2 className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Tabs defaultValue="districts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="districts">Districts</TabsTrigger>
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>

        <TabsContent value="districts">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>District Master Data</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search districts..."
                    className="pl-10"
                    value={districtSearch}
                    onChange={(e) => handleDistrictSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        <p className="text-xl font-bold">{areaList.filter(a => a.parent?.id === district.id).length}</p>
                        <p className="text-xs text-muted-foreground">Areas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold">{district.childrenCount || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Children</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(district, 'district')}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteClick(district, 'district')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {districtList.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    {districtSearch ? 'No districts found matching your search.' : 'No districts found. Create your first district to get started.'}
                  </div>
                )}
              </div>

              {districtPagination.pages > 1 && (
                <AdvancedPagination
                  currentPage={districtPagination.page}
                  totalPages={districtPagination.pages}
                  totalItems={districtPagination.total}
                  itemsPerPage={districtPagination.limit}
                  onPageChange={handleDistrictPageChange}
                  onItemsPerPageChange={handleDistrictItemsPerPageChange}
                  className="mt-4"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="areas">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Area Master Data</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search areas..."
                    className="pl-10"
                    value={areaSearch}
                    onChange={(e) => handleAreaSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                        <p className="text-xl font-bold">{unitList.filter(u => u.parent?.id === area.id).length}</p>
                        <p className="text-xs text-muted-foreground">Units</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold">{area.childrenCount || 0}</p>
                        <p className="text-xs text-muted-foreground">Total Children</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(area, 'area')}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteClick(area, 'area')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {areaList.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    {areaSearch ? 'No areas found matching your search.' : 'No areas found. Create your first area to get started.'}
                  </div>
                )}
              </div>

              {areaPagination.pages > 1 && (
                <AdvancedPagination
                  currentPage={areaPagination.page}
                  totalPages={areaPagination.pages}
                  totalItems={areaPagination.total}
                  itemsPerPage={areaPagination.limit}
                  onPageChange={handleAreaPageChange}
                  onItemsPerPageChange={handleAreaItemsPerPageChange}
                  className="mt-4"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="units">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Unit Master Data</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search units..."
                    className="pl-10"
                    value={unitSearch}
                    onChange={(e) => handleUnitSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(unit, 'unit')}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDeleteClick(unit, 'unit')}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {unitList.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    {unitSearch ? 'No units found matching your search.' : 'No units found. Create your first unit to get started.'}
                  </div>
                )}
              </div>

              {unitPagination.pages > 1 && (
                <AdvancedPagination
                  currentPage={unitPagination.page}
                  totalPages={unitPagination.pages}
                  totalItems={unitPagination.total}
                  itemsPerPage={unitPagination.limit}
                  onPageChange={handleUnitPageChange}
                  onItemsPerPageChange={handleUnitItemsPerPageChange}
                  className="mt-4"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
