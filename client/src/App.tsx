import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SchoolSelector } from "@/components/school-selector";
import { UserMenu } from "@/components/user-menu";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SchoolProvider } from "@/hooks/use-school";
import anaxiLogo from "@assets/7_1760131494886.png";

import Dashboard from "@/pages/dashboard";
import ConductObservation from "@/pages/conduct-observation";
import ObservationHistory from "@/pages/observation-history";
import ObservationAnalytics from "@/pages/observation-analytics";
import ManageRubrics from "@/pages/manage-rubrics";
import ManageTeachers from "@/pages/manage-teachers";
import ManageSchools from "@/pages/manage-schools";
import AppManagement from "@/pages/app-management";
import TeachingGroupDetails from "@/pages/teaching-group-details";
import Meetings from "@/pages/meetings";
import MeetingDetails from "@/pages/meeting-details";
import LeaveRequests from "@/pages/leave-requests";
import ApproveLeave from "@/pages/approve-leave";
import BehaviourManagement from "@/pages/behaviour-management";
import OnCall from "@/pages/on-call";
import Profile from "@/pages/profile";
import Landing from "@/pages/landing";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import SetPassword from "@/pages/set-password";
import { RubricActivationModal } from "@/components/rubric-activation-modal";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/observe" component={ConductObservation} />
      <Route path="/history" component={ObservationHistory} />
      <Route path="/analytics" component={ObservationAnalytics} />
      <Route path="/manage-rubrics" component={ManageRubrics} />
      <Route path="/teachers" component={ManageTeachers} />
      <Route path="/schools" component={ManageSchools} />
      <Route path="/management" component={AppManagement} />
      <Route path="/meetings/:id" component={MeetingDetails} />
      <Route path="/meetings" component={Meetings} />
      <Route path="/leave-requests" component={LeaveRequests} />
      <Route path="/approve-leave" component={ApproveLeave} />
      <Route path="/behaviour-management" component={BehaviourManagement} />
      <Route path="/on-call" component={OnCall} />
      <Route path="/profile" component={Profile} />
      <Route path="/teaching-groups/:id" component={TeachingGroupDetails} />
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  const style = {
    "--sidebar-width": "4rem",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Allow access to password-related pages regardless of login state
  const currentPath = window.location.pathname;
  if (currentPath === "/forgot-password" || currentPath === "/reset-password" || currentPath === "/set-password") {
    return (
      <Switch>
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/set-password" component={SetPassword} />
      </Switch>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return (
    <SchoolProvider>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex flex-col h-screen w-full bg-gradient-to-br from-primary/50 via-primary/15 to-accent/50">
            <header className="flex items-center justify-between gap-6 px-6 py-4 border-b border-white/30 dark:border-white/10 z-20">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <img src={anaxiLogo} alt="Anaxi" className="h-9 w-9" />
                  <span className="font-semibold text-foreground text-[16px]">Anaxi</span>
                </div>
                <div className="h-7 w-px bg-border/40" />
                <SchoolSelector />
              </div>
              <div className="flex items-center gap-5">
                <UserMenu />
                <ThemeToggle />
              </div>
            </header>
            <div className="flex flex-1 overflow-hidden gap-4">
              <AppSidebar />
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
        <RubricActivationModal />
      </TooltipProvider>
    </SchoolProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
