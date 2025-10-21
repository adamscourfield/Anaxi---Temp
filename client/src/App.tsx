import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SchoolSelector } from "@/components/school-selector";
import { UserMenu } from "@/components/user-menu";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SchoolProvider } from "@/hooks/use-school";

import Dashboard from "@/pages/dashboard";
import ConductObservation from "@/pages/conduct-observation";
import ObservationHistory from "@/pages/observation-history";
import ManageRubrics from "@/pages/manage-rubrics";
import ManageTeachers from "@/pages/manage-teachers";
import ManageSchools from "@/pages/manage-schools";
import TeachingGroupDetails from "@/pages/teaching-group-details";
import Meetings from "@/pages/meetings";
import Profile from "@/pages/profile";
import Landing from "@/pages/landing";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/observe" component={ConductObservation} />
      <Route path="/history" component={ObservationHistory} />
      <Route path="/rubrics" component={ManageRubrics} />
      <Route path="/teachers" component={ManageTeachers} />
      <Route path="/schools" component={ManageSchools} />
      <Route path="/meetings" component={Meetings} />
      <Route path="/profile" component={Profile} />
      <Route path="/teaching-groups/:id" component={TeachingGroupDetails} />
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  const style = {
    "--sidebar-width": "16rem",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return (
    <SchoolProvider>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <header className="flex items-center justify-between gap-4 p-4 border-b">
                <div className="flex items-center gap-4">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <SchoolSelector />
                </div>
                <div className="flex items-center gap-4">
                  <UserMenu />
                  <ThemeToggle />
                </div>
              </header>
              <main className="flex-1 overflow-auto">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
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
