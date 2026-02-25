import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Phone, ArrowLeft, UserCircle, Shield, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { auth } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/contexts/ConfigContext";
import { useOrgLogoUrl } from "@/hooks/useOrgLogoUrl";
import defaultLogo from "@/assets/logo.png";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { org } = useConfig();
  const orgLogoUrl = useOrgLogoUrl();
  const [step, setStep] = useState<"role" | "phone" | "otp">("role");
  const [role, setRole] = useState<"beneficiary" | "admin">("admin");
  const [phoneNumber, setPhoneNumber] = useState("9876543210");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [developmentOTP, setDevelopmentOTP] = useState<string | null>(null);

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
        await login(phoneNumber, otp);
        
        // Wait a bit longer to ensure token is stored and React state is updated
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify token was saved
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (!savedToken || !savedUser) {
          toast({
            title: "Login Error",
            description: "Failed to save authentication data. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        // Test the token by making a simple API call
        try {
          const apiUrl = import.meta.env.VITE_API_URL;
          if (!apiUrl) {
            throw new Error('VITE_API_URL environment variable is required');
          }
          const testResponse = await fetch(`${apiUrl}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${savedToken}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!testResponse.ok) {
            throw new Error('Token validation failed');
          }
        } catch (testError) {
          console.error('Token validation error:', testError);
          toast({
            title: "Authentication Error",
            description: "Token validation failed. Please try logging in again.",
            variant: "destructive",
          });
          return;
        }
        
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
        
        // Navigate to the intended page or dashboard
        navigate(from, { replace: true });
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
              {step === "role" ? "Select Login Type" : step === "phone" ? "Login" : "Verify OTP"}
            </CardTitle>
            {step !== "role" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(step === "otp" ? "phone" : "role")}
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
                : `We've sent a verification code to +91 ${phoneNumber}`
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
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
