import React, { useState, useEffect } from 'react';
import { useRBAC } from '../../hooks/useRBAC';
import { PermissionGate } from './PermissionGate';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { 
  Users, 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

interface Role {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  level: number;
  category: string;
  type: 'system' | 'custom';
  permissions: Permission[];
  stats: {
    totalUsers: number;
    activeUsers: number;
  };
  constraints: {
    maxUsers?: number;
    requiresApproval: boolean;
    isDeletable: boolean;
    isModifiable: boolean;
  };
  isActive: boolean;
}

interface Permission {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  module: string;
  category: string;
  scope: string;
  securityLevel: string;
}

export const RoleManagement: React.FC = () => {
  const { hasPermission } = useRBAC();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) {
        throw new Error('VITE_API_URL environment variable is required');
      }
      const response = await fetch(`${API_BASE_URL}/rbac/roles`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch roles');

      const data = await response.json();
      setRoles(data.data || []);
    } catch (error) {
      toast.error('Failed to fetch roles');
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) {
        throw new Error('VITE_API_URL environment variable is required');
      }
      const response = await fetch(`${API_BASE_URL}/rbac/permissions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch permissions');

      const data = await response.json();
      setPermissions(data.data.permissions || []);
    } catch (error) {
      toast.error('Failed to fetch permissions');
      console.error('Error fetching permissions:', error);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const response = await fetch(`/api/rbac/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete role');
      }

      toast.success('Role deleted successfully');
      setRoles(roles.filter(r => r._id !== roleId));
      setDeleteRoleId(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete role');
      console.error('Error deleting role:', error);
    }
  };

  const getRoleBadgeColor = (role: Role) => {
    if (role.type === 'system') return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const getSecurityLevelColor = (level: string) => {
    const colors = {
      public: 'bg-gray-100 text-gray-800',
      internal: 'bg-blue-100 text-blue-800',
      confidential: 'bg-yellow-100 text-yellow-800',
      restricted: 'bg-orange-100 text-orange-800',
      top_secret: 'bg-red-100 text-red-800'
    };
    return colors[level as keyof typeof colors] || colors.internal;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading roles...</p>
        </div>
      </div>
    );
  }

  return (
    <PermissionGate permission="roles.read" showError>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Role Management</h1>
            <p className="text-muted-foreground">
              Manage user roles and permissions in the system
            </p>
          </div>
          <PermissionGate permission="roles.create">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Role
                </Button>
              </DialogTrigger>
              <CreateRoleDialog 
                permissions={permissions}
                onSuccess={() => {
                  fetchRoles();
                  setIsCreateDialogOpen(false);
                }}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </Dialog>
          </PermissionGate>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Roles</p>
                  <p className="text-2xl font-bold">{roles.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Settings className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">System Roles</p>
                  <p className="text-2xl font-bold">
                    {roles.filter(r => r.type === 'system').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Custom Roles</p>
                  <p className="text-2xl font-bold">
                    {roles.filter(r => r.type === 'custom').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Active Assignments</p>
                  <p className="text-2xl font-bold">
                    {roles.reduce((sum, role) => sum + (role.stats?.activeUsers || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Roles Table */}
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>
              Manage system and custom roles with their permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roles.map((role) => (
                <div key={role._id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{role.displayName}</h3>
                          <Badge className={getRoleBadgeColor(role)}>
                            {role.type}
                          </Badge>
                          {!role.isActive && (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {role.description}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          <span>Level: {role.level}</span>
                          <span>Category: {role.category}</span>
                          <span>Active Users: {role.stats?.activeUsers || 0}</span>
                          <span>Total Users: {role.stats?.totalUsers || 0}</span>
                          <span>Permissions: {role.permissions.length}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedRole(role)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <PermissionGate permission="roles.update">
                        {role.constraints.isModifiable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRole(role);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </PermissionGate>
                      <PermissionGate permission="roles.delete">
                        {role.constraints.isDeletable && role.type === 'custom' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteRoleId(role._id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </PermissionGate>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Details Dialog */}
        {selectedRole && (
          <Dialog open={!!selectedRole} onOpenChange={() => setSelectedRole(null)}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>{selectedRole.displayName}</span>
                  <Badge className={getRoleBadgeColor(selectedRole)}>
                    {selectedRole.type}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedRole.description}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="permissions">Permissions</TabsTrigger>
                  <TabsTrigger value="users">Users</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Role Name</Label>
                      <p className="text-sm font-mono bg-muted p-2 rounded">
                        {selectedRole.name}
                      </p>
                    </div>
                    <div>
                      <Label>Level</Label>
                      <p className="text-sm p-2">{selectedRole.level}</p>
                    </div>
                    <div>
                      <Label>Category</Label>
                      <p className="text-sm p-2 capitalize">{selectedRole.category}</p>
                    </div>
                    <div>
                      <Label>Active Users</Label>
                      <p className="text-sm p-2">{selectedRole.stats?.activeUsers || 0}</p>
                    </div>
                    <div>
                      <Label>Total Users</Label>
                      <p className="text-sm p-2">{selectedRole.stats?.totalUsers || 0}</p>
                    </div>
                  </div>

                  <div>
                    <Label>Constraints</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center space-x-2">
                        {selectedRole.constraints.isDeletable ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm">Deletable</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectedRole.constraints.isModifiable ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm">Modifiable</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectedRole.constraints.requiresApproval ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        <span className="text-sm">
                          {selectedRole.constraints.requiresApproval ? 'Requires Approval' : 'Auto Approved'}
                        </span>
                      </div>
                      {selectedRole.constraints.maxUsers && (
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="text-sm">Max Users: {selectedRole.constraints.maxUsers}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="permissions" className="space-y-4">
                  <div className="space-y-4">
                    {Object.entries(
                      selectedRole.permissions.reduce((acc, permission) => {
                        if (!acc[permission.module]) acc[permission.module] = [];
                        acc[permission.module].push(permission);
                        return acc;
                      }, {} as Record<string, Permission[]>)
                    ).map(([module, modulePermissions]) => (
                      <div key={module} className="border rounded-lg p-4">
                        <h4 className="font-semibold capitalize mb-3">{module}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {modulePermissions.map((permission) => (
                            <div key={permission._id} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div>
                                <p className="text-sm font-medium">{permission.displayName}</p>
                                <p className="text-xs text-muted-foreground">{permission.name}</p>
                              </div>
                              <Badge className={getSecurityLevelColor(permission.securityLevel)}>
                                {permission.securityLevel}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="users">
                  <RoleUsersTab roleId={selectedRole._id} />
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}

        {/* Edit Role Dialog */}
        {selectedRole && isEditDialogOpen && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <EditRoleDialog
              role={selectedRole}
              permissions={permissions}
              onSuccess={() => {
                fetchRoles();
                setIsEditDialogOpen(false);
                setSelectedRole(null);
              }}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedRole(null);
              }}
            />
          </Dialog>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteRoleId} onOpenChange={() => setDeleteRoleId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the role
                and remove it from all users who have been assigned this role.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteRoleId && handleDeleteRole(deleteRoleId)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Role
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGate>
  );
};

// Create Role Dialog Component
interface CreateRoleDialogProps {
  permissions: Permission[];
  onSuccess: () => void;
  onCancel: () => void;
}

const CreateRoleDialog: React.FC<CreateRoleDialogProps> = ({ 
  permissions, 
  onSuccess, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    level: 5,
    category: 'staff',
    permissions: [] as string[]
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) {
        throw new Error('VITE_API_URL environment variable is required');
      }
      const response = await fetch(`${API_BASE_URL}/rbac/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to create role');

      toast.success('Role created successfully');
      onSuccess();
    } catch (error) {
      toast.error('Failed to create role');
      console.error('Error creating role:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Create New Role</DialogTitle>
        <DialogDescription>
          Create a custom role with specific permissions
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Role Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., custom_coordinator"
              required
            />
          </div>
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="e.g., Custom Coordinator"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the role's responsibilities..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="level">Level</Label>
            <Input
              id="level"
              type="number"
              min="1"
              max="10"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
              required
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="coordinator">Coordinator</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Permissions</Label>
          <div className="max-h-60 overflow-y-auto border rounded p-4 space-y-2">
            {Object.entries(
              permissions.reduce((acc, permission) => {
                if (!acc[permission.module]) acc[permission.module] = [];
                acc[permission.module].push(permission);
                return acc;
              }, {} as Record<string, Permission[]>)
            ).map(([module, modulePermissions]) => (
              <div key={module} className="space-y-2">
                <h4 className="font-medium capitalize">{module}</h4>
                {modulePermissions.map((permission) => (
                  <div key={permission._id} className="flex items-center space-x-2 ml-4">
                    <Checkbox
                      id={permission._id}
                      checked={formData.permissions.includes(permission._id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            permissions: [...formData.permissions, permission._id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            permissions: formData.permissions.filter(id => id !== permission._id)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={permission._id} className="text-sm">
                      {permission.displayName}
                    </Label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Role'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

// Edit Role Dialog Component
interface EditRoleDialogProps {
  role: Role;
  permissions: Permission[];
  onSuccess: () => void;
  onCancel: () => void;
}

const EditRoleDialog: React.FC<EditRoleDialogProps> = ({ 
  role, 
  permissions, 
  onSuccess, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    displayName: role.displayName,
    description: role.description,
    permissions: role.permissions.map(p => p._id)
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/rbac/roles/${role._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to update role');

      toast.success('Role updated successfully');
      onSuccess();
    } catch (error) {
      toast.error('Failed to update role');
      console.error('Error updating role:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Role: {role.displayName}</DialogTitle>
        <DialogDescription>
          Modify role details and permissions
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <div>
          <Label>Permissions</Label>
          <div className="max-h-60 overflow-y-auto border rounded p-4 space-y-2">
            {Object.entries(
              permissions.reduce((acc, permission) => {
                if (!acc[permission.module]) acc[permission.module] = [];
                acc[permission.module].push(permission);
                return acc;
              }, {} as Record<string, Permission[]>)
            ).map(([module, modulePermissions]) => (
              <div key={module} className="space-y-2">
                <h4 className="font-medium capitalize">{module}</h4>
                {modulePermissions.map((permission) => (
                  <div key={permission._id} className="flex items-center space-x-2 ml-4">
                    <Checkbox
                      id={permission._id}
                      checked={formData.permissions.includes(permission._id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            permissions: [...formData.permissions, permission._id]
                          });
                        } else {
                          setFormData({
                            ...formData,
                            permissions: formData.permissions.filter(id => id !== permission._id)
                          });
                        }
                      }}
                    />
                    <Label htmlFor={permission._id} className="text-sm">
                      {permission.displayName}
                    </Label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update Role'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

// Role Users Tab Component
interface RoleUsersTabProps {
  roleId: string;
}

interface RoleUser {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  isActive: boolean;
  isPrimary: boolean;
  isTemporary: boolean;
  assignedAt: string;
  validUntil?: string;
  assignedBy: {
    name: string;
  };
}

const RoleUsersTab: React.FC<RoleUsersTabProps> = ({ roleId }) => {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoleUsers();
  }, [roleId]);

  const fetchRoleUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/rbac/roles/${roleId}/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.data || []);
    } catch (error: any) {
      setError(error.message || 'Failed to load users');
      console.error('Error fetching role users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading users...</p>
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

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          No users have been assigned this role yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground mb-4">
        {users.length} {users.length === 1 ? 'user' : 'users'} assigned to this role
      </div>
      
      <div className="space-y-2">
        {users.map((user) => (
          <div key={user._id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium">{user.name}</h4>
                  {user.isPrimary && (
                    <Badge className="bg-blue-100 text-blue-800">Primary</Badge>
                  )}
                  {user.isTemporary && (
                    <Badge className="bg-yellow-100 text-yellow-800">Temporary</Badge>
                  )}
                  {!user.isActive && (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                  <span>{user.phone}</span>
                  {user.email && <span>{user.email}</span>}
                </div>
                <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                  <span>
                    Assigned: {new Date(user.assignedAt).toLocaleDateString()}
                  </span>
                  {user.validUntil && (
                    <span>
                      Valid Until: {new Date(user.validUntil).toLocaleDateString()}
                    </span>
                  )}
                  <span>By: {user.assignedBy.name}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};