import { Switch, Route, Link } from "wouter";
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
import BehaviourManagement from "@/pages/behaviour-management";
import OnCall from "@/pages/on-call";
import Profile from "@/pages/profile";
import Landing from "@/pages/landing";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import SetPassword from "@/pages/set-password";
import { RubricActivationModal } from "@/components/rubric-activation-modal";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

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
          <div className="relative flex flex-col h-screen w-full bg-gray-50 dark:bg-gray-950 overflow-hidden">
            {/* Decorative pale blue and pink waved gradient */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-32 -right-32 w-[500px] h-[400px] bg-blue-100/50 dark:bg-blue-900/20 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] blur-3xl" />
              <div className="absolute top-1/3 -left-24 w-[350px] h-[300px] bg-pink-100/40 dark:bg-pink-900/15 rounded-[60%_40%_30%_70%/60%_30%_70%_40%] blur-3xl" />
              <div className="absolute bottom-1/3 right-1/5 w-[400px] h-[350px] bg-blue-50/60 dark:bg-blue-800/15 rounded-[30%_70%_40%_60%/50%_60%_40%_50%] blur-3xl" />
              <div className="absolute -bottom-24 left-1/4 w-[300px] h-[250px] bg-pink-50/50 dark:bg-pink-800/10 rounded-[50%_50%_60%_40%/40%_60%_50%_50%] blur-3xl" />
              <div className="absolute top-1/2 right-1/3 w-[280px] h-[220px] bg-blue-100/30 dark:bg-blue-900/10 rounded-[70%_30%_50%_50%/50%_40%_60%_50%] blur-3xl" />
            </div>
            <header className="relative flex items-center justify-between gap-3 md:gap-6 px-4 md:px-6 py-3 md:py-4 z-20">
              <div className="flex items-center gap-3 md:gap-6 flex-1 min-w-0">
                <Link href="/" className="flex items-center gap-2 md:gap-3 shrink-0" data-testid="link-home">
                  <img src={anaxiLogo} alt="Anaxi" className="h-8 w-8 md:h-9 md:w-9 dark:invert dark:brightness-200" />
                  <span className="font-semibold text-foreground text-sm md:text-[16px] hidden sm:inline">Anaxi</span>
                </Link>
                <div className="h-6 md:h-7 w-px bg-border/40 hidden sm:block" />
                <div className="flex-1 min-w-0">
                  <SchoolSelector />
                </div>
              </div>
              <div className="flex items-center gap-3 md:gap-5 shrink-0">
                <UserMenu />
                <ThemeToggle />
              </div>
            </header>
            <div className="flex flex-1 overflow-hidden gap-6">
              <AppSidebar />
              <main className="flex-1 overflow-auto pb-20 md:pb-0">
                <Router />
              </main>
            </div>
            <MobileBottomNav />
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
