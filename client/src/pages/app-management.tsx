import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, Users, Building2, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

// Import the existing management page components (we'll extract their content)
import ManageRubrics from "./manage-rubrics";
import ManageTeachers from "./manage-teachers";
import ManageSchools from "./manage-schools";

export default function AppManagement() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("rubrics");
  const { isAdminOrCreator, isLoading } = useAuth();

  // Handle tab change from URL hash
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && ["rubrics", "teachers", "schools"].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location]);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.location.hash = value;
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Access denied for non-Admin/Creator users
  if (!isAdminOrCreator) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-destructive" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              You do not have permission to access App Management. Only Admins and Creators can access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">App Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage rubrics, teachers, and schools in one place
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="rubrics" data-testid="tab-rubrics" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Rubrics
          </TabsTrigger>
          <TabsTrigger value="teachers" data-testid="tab-teachers" className="gap-2">
            <Users className="w-4 h-4" />
            Teachers
          </TabsTrigger>
          <TabsTrigger value="schools" data-testid="tab-schools" className="gap-2">
            <Building2 className="w-4 h-4" />
            Schools
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rubrics" className="space-y-4" data-testid="content-rubrics">
          <ManageRubrics isEmbedded />
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4" data-testid="content-teachers">
          <ManageTeachers isEmbedded />
        </TabsContent>

        <TabsContent value="schools" className="space-y-4" data-testid="content-schools">
          <ManageSchools isEmbedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
