import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Upload, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { User, School, SchoolMembership } from "@shared/schema";

export default function ManageTeachers() {
  const { user: currentUser, isCreator, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Add teacher state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [newTeacherFirstName, setNewTeacherFirstName] = useState("");
  const [newTeacherLastName, setNewTeacherLastName] = useState("");
  const [newTeacherSchools, setNewTeacherSchools] = useState<string[]>([]);
  
  // CSV import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvData, setCsvData] = useState("");
  const [importResults, setImportResults] = useState<any>(null);
  
  // School assignment state
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignedSchools, setAssignedSchools] = useState<string[]>([]);

  // Fetch all teachers
  const { data: teachers = [], isLoading: teachersLoading } = useQuery<User[]>({
    queryKey: ["/api/users/teachers"],
    enabled: !authLoading,
  });

  // Fetch all schools (Creators see all, Admins see their schools)
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: !authLoading,
  });

  // Create teacher mutation
  const createTeacherMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
      schoolIds: string[];
    }) => {
      return await apiRequest("POST", "/api/users/teachers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/teachers"] });
      setIsAddOpen(false);
      resetAddForm();
      toast({
        title: "Teacher created",
        description: "The teacher account has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create teacher",
        variant: "destructive",
      });
    },
  });

  // Import CSV mutation
  const importCsvMutation = useMutation({
    mutationFn: async (teachers: any[]) => {
      return await apiRequest("POST", "/api/users/teachers/import-csv", { teachers });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/teachers"] });
      setImportResults(data);
      toast({
        title: "Import complete",
        description: `Successfully imported ${data.success?.length || 0} teachers. ${data.errors?.length || 0} errors.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to import teachers",
        variant: "destructive",
      });
    },
  });

  // Update school assignments mutation
  const updateSchoolsMutation = useMutation({
    mutationFn: async (data: { userId: string; schoolIds: string[] }) => {
      return await apiRequest("POST", `/api/users/${data.userId}/schools`, {
        schoolIds: data.schoolIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/teachers"] });
      setIsAssignOpen(false);
      setSelectedTeacher(null);
      setAssignedSchools([]);
      toast({
        title: "Schools updated",
        description: "School assignments have been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update school assignments",
        variant: "destructive",
      });
    },
  });

  const resetAddForm = () => {
    setNewTeacherEmail("");
    setNewTeacherPassword("");
    setNewTeacherFirstName("");
    setNewTeacherLastName("");
    setNewTeacherSchools([]);
  };

  const handleCreateTeacher = () => {
    if (!newTeacherEmail.trim() || !newTeacherPassword.trim()) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    createTeacherMutation.mutate({
      email: newTeacherEmail,
      password: newTeacherPassword,
      first_name: newTeacherFirstName,
      last_name: newTeacherLastName,
      schoolIds: newTeacherSchools,
    });
  };

  const handleImportCsv = () => {
    try {
      // Parse CSV data
      const lines = csvData.trim().split("\n");
      if (lines.length < 2) {
        toast({
          title: "Error",
          description: "CSV must have at least a header row and one data row",
          variant: "destructive",
        });
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim());
      const teachersData = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const teacher: any = {};
        
        headers.forEach((header, index) => {
          if (header === "schoolIds") {
            // Parse schoolIds as array
            teacher[header] = values[index] ? values[index].split(";").map(s => s.trim()) : [];
          } else {
            teacher[header] = values[index] || "";
          }
        });

        teachersData.push(teacher);
      }

      importCsvMutation.mutate(teachersData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse CSV data",
        variant: "destructive",
      });
    }
  };

  const handleAssignSchools = async (teacher: User) => {
    setSelectedTeacher(teacher);
    
    // Fetch current school assignments for this teacher using react-query
    try {
      const memberships = await queryClient.fetchQuery<SchoolMembership[]>({
        queryKey: ["/api/users", teacher.id, "memberships"],
        queryFn: async () => {
          const response = await fetch(`/api/users/${teacher.id}/memberships`);
          if (!response.ok) throw new Error("Failed to fetch memberships");
          return response.json();
        },
      });
      const schoolIds = memberships.map(m => m.schoolId);
      setAssignedSchools(schoolIds);
    } catch (error) {
      console.error("Failed to fetch teacher memberships:", error);
      setAssignedSchools([]);
    }
    
    setIsAssignOpen(true);
  };

  const handleUpdateSchools = () => {
    if (!selectedTeacher) return;

    updateSchoolsMutation.mutate({
      userId: selectedTeacher.id,
      schoolIds: assignedSchools,
    });
  };

  const toggleSchool = (schoolId: string) => {
    setAssignedSchools(prev =>
      prev.includes(schoolId)
        ? prev.filter(id => id !== schoolId)
        : [...prev, schoolId]
    );
  };

  const toggleNewTeacherSchool = (schoolId: string) => {
    setNewTeacherSchools(prev =>
      prev.includes(schoolId)
        ? prev.filter(id => id !== schoolId)
        : [...prev, schoolId]
    );
  };

  // Show loading while auth is resolving
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // Show loading while teachers are being fetched
  if (teachersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading teachers...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Manage Teachers</h1>
          <p className="text-muted-foreground mt-1">
            Add teachers and assign them to schools
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-csv">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Teachers from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with teacher information. Required columns: email, password, first_name, last_name, schoolIds (semicolon-separated)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="csv-data">CSV Data</Label>
                  <Textarea
                    id="csv-data"
                    data-testid="textarea-csv-data"
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    placeholder="email,password,first_name,last_name,schoolIds&#10;john@example.com,password123,John,Doe,school-id-1;school-id-2"
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                {importResults && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Import Results:</p>
                    <p className="text-sm text-green-600">✓ {importResults.success.length} teachers imported</p>
                    {importResults.errors.length > 0 && (
                      <div className="text-sm text-destructive">
                        <p>✗ {importResults.errors.length} errors:</p>
                        <ul className="list-disc list-inside">
                          {importResults.errors.map((err: any, idx: number) => (
                            <li key={idx}>{err.email}: {err.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsImportOpen(false);
                    setCsvData("");
                    setImportResults(null);
                  }}
                  data-testid="button-cancel-import"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportCsv}
                  disabled={importCsvMutation.isPending}
                  data-testid="button-submit-import"
                >
                  {importCsvMutation.isPending ? "Importing..." : "Import"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-teacher">
                <Plus className="w-4 h-4 mr-2" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
                <DialogDescription>
                  Create a new teacher account and assign to schools
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="teacher-first-name">First Name</Label>
                    <Input
                      id="teacher-first-name"
                      data-testid="input-teacher-first-name"
                      value={newTeacherFirstName}
                      onChange={(e) => setNewTeacherFirstName(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="teacher-last-name">Last Name</Label>
                    <Input
                      id="teacher-last-name"
                      data-testid="input-teacher-last-name"
                      value={newTeacherLastName}
                      onChange={(e) => setNewTeacherLastName(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="teacher-email">Email *</Label>
                  <Input
                    id="teacher-email"
                    data-testid="input-teacher-email"
                    type="email"
                    value={newTeacherEmail}
                    onChange={(e) => setNewTeacherEmail(e.target.value)}
                    placeholder="teacher@school.edu"
                  />
                </div>
                <div>
                  <Label htmlFor="teacher-password">Password *</Label>
                  <Input
                    id="teacher-password"
                    data-testid="input-teacher-password"
                    type="password"
                    value={newTeacherPassword}
                    onChange={(e) => setNewTeacherPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                <div>
                  <Label>Assign to Schools</Label>
                  <div className="space-y-2 mt-2">
                    {schools.map((school) => (
                      <div key={school.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`new-school-${school.id}`}
                          checked={newTeacherSchools.includes(school.id)}
                          onCheckedChange={() => toggleNewTeacherSchool(school.id)}
                          data-testid={`checkbox-new-school-${school.id}`}
                        />
                        <label
                          htmlFor={`new-school-${school.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {school.name}
                        </label>
                      </div>
                    ))}
                    {schools.length === 0 && (
                      <p className="text-sm text-muted-foreground">No schools available</p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddOpen(false);
                    resetAddForm();
                  }}
                  data-testid="button-cancel-add"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTeacher}
                  disabled={createTeacherMutation.isPending}
                  data-testid="button-submit-teacher"
                >
                  {createTeacherMutation.isPending ? "Creating..." : "Create Teacher"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teachers.map((teacher) => (
          <Card key={teacher.id} className="hover-elevate">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg" data-testid={`teacher-name-${teacher.id}`}>
                    {teacher.first_name || teacher.last_name
                      ? `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim()
                      : teacher.email}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {teacher.email}
                  </CardDescription>
                  {teacher.global_role === "Creator" && (
                    <Badge variant="default" className="mt-2">
                      Creator
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleAssignSchools(teacher)}
                  data-testid={`button-assign-schools-${teacher.id}`}
                >
                  <Users className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}

        {teachers.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No teachers yet</p>
              <Button onClick={() => setIsAddOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add your first teacher
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* School Assignment Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Schools</DialogTitle>
            <DialogDescription>
              {selectedTeacher?.first_name || selectedTeacher?.last_name
                ? `${selectedTeacher?.first_name || ""} ${selectedTeacher?.last_name || ""}`.trim()
                : selectedTeacher?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              {schools.map((school) => (
                <div key={school.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`assign-school-${school.id}`}
                    checked={assignedSchools.includes(school.id)}
                    onCheckedChange={() => toggleSchool(school.id)}
                    data-testid={`checkbox-assign-school-${school.id}`}
                  />
                  <label
                    htmlFor={`assign-school-${school.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {school.name}
                  </label>
                </div>
              ))}
              {schools.length === 0 && (
                <p className="text-sm text-muted-foreground">No schools available</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignOpen(false);
                setSelectedTeacher(null);
                setAssignedSchools([]);
              }}
              data-testid="button-cancel-assign"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSchools}
              disabled={updateSchoolsMutation.isPending}
              data-testid="button-submit-assign"
            >
              {updateSchoolsMutation.isPending ? "Updating..." : "Update Schools"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
