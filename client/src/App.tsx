import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SchoolSelector } from "@/components/school-selector";
import { UserSwitcher } from "@/components/user-switcher";
import { AuthProvider } from "@/contexts/auth-context";
import { useState } from "react";

import Dashboard from "@/pages/dashboard";
import ConductObservation from "@/pages/conduct-observation";
import ObservationHistory from "@/pages/observation-history";
import ManageRubrics from "@/pages/manage-rubrics";
import ManageTeachers from "@/pages/manage-teachers";
import TeachingGroupDetails from "@/pages/teaching-group-details";
import Conversations from "@/pages/conversations";
import Profile from "@/pages/profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/observe" component={ConductObservation} />
      <Route path="/history" component={ObservationHistory} />
      <Route path="/rubrics" component={ManageRubrics} />
      <Route path="/teachers" component={ManageTeachers} />
      <Route path="/conversations" component={Conversations} />
      <Route path="/profile" component={Profile} />
      <Route path="/teaching-groups/:id" component={TeachingGroupDetails} />
    </Switch>
  );
}

export default function App() {
  const [selectedSchool, setSelectedSchool] = useState("1");

  const schools = [
    { id: "1", name: "Springdale Academy" },
    { id: "2", name: "Riverside High School" },
    { id: "3", name: "Oakmont College" },
  ];

  const style = {
    "--sidebar-width": "16rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between gap-4 p-4 border-b">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <SchoolSelector
                      schools={schools}
                      selectedSchool={selectedSchool}
                      onSelectSchool={setSelectedSchool}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <UserSwitcher />
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
      </AuthProvider>
    </QueryClientProvider>
  );
}
