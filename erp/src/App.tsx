import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AuthGuard } from "./components/AuthGuard";
import { AuthProvider } from "./hooks/useAuth";
import { RBACProvider } from "./hooks/useRBAC";
import { ConfigProvider } from "./contexts/ConfigContext";
import CommandPalette from "./components/CommandPalette";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Schemes from "./pages/Schemes";
import Applications from "./pages/Applications";
import AllApplications from "./pages/applications/AllApplications";
import PendingApplications from "./pages/applications/PendingApplications";
import UnderReviewApplications from "./pages/applications/UnderReviewApplications";
import FieldVerificationApplications from "./pages/applications/FieldVerificationApplications";
import InterviewScheduledApplications from "./pages/applications/InterviewScheduledApplications";
import ApprovedApplications from "./pages/applications/ApprovedApplications";
import RejectedApplications from "./pages/applications/RejectedApplications";
import CompletedApplications from "./pages/applications/CompletedApplications";
import CommitteeApproval from "./pages/CommitteeApproval";
import Donors from "./pages/Donors";
import AllDonors from "./pages/donors/AllDonors";
import AllPayments from "./pages/payments/AllPayments";
import OverduePayments from "./pages/payments/OverduePayments";
import DueSoonPayments from "./pages/payments/DueSoonPayments";
import UpcomingPayments from "./pages/payments/UpcomingPayments";
import ProcessingPayments from "./pages/payments/ProcessingPayments";
import CompletedPayments from "./pages/payments/CompletedPayments";
import RecurringPaymentsDashboard from "./pages/recurring-payments/RecurringPaymentsDashboard";
import ScheduleOverview from "./pages/recurring-payments/ScheduleOverview";
import PaymentScheduleView from "./pages/recurring-payments/PaymentScheduleView";
import BudgetForecastPage from "./pages/recurring-payments/BudgetForecastPage";


