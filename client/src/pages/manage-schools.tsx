import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UserPlus, Edit, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { School, SchoolMembership, User } from "@shared/schema";

interface MembershipWithUser extends SchoolMembership {
  user?: User;
}

export default function ManageSchools() {
  const { user, isCreator, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState("");
  
  // School management dialog state
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  
  // Membership management state
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<SchoolMembership | null>(null);
  const [editMemberDialogOpen, setEditMemberDialogOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<string>("Teacher");
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

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

  // Fetch memberships for selected school
  const { data: memberships = [], isLoading: membershipsLoading } = useQuery<MembershipWithUser[]>({
    queryKey: ["/api/schools", selectedSchool?.id, "memberships"],
    enabled: !!selectedSchool?.id,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${selectedSchool!.id}/memberships`);
      if (!response.ok) throw new Error("Failed to fetch memberships");
      return response.json();
    },
  });

  // Add membership mutation
  const addMembershipMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      try {
        const userResponse = await fetch(`/api/users?email=${encodeURIComponent(data.email)}`);
        
        if (!userResponse.ok) {
          const errorData = await userResponse.json().catch(() => ({ message: "User not found" }));
          throw new Error(errorData.message || "User not found. Please create the user account first or check the email address.");
        }

        const foundUser: User = await userResponse.json();

        const result = await apiRequest("POST", `/api/schools/${selectedSchool!.id}/memberships`, {
          userId: foundUser.id,
          schoolId: selectedSchool!.id,
          role: data.role,
        });
        
        return result;
      } catch (error: any) {
        throw new Error(error.message || "Failed to add teacher to school");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", selectedSchool?.id, "memberships"] });
      toast({
        title: "Success",
        description: "Teacher added to school successfully",
      });
      setAddMemberDialogOpen(false);
      setMemberEmail("");
      setMemberRole("Teacher");
      setAddMemberError(null);
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "Failed to add teacher to school";
      setAddMemberError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update membership mutation
  const updateMembershipMutation = useMutation({
    mutationFn: async (data: { membershipId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/schools/${selectedSchool!.id}/memberships/${data.membershipId}`, {
        role: data.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", selectedSchool?.id, "memberships"] });
      toast({
        title: "Success",
        description: "Member role updated successfully",
      });
      setEditMemberDialogOpen(false);
      setEditingMembership(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update member role",
        variant: "destructive",
      });
    },
  });

  // Remove membership mutation
  const removeMembershipMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      return await apiRequest("DELETE", `/api/schools/${selectedSchool!.id}/memberships/${membershipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", selectedSchool?.id, "memberships"] });
      toast({
        title: "Success",
        description: "Teacher removed from school successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove teacher from school",
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

  const handleManageSchool = (school: School) => {
    setSelectedSchool(school);
    setManageDialogOpen(true);
  };

  const handleAddMember = () => {
    setAddMemberError(null);
    
    if (!memberEmail.trim()) {
      const errorMsg = "Please enter an email address";
      setAddMemberError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    addMembershipMutation.mutate({ email: memberEmail.trim(), role: memberRole });
  };

  const handleEditMember = (membership: SchoolMembership) => {
    setEditingMembership(membership);
    setEditMemberDialogOpen(true);
  };

  const handleUpdateMember = () => {
    if (!editingMembership) return;
    updateMembershipMutation.mutate({
      membershipId: editingMembership.id,
      role: editingMembership.role,
    });
  };

  const handleRemoveMember = (membershipId: string) => {
    if (confirm("Are you sure you want to remove this teacher from the school?")) {
      removeMembershipMutation.mutate(membershipId);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Admin":
        return "default";
      case "Leader":
        return "secondary";
      default:
        return "outline";
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
                <div>
                  <CardTitle className="text-xl" data-testid={`school-name-${school.id}`}>
                    {school.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    ID: {school.id.slice(0, 8)}...
                  </CardDescription>
                </div>
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
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleManageSchool(school)}
                  data-testid={`button-view-school-${school.id}`}
                >
                  <Users className="w-3 h-3 mr-2" />
                  Manage
                </Button>
              </div>
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

      {/* School Management Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage School</DialogTitle>
            <DialogDescription>
              {selectedSchool?.name}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="space-y-2">
                <Label>School Name</Label>
                <p className="text-lg font-medium">{selectedSchool?.name}</p>
              </div>
              <div className="space-y-2">
                <Label>School ID</Label>
                <p className="text-sm text-muted-foreground font-mono">{selectedSchool?.id}</p>
              </div>
              <div className="space-y-2">
                <Label>Total Members</Label>
                <p className="text-lg font-medium">{memberships.length}</p>
              </div>
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">School Members</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage teachers and staff for this school
                  </p>
                </div>
                <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-member">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Member to School</DialogTitle>
                      <DialogDescription>
                        Add an existing user to this school with a specific role
                      </DialogDescription>
                    </DialogHeader>
                    {addMemberError && (
                      <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm" data-testid="error-message">
                        {addMemberError}
                      </div>
                    )}
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="member-email">Email Address</Label>
                        <Input
                          id="member-email"
                          type="email"
                          placeholder="teacher@school.edu"
                          value={memberEmail}
                          onChange={(e) => setMemberEmail(e.target.value)}
                          data-testid="input-member-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="member-role">Role</Label>
                        <Select value={memberRole} onValueChange={setMemberRole}>
                          <SelectTrigger data-testid="select-member-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Teacher">Teacher</SelectItem>
                            <SelectItem value="Leader">Leader</SelectItem>
                            <SelectItem value="Admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAddMemberDialogOpen(false);
                          setAddMemberError(null);
                        }}
                        data-testid="button-cancel-add-member"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddMember}
                        disabled={addMembershipMutation.isPending}
                        data-testid="button-confirm-add-member"
                      >
                        {addMembershipMutation.isPending ? "Adding..." : "Add Member"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {membershipsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading members...
                </div>
              ) : memberships.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members yet. Add the first member to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberships.map((membership) => (
                      <TableRow key={membership.id}>
                        <TableCell className="font-medium" data-testid={`member-name-${membership.id}`}>
                          {membership.user ? `${membership.user.first_name || ''} ${membership.user.last_name || ''}`.trim() || membership.user.email : "Unknown"}
                        </TableCell>
                        <TableCell data-testid={`member-email-${membership.id}`}>
                          {membership.user?.email || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(membership.role)} data-testid={`member-role-${membership.id}`}>
                            {membership.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditMember(membership)}
                              data-testid={`button-edit-member-${membership.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMember(membership.id)}
                              data-testid={`button-remove-member-${membership.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Member Role Dialog */}
      <Dialog open={editMemberDialogOpen} onOpenChange={setEditMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingMembership && (editingMembership as MembershipWithUser).user ? `${(editingMembership as MembershipWithUser).user!.first_name || ''} ${(editingMembership as MembershipWithUser).user!.last_name || ''}`.trim() || (editingMembership as MembershipWithUser).user!.email : "this member"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editingMembership?.role}
                onValueChange={(value) =>
                  setEditingMembership(
                    editingMembership ? { ...editingMembership, role: value } : null
                  )
                }
              >
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teacher">Teacher</SelectItem>
                  <SelectItem value="Leader">Leader</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditMemberDialogOpen(false);
                setEditingMembership(null);
              }}
              data-testid="button-cancel-edit-member"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateMember}
              disabled={updateMembershipMutation.isPending}
              data-testid="button-confirm-edit-member"
            >
              {updateMembershipMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
