import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ClipboardList, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

// Import the existing management page components (we'll extract their content)
import ManageRubrics from "./manage-rubrics";
import ManageTeachers from "./manage-teachers";

export default function AppManagement() {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("rubrics");

  // Handle tab change from URL hash
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && ["rubrics", "teachers"].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location]);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.location.hash = value;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">App Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage rubrics and teachers in one place
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="rubrics" data-testid="tab-rubrics" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Rubrics
          </TabsTrigger>
          <TabsTrigger value="teachers" data-testid="tab-teachers" className="gap-2">
            <Users className="w-4 h-4" />
            Teachers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rubrics" className="space-y-4" data-testid="content-rubrics">
          <ManageRubrics />
        </TabsContent>

        <TabsContent value="teachers" className="space-y-4" data-testid="content-teachers">
          <ManageTeachers />
        </TabsContent>
      </Tabs>
    </div>
  );
}