import FollowUpDashboard from "./pages/donors/FollowUpDashboard";
import AnonymousDonation from "./pages/donors/AnonymousDonation";
import DonationHistory from "./pages/donors/DonationHistory";
import Donations from "./pages/donors/Donations";
import Budget from "./pages/Budget";
import Locations from "./pages/Locations";
import Districts from "./pages/Districts";
import Areas from "./pages/Areas";
import Units from "./pages/Units";
import UserManagement from "./pages/UserManagement";
import RoleManagement from "./pages/RoleManagement";
import Communications from "./pages/Communications";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Beneficiaries from "./pages/Beneficiaries";
import BeneficiaryPayments from "./pages/BeneficiaryPayments";
import NotFound from "./pages/NotFound";
import PublicSchemes from "./pages/PublicSchemes";
import Login from "./pages/Login";
import BeneficiaryLogin from "./pages/BeneficiaryLogin";
import BeneficiaryProfileCompletion from "./pages/BeneficiaryProfileCompletion";
import BeneficiaryDashboard from "./pages/BeneficiaryDashboard";
import BeneficiarySchemes from "./pages/BeneficiarySchemes";
import BeneficiaryApplication from "./pages/BeneficiaryApplication";
import BeneficiaryAuthGuard from "./components/BeneficiaryAuthGuard";
import ApplicationTracking from "./pages/ApplicationTracking";
import ActivityLogs from "./pages/ActivityLogs";
import ActivityLogAnalytics from "./pages/ActivityLogAnalytics";
import UserActivity from "./pages/UserActivity";
import SecurityEvents from "./pages/SecurityEvents";
import SystemEvents from "./pages/SystemEvents";
import LoginLogs from "./pages/LoginLogs";
import LoginAnalytics from "./pages/LoginAnalytics";
import SuspiciousActivity from "./pages/SuspiciousActivity";
import ErrorLogs from "./pages/ErrorLogs";
import ErrorAnalytics from "./pages/ErrorAnalytics";
import TimelineDemo from "./pages/TimelineDemo";
import WebsiteSettings from "./pages/WebsiteSettings";
import NewsEvents from "./pages/NewsEvents";
import Brochures from "./pages/Brochures";
import Partners from "./pages/Partners";
import Banners from "./pages/Banners";
import FormBuilder from "./pages/FormBuilder";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <RBACProvider>
            <ConfigProvider>
              <CommandPalette />
              <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Login />} />
            <Route path="/beneficiary-login" element={<BeneficiaryLogin />} />
            <Route path="/public-schemes" element={<PublicSchemes />} />

            {/* Beneficiary Routes */}
            <Route path="/beneficiary/profile-completion" element={<BeneficiaryAuthGuard requireVerification={false}><BeneficiaryProfileCompletion /></BeneficiaryAuthGuard>} />
            <Route path="/beneficiary/dashboard" element={<BeneficiaryAuthGuard><BeneficiaryDashboard /></BeneficiaryAuthGuard>} />
            <Route path="/beneficiary/schemes" element={<BeneficiaryAuthGuard><BeneficiarySchemes /></BeneficiaryAuthGuard>} />
            <Route path="/beneficiary/apply/:schemeId" element={<BeneficiaryAuthGuard><BeneficiaryApplication /></BeneficiaryAuthGuard>} />
            <Route path="/beneficiary/track/:id" element={<BeneficiaryAuthGuard><ApplicationTracking /></BeneficiaryAuthGuard>} />

            {/* Admin Routes - Protected */}
            <Route path="/dashboard" element={<AuthGuard><Layout><Dashboard /></Layout></AuthGuard>} />
            <Route path="/projects" element={<AuthGuard><Layout><Projects /></Layout></AuthGuard>} />
            <Route path="/schemes" element={<AuthGuard><Layout><Schemes /></Layout></AuthGuard>} />
            <Route path="/applications" element={<AuthGuard><Layout><Applications /></Layout></AuthGuard>} />
            <Route path="/form-builder" element={<AuthGuard><Layout><FormBuilder /></Layout></AuthGuard>} />
            <Route path="/applications/all" element={<AuthGuard><Layout><AllApplications /></Layout></AuthGuard>} />
            <Route path="/applications/pending" element={<AuthGuard><Layout><PendingApplications /></Layout></AuthGuard>} />
            <Route path="/applications/under-review" element={<AuthGuard><Layout><UnderReviewApplications /></Layout></AuthGuard>} />
            <Route path="/applications/field-verification" element={<AuthGuard><Layout><FieldVerificationApplications /></Layout></AuthGuard>} />
            <Route path="/applications/interview-scheduled" element={<AuthGuard><Layout><InterviewScheduledApplications /></Layout></AuthGuard>} />
            <Route path="/applications/approved" element={<AuthGuard><Layout><ApprovedApplications /></Layout></AuthGuard>} />
            <Route path="/applications/rejected" element={<AuthGuard><Layout><RejectedApplications /></Layout></AuthGuard>} />
            <Route path="/applications/completed" element={<AuthGuard><Layout><CompletedApplications /></Layout></AuthGuard>} />
            <Route path="/upcoming-interviews" element={<AuthGuard><Layout><InterviewScheduledApplications /></Layout></AuthGuard>} />
            <Route path="/committee-approval" element={<AuthGuard><Layout><CommitteeApproval /></Layout></AuthGuard>} />
            <Route path="/beneficiaries" element={<AuthGuard><Layout><Beneficiaries /></Layout></AuthGuard>} />
            <Route path="/payment-tracking" element={<AuthGuard><Layout><BeneficiaryPayments /></Layout></AuthGuard>} />
            <Route path="/payment-tracking/all" element={<AuthGuard><Layout><AllPayments /></Layout></AuthGuard>} />
            <Route path="/payment-tracking/overdue" element={<AuthGuard><Layout><OverduePayments /></Layout></AuthGuard>} />
            <Route path="/payment-tracking/due-soon" element={<AuthGuard><Layout><DueSoonPayments /></Layout></AuthGuard>} />
            <Route path="/payment-tracking/upcoming" element={<AuthGuard><Layout><UpcomingPayments /></Layout></AuthGuard>} />
            <Route path="/payment-tracking/processing" element={<AuthGuard><Layout><ProcessingPayments /></Layout></AuthGuard>} />
            <Route path="/payment-tracking/completed" element={<AuthGuard><Layout><CompletedPayments /></Layout></AuthGuard>} />
            
            {/* Recurring Payments Routes */}
            <Route path="/recurring-payments" element={<AuthGuard><Layout><RecurringPaymentsDashboard /></Layout></AuthGuard>} />
            <Route path="/recurring-payments/dashboard" element={<AuthGuard><Layout><RecurringPaymentsDashboard /></Layout></AuthGuard>} />
            <Route path="/recurring-payments/schedule" element={<AuthGuard><Layout><ScheduleOverview /></Layout></AuthGuard>} />
            <Route path="/recurring-payments/schedule/:applicationId" element={<AuthGuard><Layout><PaymentScheduleView /></Layout></AuthGuard>} />
            <Route path="/recurring-payments/forecast" element={<AuthGuard><Layout><BudgetForecastPage /></Layout></AuthGuard>} />
            
            {/* Donor Routes */}
            <Route path="/donors" element={<AuthGuard><Layout><Donors /></Layout></AuthGuard>} />
            <Route path="/donors/all" element={<AuthGuard><Layout><AllDonors /></Layout></AuthGuard>} />
            <Route path="/donors/donations" element={<AuthGuard><Layout><Donations /></Layout></AuthGuard>} />
            <Route path="/donors/history" element={<AuthGuard><Layout><DonationHistory /></Layout></AuthGuard>} />
            <Route path="/donors/followups" element={<AuthGuard><Layout><FollowUpDashboard /></Layout></AuthGuard>} />
            <Route path="/budget" element={<AuthGuard><Layout><Budget /></Layout></AuthGuard>} />
            <Route path="/locations" element={<AuthGuard><Layout><Locations /></Layout></AuthGuard>} />
            <Route path="/locations/districts" element={<AuthGuard><Layout><Districts /></Layout></AuthGuard>} />
            <Route path="/locations/areas" element={<AuthGuard><Layout><Areas /></Layout></AuthGuard>} />
            <Route path="/locations/units" element={<AuthGuard><Layout><Units /></Layout></AuthGuard>} />
            <Route path="/users" element={<AuthGuard><Layout><UserManagement /></Layout></AuthGuard>} />
            <Route path="/roles" element={<AuthGuard><Layout><RoleManagement /></Layout></AuthGuard>} />

            <Route path="/communications" element={<AuthGuard><Layout><Communications /></Layout></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Layout><Settings /></Layout></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><Layout><Profile /></Layout></AuthGuard>} />
            <Route path="/activity-logs" element={<AuthGuard><Layout><ActivityLogs /></Layout></AuthGuard>} />
            <Route path="/activity-logs/analytics" element={<AuthGuard><Layout><ActivityLogAnalytics /></Layout></AuthGuard>} />
            <Route path="/activity-logs/user-activity" element={<AuthGuard><Layout><UserActivity /></Layout></AuthGuard>} />
            <Route path="/activity-logs/security-events" element={<AuthGuard><Layout><SecurityEvents /></Layout></AuthGuard>} />
            <Route path="/activity-logs/system-events" element={<AuthGuard><Layout><SystemEvents /></Layout></AuthGuard>} />
            
            {/* Login Logs Routes */}
            <Route path="/login-logs" element={<AuthGuard><Layout><LoginLogs /></Layout></AuthGuard>} />
            <Route path="/login-logs/analytics" element={<AuthGuard><Layout><LoginAnalytics /></Layout></AuthGuard>} />
            <Route path="/login-logs/suspicious" element={<AuthGuard><Layout><SuspiciousActivity /></Layout></AuthGuard>} />
            
            {/* Error Logs Routes */}
            <Route path="/error-logs" element={<AuthGuard><Layout><ErrorLogs /></Layout></AuthGuard>} />
            <Route path="/error-logs/analytics" element={<AuthGuard><Layout><ErrorAnalytics /></Layout></AuthGuard>} />
            
            <Route path="/timeline-demo" element={<AuthGuard><Layout><TimelineDemo /></Layout></AuthGuard>} />
            
            {/* Website Management Routes */}
            <Route path="/website-settings" element={<AuthGuard><Layout><WebsiteSettings /></Layout></AuthGuard>} />
            <Route path="/banners" element={<AuthGuard><Layout><Banners /></Layout></AuthGuard>} />
            <Route path="/news-events" element={<AuthGuard><Layout><NewsEvents /></Layout></AuthGuard>} />
            <Route path="/brochures" element={<AuthGuard><Layout><Brochures /></Layout></AuthGuard>} />
            <Route path="/partners" element={<AuthGuard><Layout><Partners /></Layout></AuthGuard>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
            </ConfigProvider>
          </RBACProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
