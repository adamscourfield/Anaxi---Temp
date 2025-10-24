import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Upload, Search, Pencil, Users, Archive, ArchiveRestore } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { User, School, SchoolMembership } from "@shared/schema";
import { CsvColumnMapper } from "@/components/csv-column-mapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ManageTeachers({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { user: currentUser, isCreator, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Add teacher state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTeacherEmail, setNewTeacherEmail] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [newTeacherFirstName, setNewTeacherFirstName] = useState("");
  const [newTeacherLastName, setNewTeacherLastName] = useState("");
  const [newTeacherSchools, setNewTeacherSchools] = useState<string[]>([]);
  
  // Edit teacher state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<string>("Teacher");
  const [editingMemberships, setEditingMemberships] = useState<SchoolMembership[]>([]);
  
  // CSV import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][]; mappings: Record<string, string> } | null>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const [isImportValid, setIsImportValid] = useState(false);
  
  // School assignment state
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignedSchools, setAssignedSchools] = useState<string[]>([]);

  // Fetch all teachers (include archived for Creators)
  const { data: teachers = [], isLoading: teachersLoading } = useQuery<User[]>({
    queryKey: ["/api/users/teachers", isCreator ? "includeArchived" : "activeOnly"],
    queryFn: async () => {
      const url = isCreator 
        ? "/api/users/teachers?includeArchived=true"
        : "/api/users/teachers";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
    enabled: !authLoading,
  });

  // Fetch all schools (Creators see all, Admins see their schools)
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: !authLoading,
  });

  // Fetch memberships for all teachers
  const { data: allMemberships = [] } = useQuery<SchoolMembership[]>({
    queryKey: ["/api/all-memberships"],
    queryFn: async () => {
      // Fetch memberships for each teacher
      const membershipPromises = teachers.map(teacher =>
        queryClient.fetchQuery<SchoolMembership[]>({
          queryKey: ["/api/users", teacher.id, "memberships"],
          queryFn: async () => {
            const response = await fetch(`/api/users/${teacher.id}/memberships`);
            if (!response.ok) return [];
            return response.json();
          },
        })
      );
      const results = await Promise.all(membershipPromises);
      return results.flat();
    },
    enabled: teachers.length > 0,
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
      queryClient.invalidateQueries({ queryKey: ["/api/all-memberships"] });
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

  // Update teacher mutation
  const updateTeacherMutation = useMutation({
    mutationFn: async (data: { id: string; first_name: string; last_name: string; email: string }) => {
      return await apiRequest("PATCH", `/api/users/${data.id}`, {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/teachers"] });
      setIsEditOpen(false);
      setEditingTeacher(null);
      toast({
        title: "Teacher updated",
        description: "The teacher information has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update teacher",
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
      queryClient.invalidateQueries({ queryKey: ["/api/all-memberships"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/all-memberships"] });
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

  // Update membership role mutation
  const updateMembershipRoleMutation = useMutation({
    mutationFn: async (data: { membershipId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/memberships/${data.membershipId}`, {
        role: data.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/all-memberships"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    },
  });

  // Archive user mutation (Creator only)
  const archiveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/users/${userId}/archive`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/teachers"] });
      toast({
        title: "User archived",
        description: "The user has been archived and can no longer log in or participate in observations.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive user",
        variant: "destructive",
      });
    },
  });

  // Unarchive user mutation (Creator only)
  const unarchiveUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/users/${userId}/unarchive`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/teachers"] });
      toast({
        title: "User unarchived",
        description: "The user has been restored and can now log in and participate in observations.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unarchive user",
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

  const handleEditTeacher = async (teacher: User) => {
    setEditingTeacher(teacher);
    setEditFirstName(teacher.first_name || "");
    setEditLastName(teacher.last_name || "");
    setEditEmail(teacher.email);
    
    // Fetch teacher's memberships to get current role
    try {
      const memberships = await queryClient.fetchQuery<SchoolMembership[]>({
        queryKey: ["/api/users", teacher.id, "memberships"],
        queryFn: async () => {
          const response = await fetch(`/api/users/${teacher.id}/memberships`);
          if (!response.ok) return [];
          return response.json();
        },
      });
      setEditingMemberships(memberships);
      // Set the role from the first membership (or default to Teacher)
      setEditRole(memberships.length > 0 ? memberships[0].role : "Teacher");
    } catch (error) {
      console.error("Failed to fetch memberships:", error);
      setEditingMemberships([]);
      setEditRole("Teacher");
    }
    
    setIsEditOpen(true);
  };

  const handleUpdateTeacher = async () => {
    if (!editingTeacher) return;

    try {
      // Update teacher basic info
      await updateTeacherMutation.mutateAsync({
        id: editingTeacher.id,
        first_name: editFirstName,
        last_name: editLastName,
        email: editEmail,
      });

      // Update role for all memberships
      const roleUpdatePromises = editingMemberships.map(membership =>
        updateMembershipRoleMutation.mutateAsync({
          membershipId: membership.id,
          role: editRole,
        })
      );
      
      await Promise.all(roleUpdatePromises);

      setIsEditOpen(false);
      setEditingTeacher(null);
      setEditingMemberships([]);
      
      toast({
        title: "Teacher updated",
        description: "The teacher information and role have been updated successfully.",
      });
    } catch (error: any) {
      // Error toasts are handled by individual mutations
      console.error("Error updating teacher:", error);
    }
  };

  const handleImportCsv = () => {
    if (!csvData) {
      toast({
        title: "Error",
        description: "No CSV data loaded",
        variant: "destructive",
      });
      return;
    }

    try {
      const { rows, mappings } = csvData;
      const teachersData = [];
      const allWarnings: string[] = [];

      for (const row of rows) {
        const teacher: any = {};
        
        // Map each field using the user's column mappings
        Object.keys(mappings).forEach(fieldKey => {
          const csvHeader = mappings[fieldKey];
          const headerIndex = csvData.headers.indexOf(csvHeader);
          if (headerIndex !== -1) {
            teacher[fieldKey] = row[headerIndex];
          }
        });

        // Convert school names to school IDs
        if (teacher.schoolNames) {
          const schoolNamesList = teacher.schoolNames.split(";").map((s: string) => s.trim());
          const matchedSchoolIds: string[] = [];
          const unmatchedSchools: string[] = [];
          
          schoolNamesList.forEach((schoolName: string) => {
            const school = schools.find(s => 
              s.name.toLowerCase() === schoolName.toLowerCase()
            );
            if (school) {
              matchedSchoolIds.push(school.id);
            } else if (schoolName) {
              unmatchedSchools.push(schoolName);
            }
          });
          
          // Keep as array for backend
          teacher.schoolIds = matchedSchoolIds;
          delete teacher.schoolNames;
          
          // Track unmatched schools for reporting
          if (unmatchedSchools.length > 0) {
            allWarnings.push(`${teacher.email}: Unmatched schools - ${unmatchedSchools.join(", ")}`);
          }
        }

        teachersData.push(teacher);
      }

      // Add warnings to the mutation for display
      importCsvMutation.mutate(teachersData, {
        onSuccess: (data) => {
          const resultsWithWarnings = {
            ...data,
            warnings: allWarnings.length > 0 ? allWarnings : undefined,
          };
          setImportResults(resultsWithWarnings);
        },
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process CSV data",
        variant: "destructive",
      });
    }
  };

  const handleAssignSchools = async (teacher: User) => {
    setSelectedTeacher(teacher);
    
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

  // Get school names for a teacher
  const getTeacherSchools = (teacherId: string) => {
    const teacherMemberships = allMemberships.filter(m => m.userId === teacherId);
    return teacherMemberships.map(m => {
      const school = schools.find(s => s.id === m.schoolId);
      return school?.name || "Unknown";
    });
  };

  // Filter teachers based on search
  const filteredTeachers = teachers.filter(teacher => {
    const fullName = `${teacher.first_name || ""} ${teacher.last_name || ""}`.toLowerCase();
    const email = teacher.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    
    return fullName.includes(query) || email.includes(query);
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (teachersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading teachers...</p>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "space-y-6" : "container mx-auto p-6 max-w-7xl"}>
      <div className={`flex items-center justify-between ${isEmbedded ? "" : "mb-6"}`}>
        {!isEmbedded && (
          <div>
            <h1 className="text-3xl font-bold">Manage Teachers</h1>
            <p className="text-muted-foreground mt-1">
              Search, edit, and manage teacher accounts
            </p>
          </div>
        )}

        <div className={`flex gap-2 ${isEmbedded ? "ml-auto" : ""}`}>
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-csv">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import Teachers from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV file and map columns to teacher fields
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <CsvColumnMapper
                  onFileLoad={setCsvData}
                  onValidationChange={setIsImportValid}
                  requiredFields={[
                    { key: "email", label: "Email Address", required: true },
                    { key: "password", label: "Password", required: true },
                    { key: "first_name", label: "First Name", required: true },
                    { key: "last_name", label: "Last Name", required: true },
                    { key: "schoolNames", label: "School Names (semicolon-separated)", required: false },
                  ]}
                />
                {importResults && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Import Results:</p>
                    <p className="text-sm text-green-600">✓ {importResults.success?.length || 0} teachers imported</p>
                    {importResults.errors?.length > 0 && (
                      <div className="text-sm text-destructive">
                        <p>✗ {importResults.errors.length} errors:</p>
                        <ul className="list-disc list-inside">
                          {importResults.errors.map((err: any, idx: number) => (
                            <li key={idx}>{err.email}: {err.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {importResults.warnings?.length > 0 && (
                      <div className="text-sm text-amber-600">
                        <p>⚠ {importResults.warnings.length} warnings:</p>
                        <ul className="list-disc list-inside">
                          {importResults.warnings.map((warn: any, idx: number) => (
                            <li key={idx}>{warn}</li>
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
                    setCsvData(null);
                    setImportResults(null);
                    setIsImportValid(false);
                  }}
                  data-testid="button-cancel-import"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportCsv}
                  disabled={importCsvMutation.isPending || !isImportValid}
                  data-testid="button-submit-import"
                >
                  {importCsvMutation.isPending ? "Importing..." : "Import Teachers"}
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

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search teachers by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-teachers"
          />
        </div>
      </div>

      {/* Teachers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Schools</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No teachers found matching your search" : "No teachers yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTeachers.map((teacher) => {
                  const teacherSchools = getTeacherSchools(teacher.id);
                  const displayName = teacher.first_name || teacher.last_name
                    ? `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim()
                    : "—";

                  return (
                    <TableRow key={teacher.id} data-testid={`row-teacher-${teacher.id}`} className={teacher.archived ? "opacity-60" : ""}>
                      <TableCell className="font-medium">
                        {displayName}
                        {teacher.global_role === "Creator" && (
                          <Badge variant="default" className="ml-2">Creator</Badge>
                        )}
                        {teacher.archived && (
                          <Badge variant="outline" className="ml-2">Archived</Badge>
                        )}
                      </TableCell>
                      <TableCell>{teacher.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {teacherSchools.length > 0 ? (
                            teacherSchools.map((schoolName, idx) => (
                              <Badge key={idx} variant="secondary">
                                {schoolName}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">No schools</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTeacher(teacher)}
                            data-testid={`button-edit-${teacher.id}`}
                            disabled={teacher.archived}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleAssignSchools(teacher)}
                            data-testid={`button-assign-schools-${teacher.id}`}
                            disabled={teacher.archived}
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                          {isCreator && (
                            teacher.archived ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => unarchiveUserMutation.mutate(teacher.id)}
                                data-testid={`button-unarchive-${teacher.id}`}
                                disabled={unarchiveUserMutation.isPending}
                              >
                                <ArchiveRestore className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => archiveUserMutation.mutate(teacher.id)}
                                data-testid={`button-archive-${teacher.id}`}
                                disabled={archiveUserMutation.isPending}
                              >
                                <Archive className="w-4 h-4" />
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Teacher Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>
              Update teacher information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-first-name">First Name</Label>
                <Input
                  id="edit-first-name"
                  data-testid="input-edit-first-name"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="edit-last-name">Last Name</Label>
                <Input
                  id="edit-last-name"
                  data-testid="input-edit-last-name"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                data-testid="input-edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="teacher@school.edu"
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger id="edit-role" data-testid="select-edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teacher">Teacher</SelectItem>
                  <SelectItem value="Leader">Leader</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1">
                Role will be updated for all schools this teacher is assigned to
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false);
                setEditingTeacher(null);
              }}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateTeacher}
              disabled={updateTeacherMutation.isPending}
              data-testid="button-submit-edit"
            >
              {updateTeacherMutation.isPending ? "Updating..." : "Update Teacher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
