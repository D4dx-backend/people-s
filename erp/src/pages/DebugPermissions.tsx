import { useEffect, useState } from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function DebugPermissions() {
  const { user, token } = useAuth();
  const { userPermissions, userRoles, hasPermission, refreshPermissions, isLoading } = useRBAC();
  const [apiResponse, setApiResponse] = useState<any>(null);

  const fetchDirectly = async () => {
    if (!user || !token) return;
    
    try {
      const response = await fetch(`/api/rbac/users/${user.id}/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setApiResponse(data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setApiResponse({ error: error.message });
    }
  };

  useEffect(() => {
    fetchDirectly();
  }, [user, token]);

  const handleRefresh = async () => {
    await refreshPermissions();
    await fetchDirectly();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Permission Debug</h1>
        <Button onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Permissions
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Info</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Roles ({userRoles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(userRoles, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Permissions ({userPermissions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Donor Permissions:</h3>
              <div className="space-y-1">
                {['donors.read', 'donors.create', 'donors.update.regional', 'donors.delete', 'donors.verify'].map(perm => (
                  <div key={perm} className="flex items-center gap-2">
                    <span className={hasPermission(perm) ? 'text-green-600' : 'text-red-600'}>
                      {hasPermission(perm) ? '✅' : '❌'}
                    </span>
                    <span>{perm}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">All Permissions:</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(userPermissions, null, 2)}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direct API Response</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(apiResponse, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Local Storage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <h3 className="font-semibold">Auth Token:</h3>
              <p className="text-sm text-gray-600 break-all">{localStorage.getItem('token')?.substring(0, 50)}...</p>
            </div>
            <div>
              <h3 className="font-semibold">User Data:</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
                {localStorage.getItem('user')}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold">All Local Storage Keys:</h3>
              <ul className="list-disc list-inside">
                {Object.keys(localStorage).map(key => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            variant="destructive"
          >
            Clear Local Storage & Logout
          </Button>
          <Button 
            onClick={() => {
              window.location.href = '/donors';
            }}
            variant="outline"
          >
            Go to Donors Page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
