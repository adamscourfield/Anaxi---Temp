import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { School } from "@shared/schema";

export default function ManageSchools() {
  const { user, isCreator, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  
  // Edit school state
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSchoolName, setEditSchoolName] = useState("");

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
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Manage Schools</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage schools across the platform
          </p>
        </div>

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
    </div>
  );
}
