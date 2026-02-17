import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { User, Lock, Save, Eye, EyeOff, Shield } from "lucide-react";

const Profile = () => {
  const { user, updateUser } = useAuth();

  // Profile form state  
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    dateOfBirth: "",
    gender: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasExistingPassword, setHasExistingPassword] = useState(true);

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await auth.getProfile();
        if (response.success && response.data?.user) {
          const u = response.data.user;
          setProfileForm({
            name: u.name || "",
            email: u.email || "",
            dateOfBirth: u.profile?.dateOfBirth ? new Date(u.profile.dateOfBirth).toISOString().split("T")[0] : "",
            gender: u.profile?.gender || "",
          });
          // If the user was created via OTP-only, they might not have a password
          // We can't know for sure from the frontend, so we default to showing the field
          // The backend will handle the logic gracefully
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      }
    };
    loadProfile();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      const updateData: any = {
        name: profileForm.name,
        email: profileForm.email || undefined,
      };

      if (profileForm.dateOfBirth) {
        updateData.profile = {
          ...(profileForm.gender && { gender: profileForm.gender }),
          dateOfBirth: profileForm.dateOfBirth,
        };
      } else if (profileForm.gender) {
        updateData.profile = { gender: profileForm.gender };
      }

      const response = await auth.updateProfile(updateData);

      if (response.success) {
        // Update local auth state
        updateUser({
          name: profileForm.name,
          email: profileForm.email,
        });

        toast({
          title: "പ്രൊഫൈൽ അപ്ഡേറ്റ് ചെയ്തു",
          description: "നിങ്ങളുടെ പ്രൊഫൈൽ വിവരങ്ങൾ വിജയകരമായി അപ്ഡേറ്റ് ചെയ്തു.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "പ്രൊഫൈൽ അപ്ഡേറ്റ് ചെയ്യാൻ സാധിച്ചില്ല.",
        variant: "destructive",
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "പുതിയ പാസ്‌വേർഡ് കുറഞ്ഞത് 6 അക്ഷരമെങ്കിലും ഉണ്ടായിരിക്കണം.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "പുതിയ പാസ്‌വേർഡും കൺഫേം പാസ്‌വേർഡും ഒന്നല്ല.",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);

    try {
      const currentPwd = passwordForm.currentPassword || null;
      const response = await auth.changePassword(currentPwd, passwordForm.newPassword);

      if (response.success) {
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setHasExistingPassword(true); // Now they definitely have a password

        toast({
          title: "പാസ്‌വേർഡ് മാറ്റി",
          description: "നിങ്ങളുടെ പാസ്‌വേർഡ് വിജയകരമായി മാറ്റി.",
        });
      }
    } catch (error: any) {
      const msg = error.message || "പാസ്‌വേർഡ് മാറ്റാൻ സാധിച്ചില്ല.";
      // If backend says current password is required, user has an existing password
      if (msg.includes("Current password is required")) {
        setHasExistingPassword(true);
      }
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-lg font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          നിങ്ങളുടെ പ്രൊഫൈൽ വിവരങ്ങൾ മാനേജ് ചെയ്യുക, പാസ്‌വേർഡ് മാറ്റുക
        </p>
      </div>

      {/* User Info Banner */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user?.name || "User"}</h2>
              <p className="text-sm text-muted-foreground capitalize">{user?.role?.replace(/_/g, " ")}</p>
              <p className="text-sm text-muted-foreground">{user?.phone}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Edit Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            നിങ്ങളുടെ അടിസ്ഥാന വിവരങ്ങൾ അപ്ഡേറ്റ് ചെയ്യുക
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="Enter your name"
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={profileForm.dateOfBirth}
                  onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={profileForm.gender}
                  onValueChange={(value) => setProfileForm({ ...profileForm, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={profileLoading}>
                <Save className="mr-2 h-4 w-4" />
                {profileLoading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            നിങ്ങളുടെ അക്കൗണ്ട് സുരക്ഷ ഉറപ്പാക്കാൻ പാസ്‌വേർഡ് മാറ്റുക
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-1 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Enter current password (leave empty if not set)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ആദ്യമായി പാസ്‌വേർഡ് സെറ്റ് ചെയ്യുകയാണെങ്കിൽ ഈ ഫീൽഡ് ശൂന്യമായി വിടാം
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password *</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={passwordLoading}>
                <Lock className="mr-2 h-4 w-4" />
                {passwordLoading ? "Changing..." : "Change Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
