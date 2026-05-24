import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Phone, ArrowLeft, UserCircle, Shield, Loader2, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { auth } from "@/lib/api";
import { useAuth, type FranchiseOption, type RoleOption } from "@/hooks/useAuth";
import { useConfig } from "@/contexts/ConfigContext";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import defaultLogo from "@/assets/logo.png";

/** Route to navigate to after a successful admin login, based on role. */
function getAdminRoute(role: string, fallback: string): string {
  if (role === 'area_president') return '/area-president-dashboard';
  if (role === 'super_admin' || role === 'state_admin') return '/dashboard';
  return fallback;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, selectRole } = useAuth();
  const { org } = useConfig();
  const orgLogoUrl = useOrgLogoUrl();
  const [step, setStep] = useState<"role" | "phone" | "otp" | "franchise-select" | "role-select">("role");
  const [role, setRole] = useState<"beneficiary" | "admin">("admin");
  const [phoneNumber, setPhoneNumber] = useState("9876543210");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [developmentOTP, setDevelopmentOTP] = useState<string | null>(null);

  // Selection state for multi-franchise / multi-role flow
  const [selectionToken, setSelectionToken] = useState<string>("");
  const [franchiseOptions, setFranchiseOptions] = useState<FranchiseOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Get the return URL from location state
  const from = location.state?.from?.pathname || "/dashboard";

  const handleRoleSelect = () => {
    setStep("phone");
  };

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit mobile number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let response;
      
      // Use different API endpoints based on role
      if (role === "beneficiary") {
        // Use beneficiary API which auto-creates account
        const beneficiaryApi = await import("@/services/beneficiaryApi");
        response = await beneficiaryApi.beneficiaryApi.sendOTP(phoneNumber);
        
        // Store static OTP if provided
        if (response.staticOTP || response.developmentOTP) {
          const staticOTP = response.staticOTP || response.developmentOTP;
          setDevelopmentOTP(staticOTP);
          setOtp(staticOTP); // Auto-fill for convenience
        }
      } else {
        // Use admin auth API
        response = await auth.requestOTP(phoneNumber, 'login');
        
        // Store static OTP if provided
        if (response.data?.staticOTP || response.data?.developmentOTP) {
          const staticOTP = response.data?.staticOTP || response.data?.developmentOTP;
          setDevelopmentOTP(staticOTP);
          setOtp(staticOTP); // Auto-fill for convenience
        }
      }
      
      toast({
        title: "OTP Sent",
        description: `Verification code sent to +91 ${phoneNumber}`,
      });
      setStep("otp");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (role === "beneficiary") {
        // Use beneficiary API for verification
        const beneficiaryApi = await import("@/services/beneficiaryApi");
        const response = await beneficiaryApi.beneficiaryApi.verifyOTP(phoneNumber, otp);
        
        console.log('✅ Login successful');
        console.log('- Waiting 100ms for localStorage to persist...');
        
        // Small delay to ensure localStorage is written
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify token was saved
        const savedToken = localStorage.getItem('beneficiary_token');
        console.log('- Token saved?', !!savedToken);
        console.log('- Token matches?', savedToken === response.token);
        
        // Test the token immediately by calling getProfile
        try {
          console.log('- Testing token with getProfile...');
          const profileTest = await beneficiaryApi.beneficiaryApi.getProfile();
          console.log('✅ Token test successful! Profile:', profileTest);
        } catch (testError: any) {
          console.error('❌ Token test failed:', testError);
          toast({
            title: "Token Verification Failed",
            description: testError.message,
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Login Successful",
          description: `Welcome, ${response.user.name}!`,
        });
        
        // Check if profile is complete (isVerified flag)
        setTimeout(() => {
          if (!response.user.isVerified) {
            // First-time user - redirect to profile completion
            navigate("/beneficiary/profile-completion", { replace: true });
          } else {
            // Returning user - go to dashboard
            navigate("/beneficiary/dashboard", { replace: true });
          }
        }, 500);
      } else {
        // Use admin auth for verification
        const result = await login(phoneNumber, otp);

        // ── Multi-franchise selection ──────────────────────────────────────
        if ('requiresFranchiseSelection' in result && result.requiresFranchiseSelection) {
          setFranchiseOptions(result.franchises);
          setSelectionToken(result.selectionToken);
          setSelectedFranchiseId(result.franchises[0]?.id ?? '');
          setStep('franchise-select');
          toast({ title: 'Select Organisation', description: result.message });
          return;
        }

        // ── Multi-role selection ───────────────────────────────────────────
        if ('requiresRoleSelection' in result && result.requiresRoleSelection) {
          setRoleOptions(result.roles);
          setSelectionToken(result.selectionToken);
          setSelectedFranchiseId(result.franchiseId);
          setSelectedRole(result.roles[0]?.role ?? '');
          setStep('role-select');
          toast({ title: 'Select Role', description: result.message });
          return;
        }

        // ── Direct login ───────────────────────────────────────────────────
        await _finaliseAdminLogin();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify OTP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /** Reads localStorage after a direct/select-role login and navigates. */
  const _finaliseAdminLogin = async () => {
    await new Promise(resolve => setTimeout(resolve, 150));

    const savedToken = localStorage.getItem('token');
    const savedUser  = localStorage.getItem('user');

    if (!savedToken || !savedUser) {
      toast({ title: "Login Error", description: "Failed to save authentication data. Please try again.", variant: "destructive" });
      return;
    }

    toast({ title: "Login Successful", description: "Welcome back!" });

    const parsedUser = JSON.parse(savedUser);
    if (parsedUser?.isSuperAdmin) {
      navigate('/global-admin', { replace: true });
    } else {
      navigate(getAdminRoute(parsedUser?.role ?? '', from), { replace: true });
    }
  };

  const handleFranchiseConfirm = async () => {
    if (!selectedFranchiseId) return;
    setLoading(true);
    try {
      // Call select-role without a role — the backend will either:
      //   a) return requiresRoleSelection if the user has multiple roles in this franchise
      //   b) complete login directly if the user has exactly one role
      const apiUrl = import.meta.env.VITE_API_URL!;
      const res = await fetch(`${apiUrl}/auth/select-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectionToken, franchiseId: selectedFranchiseId }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Error', description: data.message || 'Failed to select organisation', variant: 'destructive' });
        return;
      }

      if (data.data?.requiresRoleSelection) {
        setRoleOptions(data.data.roles);
        setSelectedRole(data.data.roles[0]?.role ?? '');
        setStep('role-select');
        toast({ title: 'Select Role', description: data.data.message });
        return;
      }

      // Single role — server returned the full JWT immediately
      if (data.success && data.data?.user && data.data?.tokens) {
        localStorage.setItem('token', data.data.tokens.accessToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        if (data.data.tokens.refreshToken) localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
        await _finaliseAdminLogin();
        return;
      }

      toast({ title: 'Error', description: data.message || 'Failed to select organisation', variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to select organisation', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleConfirm = async () => {
    if (!selectedRole || !selectedFranchiseId) return;
    setLoading(true);
    try {
      await selectRole(selectionToken, selectedFranchiseId, selectedRole);
      await _finaliseAdminLogin();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to select role', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      let response;
      
      // Use different API endpoints based on role
      if (role === "beneficiary") {
        // Use beneficiary API
        const beneficiaryApi = await import("@/services/beneficiaryApi");
        response = await beneficiaryApi.beneficiaryApi.resendOTP(phoneNumber);
        
        // Store static OTP if provided
        if (response.staticOTP || response.developmentOTP) {
          const staticOTP = response.staticOTP || response.developmentOTP;
          setDevelopmentOTP(staticOTP);
          setOtp(staticOTP); // Auto-fill for convenience
        }
      } else {
        // Use admin auth API
        response = await auth.requestOTP(phoneNumber, 'login');
        
        // Store static OTP if provided
        if (response.data?.staticOTP || response.data?.developmentOTP) {
          const staticOTP = response.data?.staticOTP || response.data?.developmentOTP;
          setDevelopmentOTP(staticOTP);
          setOtp(staticOTP); // Auto-fill for convenience
        }
      }
      
      toast({
        title: "OTP Resent",
        description: `New verification code sent to +91 ${phoneNumber}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend OTP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="space-y-1">
          <div className="flex flex-col items-center mb-2">
            <img 
              src={orgLogoUrl} 
              alt={org.erpTitle} 
              className="h-16 w-16 rounded-2xl shadow-sm mb-2" 
              onError={(e) => { (e.target as HTMLImageElement).src = defaultLogo; }} 
            />
            <p className="text-sm font-semibold text-muted-foreground">{org.erpTitle}</p>
          </div>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">
              {step === "role" ? "Select Login Type"
                : step === "phone" ? "Login"
                : step === "otp" ? "Verify OTP"
                : step === "franchise-select" ? "Select Organisation"
                : "Select Role"}
            </CardTitle>
            {step !== "role" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (step === "otp") setStep("phone");
                  else if (step === "franchise-select" || step === "role-select") setStep("otp");
                  else setStep("role");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <CardDescription>
            {step === "role" 
              ? "Choose how you want to access the system"
              : step === "phone" 
                ? `Logging in as ${role === "admin" ? "Admin" : "Beneficiary"}`
                : step === "otp"
                  ? `We've sent a verification code to +91 ${phoneNumber}`
                  : step === "franchise-select"
                    ? "Select the organisation you want to log into"
                    : "Select the role you want to use for this session"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "role" ? (
            <>
              <RadioGroup value={role} onValueChange={(v) => setRole(v as "beneficiary" | "admin")}>
                <div className="space-y-3">
                  <div 
                    className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                      role === "beneficiary" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setRole("beneficiary")}
                  >
                    <RadioGroupItem value="beneficiary" id="beneficiary" />
                    <Label htmlFor="beneficiary" className="flex items-center gap-3 cursor-pointer flex-1">
                      <UserCircle className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-semibold">Beneficiary Login</p>
                        <p className="text-sm text-muted-foreground">Apply for schemes and track applications</p>
                      </div>
                    </Label>
                  </div>
                  
                  <div 
                    className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                      role === "admin" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setRole("admin")}
                  >
                    <RadioGroupItem value="admin" id="admin" />
                    <Label htmlFor="admin" className="flex items-center gap-3 cursor-pointer flex-1">
                      <Shield className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-semibold">Admin Login</p>
                        <p className="text-sm text-muted-foreground">Manage applications and system</p>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
              
              <Button 
                className="w-full bg-gradient-primary shadow-glow" 
                onClick={handleRoleSelect}
              >
                Continue
              </Button>
            </>
          ) : step === "phone" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <div className="flex gap-2">
                  <div className="flex items-center justify-center border border-input rounded-md px-3 bg-muted text-sm font-medium">
                    +91
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter 10-digit mobile number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    maxLength={10}
                  />
                </div>
              </div>
              <Button 
                className="w-full bg-gradient-primary shadow-glow" 
                onClick={handleSendOTP}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="mr-2 h-4 w-4" />
                )}
                {loading ? "Sending..." : "Send OTP"}
              </Button>
            </>
          ) : step === "otp" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="otp">Enter OTP</Label>
                {developmentOTP && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 text-center">
                    <p className="text-sm text-green-800 font-medium">
                      Static OTP: <span className="font-mono text-lg">{developmentOTP}</span>
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      This OTP is always 123456 for all logins
                    </p>
                  </div>
                )}
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={setOtp}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the code?{" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto font-semibold"
                    onClick={handleResendOTP}
                  >
                    Resend OTP
                  </Button>
                </p>
              </div>

              <Button 
                className="w-full bg-gradient-primary shadow-glow" 
                onClick={handleVerifyOTP}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {loading ? "Verifying..." : "Verify & Login"}
              </Button>
            </>
          ) : step === "franchise-select" ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">You have access to multiple organisations. Choose one to continue.</p>
              <RadioGroup value={selectedFranchiseId} onValueChange={setSelectedFranchiseId}>
                <div className="space-y-2">
                  {franchiseOptions.map((f) => (
                    <div
                      key={f.id}
                      className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedFranchiseId === f.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedFranchiseId(f.id)}
                    >
                      <RadioGroupItem value={f.id} id={`franchise-${f.id}`} />
                      <Label htmlFor={`franchise-${f.id}`} className="flex items-center gap-3 cursor-pointer flex-1">
                        <Building2 className="h-6 w-6 text-primary flex-shrink-0" />
                        <span className="font-medium">{f.displayName}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              <Button className="w-full bg-gradient-primary shadow-glow" onClick={handleFranchiseConfirm} disabled={loading || !selectedFranchiseId}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? 'Please wait…' : 'Continue'}
              </Button>
            </>
          ) : step === "role-select" ? (
            <>
              <p className="text-sm text-muted-foreground mb-2">You hold multiple roles in this organisation. Choose the role to use for this session.</p>
              <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
                <div className="space-y-2">
                  {roleOptions.map((r) => (
                    <div
                      key={r.role}
                      className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedRole === r.role ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedRole(r.role)}
                    >
                      <RadioGroupItem value={r.role} id={`role-${r.role}`} />
                      <Label htmlFor={`role-${r.role}`} className="flex items-center gap-3 cursor-pointer flex-1">
                        <Shield className="h-6 w-6 text-primary flex-shrink-0" />
                        <span className="font-medium">{r.displayName}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              <Button className="w-full bg-gradient-primary shadow-glow" onClick={handleRoleConfirm} disabled={loading || !selectedRole}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? 'Logging in…' : 'Login'}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
