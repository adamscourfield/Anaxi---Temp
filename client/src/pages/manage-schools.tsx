import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FolderTree } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { School, Department } from "@shared/schema";

export default function ManageSchools({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { user, isCreator, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  
  // Edit school state
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSchoolName, setEditSchoolName] = useState("");
  
  // Department management state
  const [departmentSchool, setDepartmentSchool] = useState<School | null>(null);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editDepartmentName, setEditDepartmentName] = useState("");

  // Fetch all schools (Creator only)
  const { data: schools = [], isLoading } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: isCreator,
  });

  // Create school mutation
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/schools", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      setIsCreateOpen(false);
      setNewSchoolName("");
      toast({
        title: "School created",
        description: "The school has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create school",
        variant: "destructive",
      });
    },
  });

  // Update school mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest("PATCH", `/api/schools/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      setIsEditOpen(false);
      setEditingSchool(null);
      setEditSchoolName("");
      toast({
        title: "School updated",
        description: "The school has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update school",
        variant: "destructive",
      });
    },
  });

  // Delete school mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/schools/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools"] });
      toast({
        title: "School deleted",
        description: "The school has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete school",
        variant: "destructive",
      });
    },
  });

  // Fetch departments for the selected school
  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/schools", departmentSchool?.id, "departments"],
    queryFn: async () => {
      if (!departmentSchool) return [];
      const response = await fetch(`/api/schools/${departmentSchool.id}/departments`);
      if (!response.ok) throw new Error("Failed to fetch departments");
      return response.json();
    },
    enabled: !!departmentSchool,
  });

  // Create department mutation
  const createDepartmentMutation = useMutation({
    mutationFn: async ({ schoolId, name }: { schoolId: string; name: string }) => {
      return await apiRequest("POST", `/api/schools/${schoolId}/departments`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", departmentSchool?.id, "departments"] });
      setNewDepartmentName("");
      toast({
        title: "Department created",
        description: "The department has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create department",
        variant: "destructive",
      });
    },
  });

  // Update department mutation
  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await apiRequest("PATCH", `/api/departments/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", departmentSchool?.id, "departments"] });
      setEditingDepartment(null);
      setEditDepartmentName("");
      toast({
        title: "Department updated",
        description: "The department has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update department",
        variant: "destructive",
      });
    },
  });

  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", departmentSchool?.id, "departments"] });
      toast({
        title: "Department deleted",
        description: "The department has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete department",
        variant: "destructive",
      });
    },
  });

  const handleCreateSchool = () => {
    if (!newSchoolName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a school name",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newSchoolName);
  };

  const handleEditSchool = (school: School) => {
    setEditingSchool(school);
    setEditSchoolName(school.name);
    setIsEditOpen(true);
  };

  const handleUpdateSchool = () => {
    if (!editSchoolName.trim() || !editingSchool) {
      toast({
        title: "Error",
        description: "Please enter a school name",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ id: editingSchool.id, name: editSchoolName });
  };

  const handleOpenDepartments = (school: School) => {
    setDepartmentSchool(school);
    setIsDepartmentDialogOpen(true);
  };

  const handleCreateDepartment = () => {
    if (!newDepartmentName.trim() || !departmentSchool) {
      toast({
        title: "Error",
        description: "Please enter a department name",
        variant: "destructive",
      });
      return;
    }
    createDepartmentMutation.mutate({
      schoolId: departmentSchool.id,
      name: newDepartmentName,
    });
  };

  const handleStartEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setEditDepartmentName(department.name);
  };

  const handleUpdateDepartment = () => {
    if (!editDepartmentName.trim() || !editingDepartment) {
      toast({
        title: "Error",
        description: "Please enter a department name",
        variant: "destructive",
      });
      return;
    }
    updateDepartmentMutation.mutate({
      id: editingDepartment.id,
      name: editDepartmentName,
    });
  };

  const handleDeleteDepartment = (department: Department) => {
    if (confirm(`Are you sure you want to delete the ${department.name} department?`)) {
      deleteDepartmentMutation.mutate(department.id);
    }
  };

  // Show loading while auth is resolving
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  // Check access after auth is loaded
  if (!isCreator) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only Creators can access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show loading while schools are being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading schools...</p>
      </div>
    );
  }

  return (
    <div className={isEmbedded ? "space-y-6" : "container mx-auto p-6 max-w-6xl"}>
      <div className={`flex items-center justify-between ${isEmbedded ? "" : "mb-6"}`}>
        {!isEmbedded && (
          <div>
            <h1 className="text-3xl font-bold">Manage Schools</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage schools across the platform
            </p>
          </div>
        )}

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-school">
              <Plus className="w-4 h-4 mr-2" />
              Create School
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New School</DialogTitle>
              <DialogDescription>
                Add a new school to the platform
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="school-name">School Name</Label>
                <Input
                  id="school-name"
                  data-testid="input-school-name"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="Enter school name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSchool}
                disabled={createMutation.isPending}
                data-testid="button-submit-school"
              >
                {createMutation.isPending ? "Creating..." : "Create School"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {schools.map((school) => (
          <Card key={school.id} className="hover-elevate">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl" data-testid={`school-name-${school.id}`}>
                    {school.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    ID: {school.id.slice(0, 8)}...
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditSchool(school)}
                    data-testid={`button-edit-school-${school.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${school.name}?`)) {
                        deleteMutation.mutate(school.id);
                      }
                    }}
                    data-testid={`button-delete-school-${school.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleOpenDepartments(school)}
                data-testid={`button-manage-departments-${school.id}`}
              >
                <FolderTree className="w-4 h-4 mr-2" />
                Manage Departments
              </Button>
            </CardContent>
          </Card>
        ))}

        {schools.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No schools yet</p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create your first school
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit School Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit School</DialogTitle>
            <DialogDescription>
              Update the school information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-school-name">School Name</Label>
              <Input
                id="edit-school-name"
                data-testid="input-edit-school-name"
                value={editSchoolName}
                onChange={(e) => setEditSchoolName(e.target.value)}
                placeholder="Enter school name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false);
                setEditingSchool(null);
                setEditSchoolName("");
              }}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSchool}
              disabled={updateMutation.isPending}
              data-testid="button-submit-edit-school"
            >
              {updateMutation.isPending ? "Updating..." : "Update School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Management Dialog */}
      <Dialog open={isDepartmentDialogOpen} onOpenChange={(open) => {
        setIsDepartmentDialogOpen(open);
        if (!open) {
          setDepartmentSchool(null);
          setNewDepartmentName("");
          setEditingDepartment(null);
          setEditDepartmentName("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Departments - {departmentSchool?.name}</DialogTitle>
            <DialogDescription>
              Add and manage departments for this school
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Add Department Section */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="New department name (e.g., Maths, Science, English)"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateDepartment();
                    }
                  }}
                  data-testid="input-new-department-name"
                />
              </div>
              <Button
                onClick={handleCreateDepartment}
                disabled={createDepartmentMutation.isPending}
                data-testid="button-add-department"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createDepartmentMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>

            {/* Departments List */}
            <div className="space-y-2">
              <Label>Departments</Label>
              {departmentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading departments...</p>
              ) : departments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No departments yet. Add one above.</p>
              ) : (
                <div className="space-y-2">
                  {departments.map((department) => (
                    <Card key={department.id} className="p-3">
                      {editingDepartment?.id === department.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editDepartmentName}
                            onChange={(e) => setEditDepartmentName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleUpdateDepartment();
                              }
                              if (e.key === "Escape") {
                                setEditingDepartment(null);
                                setEditDepartmentName("");
                              }
                            }}
                            data-testid={`input-edit-department-${department.id}`}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleUpdateDepartment}
                            disabled={updateDepartmentMutation.isPending}
                            data-testid={`button-save-department-${department.id}`}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingDepartment(null);
                              setEditDepartmentName("");
                            }}
                            data-testid={`button-cancel-edit-department-${department.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-medium" data-testid={`department-name-${department.id}`}>
                            {department.name}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEditDepartment(department)}
                              data-testid={`button-edit-department-${department.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteDepartment(department)}
                              data-testid={`button-delete-department-${department.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDepartmentDialogOpen(false)}
              data-testid="button-close-departments"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
