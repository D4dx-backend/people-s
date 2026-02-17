import { useState, useEffect } from "react";
import { Plus, Search, Filter, MoreHorizontal, Shield, Users, UserCheck, UserX, Loader2, AlertCircle, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { UserModal } from "@/components/modals/UserModal";
import { DeleteUserModal } from "@/components/modals/DeleteUserModal";
import { UserDetailsModal } from "@/components/modals/UserDetailsModal";
import { users as usersApi, locations, type User, type Location } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { useExport } from "@/hooks/useExport";
import ExportButton from "@/components/common/ExportButton";
import { userExportColumns } from "@/utils/exportColumns";

// Role color mapping
export const roleColors: Record<string, string> = {
  super_admin: "bg-red-100 text-red-800 border-red-200",
  state_admin: "bg-purple-100 text-purple-800 border-purple-200",
  district_admin: "bg-blue-100 text-blue-800 border-blue-200",
  area_admin: "bg-green-100 text-green-800 border-green-200",
  unit_admin: "bg-yellow-100 text-yellow-800 border-yellow-200",
  project_coordinator: "bg-orange-100 text-orange-800 border-orange-200",
  scheme_coordinator: "bg-pink-100 text-pink-800 border-pink-200",
  beneficiary: "bg-gray-100 text-gray-800 border-gray-200",
};

// Role display names
export const roleNames: Record<string, string> = {
  super_admin: "Super Admin",
  state_admin: "State Admin",
  district_admin: "District Admin",
  area_admin: "Area Admin",
  unit_admin: "Unit Admin",
  project_coordinator: "Project Coordinator",
  scheme_coordinator: "Scheme Coordinator",
  beneficiary: "Beneficiary",
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { hasAnyPermission, hasPermission } = useRBAC();
  
  // Permission checks
  const canViewUsers = hasAnyPermission(['users.read.all', 'users.read.regional']);
  const canCreateUsers = hasPermission('users.create');
  const canUpdateUsers = hasAnyPermission(['users.update.all', 'users.update.regional']);
  const canDeleteUsers = hasPermission('users.delete');
  
  const [userList, setUserList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [locationMap, setLocationMap] = useState<Map<string, Location>>(new Map());

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  const { exportCSV, exportPDF, printData, exporting } = useExport({
    apiCall: (params) => usersApi.export(params),
    filenamePrefix: 'users',
    pdfTitle: 'Users Report',
    pdfColumns: userExportColumns,
    getFilterParams: () => ({
      search: searchTerm || undefined,
      role: selectedRole !== 'all' ? selectedRole : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
    }),
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: any = {
        page: currentPage,
        limit: 10,
      };

      if (selectedRole !== "all") params.role = selectedRole;
      // Only filter by status if explicitly selected (not "all")
      if (selectedStatus === "active") {
        params.isActive = true;
      } else if (selectedStatus === "inactive") {
        params.isActive = false;
      }
      // If selectedStatus is "all", don't add isActive filter at all
      
      if (searchTerm) params.search = searchTerm;

      const response = await usersApi.getAll(params);
      
      if (response.success && response.data) {
        setUserList(response.data.users);
        setTotalPages(response.data.pagination.pages);
        setTotalItems(response.data.pagination.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await usersApi.getStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load user stats:', err);
    }
  };

  const loadLocations = async () => {
    try {
      setLoadingLocations(true);
      const response = await locations.getAll({ limit: 1000 });
      if (response.success && response.data) {
        const map = new Map<string, Location>();
        response.data.locations.forEach((loc: Location) => {
          // Store by both id and _id for compatibility (as strings)
          const id = loc.id || (loc as any)._id;
          const _id = (loc as any)._id || loc.id;
          
          if (id) {
            // Store as string
            map.set(String(id), loc);
            // Also store as original type if it's not already a string
            if (typeof id !== 'string') {
              map.set(id as any, loc);
            }
          }
          
          if (_id && String(_id) !== String(id)) {
            // Store as string
            map.set(String(_id), loc);
            // Also store as original type if it's not already a string
            if (typeof _id !== 'string') {
              map.set(_id as any, loc);
            }
          }
        });
        console.log('📍 Loaded locations:', map.size, 'locations');
        console.log('📍 Sample location keys:', Array.from(map.keys()).slice(0, 5));
        console.log('📍 Sample location (first):', response.data.locations[0]);
        setLocationMap(map);
      }
    } catch (err: any) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoadingLocations(false);
    }
  };

  // Load locations once on mount
  useEffect(() => {
    if (canViewUsers) {
      loadLocations();
      loadStats();
    }
  }, [canViewUsers]);

  // Load users when filters or page changes
  useEffect(() => {
    if (canViewUsers) {
      loadUsers();
    }
  }, [canViewUsers, currentPage, selectedRole, selectedStatus, searchTerm]);

  // Access denied check - must be after all hooks
  if (!canViewUsers) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
          <p className="text-muted-foreground">
            You don't have permission to view user management.
          </p>
        </div>
      </div>
    );
  }

  // Modal handlers
  const handleAddUser = () => {
    setSelectedUser(undefined);
    setModalMode("create");
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setModalMode("edit");
    setShowUserModal(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setShowDetailsModal(true);
  };

  const handleModalSave = () => {
    loadUsers();
    loadStats();
  };

  // Check if current user can manage a specific user
  const canManageUser = (targetUser: User) => {
    if (!currentUser) return false;
    
    // Super admin and state admin can manage everyone except themselves
    if (currentUser.role === 'super_admin' || currentUser.role === 'state_admin') {
      return currentUser.id !== targetUser.id;
    }
    
    // Role hierarchy check
    const roleHierarchy: Record<string, string[]> = {
      district_admin: ['area_admin', 'unit_admin', 'beneficiary'],
      area_admin: ['unit_admin', 'beneficiary'],
      unit_admin: ['beneficiary']
    };
    
    const managableRoles = roleHierarchy[currentUser.role] || [];
    return managableRoles.includes(targetUser.role);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper function to get location name from various formats
  const getLocationName = (location: any): string | null => {
    if (!location) return null;
    
    // If it's already a populated object with name
    if (typeof location === 'object' && location !== null) {
      return location.name || location.districtName || location.areaName || location.unitName || null;
    }
    
    // If it's a string/primitive ID, try to look it up in locationMap
    const locationId = String(location);
    const loc = locationMap.get(locationId) || locationMap.get(location);
    if (loc) {
      return loc.name;
    }
    
    return null;
  };

  // Helper function to get district/area/unit from user (checks both adminScope and profile.location)
  const getUserDistrict = (user: User) => {
    return user.adminScope?.district || user.profile?.location?.district;
  };

  const getUserArea = (user: User) => {
    return user.adminScope?.area || user.profile?.location?.area;
  };

  const getUserUnit = (user: User) => {
    return user.adminScope?.unit || user.profile?.location?.unit;
  };

  return (
    <div className="space-y-6">
      {/* Modals */}
      <UserModal
        open={showUserModal}
        onOpenChange={setShowUserModal}
        user={selectedUser}
        mode={modalMode}
        onSave={handleModalSave}
      />
      
      <DeleteUserModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        user={selectedUser}
        onDelete={handleModalSave}
      />

      <UserDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        user={selectedUser}
      />
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage system users and permissions</p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            onExportCSV={() => exportCSV()}
            onExportPDF={() => exportPDF()}
            onPrint={() => printData()}
            exporting={exporting}
          />
          <Button className="bg-gradient-primary shadow-glow" onClick={handleAddUser}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stats.overview.totalUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600">{stats.overview.activeUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
              <Shield className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-600">{stats.overview.verifiedUsers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Users</CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-600">
                {stats.overview.totalUsers - stats.overview.activeUsers}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedRole} onValueChange={setSelectedRole}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
            <SelectItem value="state_admin">State Admin</SelectItem>
            <SelectItem value="district_admin">District Admin</SelectItem>
            <SelectItem value="area_admin">Area Admin</SelectItem>
            <SelectItem value="unit_admin">Unit Admin</SelectItem>
            <SelectItem value="project_coordinator">Project Coordinator</SelectItem>
            <SelectItem value="scheme_coordinator">Scheme Coordinator</SelectItem>
            <SelectItem value="beneficiary">Beneficiary</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({userList.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading users...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : userList.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Users Found"
              description="No users match your current filters. Try adjusting your search criteria or creating a new user."
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userList.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={user.profile?.avatar} />
                              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                            </Avatar>
                            {/* Status indicator */}
                            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${user.isActive ? 'bg-green-500' : 'bg-gray-400'}`} title={user.isActive ? 'Active' : 'Inactive'} />
                            {user.isVerified && (
                              <div title="Verified">
                                <Shield className="absolute -top-1 -right-1 h-4 w-4 text-blue-600 bg-white rounded-full" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-muted-foreground">{user.phone}</p>
                              <span className="text-xs text-muted-foreground">•</span>
                              <Badge variant="outline" className={`text-xs h-5 ${roleColors[user.role] || roleColors.beneficiary}`}>
                                {roleNames[user.role] || user.role}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                       <TableCell>
                         {(() => {
                           const district = getUserDistrict(user);
                           if (!district) {
                             return <span className="text-sm text-muted-foreground">N/A</span>;
                           }
                           const locationName = getLocationName(district);
                           if (locationName) {
                             return <span className="text-sm font-medium">{locationName}</span>;
                           }
                           // If location is still loading and we have a district ID, show loading
                           if (loadingLocations) {
                             return <Loader2 className="h-3 w-3 animate-spin" />;
                           }
                           // If locations are loaded but we couldn't find it, show N/A
                           return <span className="text-sm text-muted-foreground">N/A</span>;
                         })()}
                       </TableCell>
                       <TableCell>
                         {(() => {
                           const area = getUserArea(user);
                           if (!area) {
                             return <span className="text-sm text-muted-foreground">N/A</span>;
                           }
                           const locationName = getLocationName(area);
                           if (locationName) {
                             return <span className="text-sm font-medium">{locationName}</span>;
                           }
                           // If location is still loading and we have an area ID, show loading
                           if (loadingLocations) {
                             return <Loader2 className="h-3 w-3 animate-spin" />;
                           }
                           // If locations are loaded but we couldn't find it, show N/A
                           return <span className="text-sm text-muted-foreground">N/A</span>;
                         })()}
                       </TableCell>
                       <TableCell>
                         {(() => {
                           const unit = getUserUnit(user);
                           if (!unit) {
                             return <span className="text-sm text-muted-foreground">N/A</span>;
                           }
                           const locationName = getLocationName(unit);
                           if (locationName) {
                             return <span className="text-sm font-medium">{locationName}</span>;
                           }
                           // If location is still loading and we have a unit ID, show loading
                           if (loadingLocations) {
                             return <Loader2 className="h-3 w-3 animate-spin" />;
                           }
                           // If locations are loaded but we couldn't find it, show N/A
                           return <span className="text-sm text-muted-foreground">N/A</span>;
                         })()}
                       </TableCell>
                      <TableCell>
                        <p className="text-sm">{formatDate(user.createdAt)}</p>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(user)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {canManageUser(user) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteUser(user)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalItems)} of {totalItems} users
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}