import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSchool } from "@/hooks/use-school";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SchoolMembership, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Edit } from "lucide-react";

interface MembershipWithUser extends SchoolMembership {
  user?: User;
}

export default function ManageMemberships() {
  const { toast } = useToast();
  const { currentSchoolId, hasNoSchools } = useSchool();
  const { user, isCreator } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<SchoolMembership | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Check if user is Admin in current school
  const { data: currentMembership } = useQuery<SchoolMembership>({
    queryKey: ["/api/my-membership", currentSchoolId],
    enabled: !!user && !!currentSchoolId && !isCreator,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${currentSchoolId}/memberships`);
      if (!response.ok) throw new Error("Failed to fetch memberships");
      const memberships: MembershipWithUser[] = await response.json();
      const myMembership = memberships.find(m => m.userId === user?.id);
      if (!myMembership) throw new Error("Membership not found");
      return myMembership;
    },
  });

  const isAdmin = isCreator || currentMembership?.role === "Admin";
  
  // Form state for adding membership
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("Teacher");
  const [addError, setAddError] = useState<string | null>(null);

  // Fetch memberships for current school
  const { data: memberships = [], isLoading } = useQuery<MembershipWithUser[]>({
    queryKey: ["/api/schools", currentSchoolId, "memberships"],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${currentSchoolId}/memberships`);
      if (!response.ok) throw new Error("Failed to fetch memberships");
      return response.json();
    },
  });

  // Add membership mutation
  const addMembershipMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      try {
        // First, find user by email
        const userResponse = await fetch(`/api/users?email=${encodeURIComponent(data.email)}`);
        
        if (!userResponse.ok) {
          const errorData = await userResponse.json().catch(() => ({ message: "User not found" }));
          throw new Error(errorData.message || "User not found. Please create the user account first or check the email address.");
        }

        const user: User = await userResponse.json();

        // Create membership
        const result = await apiRequest("POST", `/api/schools/${currentSchoolId}/memberships`, {
          userId: user.id,
          schoolId: currentSchoolId,
          role: data.role,
        });
        
        return result;
      } catch (error: any) {
        // Re-throw to ensure onError is called
        throw new Error(error.message || "Failed to add teacher to school");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchoolId, "memberships"] });
      toast({
        title: "Success",
        description: "Teacher added to school successfully",
      });
      setAddDialogOpen(false);
      setEmail("");
      setRole("Teacher");
      setAddError(null);
    },
    onError: (error: Error) => {
      console.error("Add membership error:", error);
      const errorMessage = error.message || "Failed to add teacher to school";
      setAddError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update membership mutation
  const updateMembershipMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return apiRequest("PATCH", `/api/memberships/${id}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchoolId, "memberships"] });
      toast({
        title: "Success",
        description: "Membership updated successfully",
      });
      setEditDialogOpen(false);
      setEditingMembership(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update membership",
        variant: "destructive",
      });
    },
  });

  // Delete membership mutation
  const deleteMembershipMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/memberships/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchoolId, "memberships"] });
      toast({
        title: "Success",
        description: "Teacher removed from school",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove teacher from school",
        variant: "destructive",
      });
    },
  });

  const handleAddMembership = () => {
    setAddError(null); // Clear previous errors
    
    if (!email.trim()) {
      const errorMsg = "Please enter an email address";
      setAddError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }
    addMembershipMutation.mutate({ email: email.trim(), role });
  };

  const handleUpdateRole = () => {
    if (!editingMembership) return;
    updateMembershipMutation.mutate({
      id: editingMembership.id,
      role: editingMembership.role,
    });
  };

  if (hasNoSchools) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground py-12">
          No school assigned. Please contact an administrator.
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground py-12">
          Access denied. Only administrators can manage school memberships.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">School Memberships</h1>
          <p className="text-muted-foreground mt-1">
            Manage teachers and staff in this school
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-membership">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Teacher
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Teacher to School</DialogTitle>
              <DialogDescription>
                Add an existing user to this school with a specific role
              </DialogDescription>
            </DialogHeader>
            {addError && (
              <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm" data-testid="error-message">
                {addError}
              </div>
            )}
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="teacher@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger data-testid="select-role">
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
                onClick={() => setAddDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMembership}
                disabled={addMembershipMutation.isPending}
                data-testid="button-confirm-add"
              >
                {addMembershipMutation.isPending ? "Adding..." : "Add Teacher"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading memberships...</div>
      ) : memberships.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          No teachers in this school yet. Add one above.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((membership) => (
                <TableRow key={membership.id}>
                  <TableCell>{membership.user?.email || "N/A"}</TableCell>
                  <TableCell>
                    {membership.user?.first_name && membership.user?.last_name
                      ? `${membership.user.first_name} ${membership.user.last_name}`
                      : membership.displayName || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={membership.role === "Admin" ? "default" : "secondary"}>
                      {membership.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingMembership(membership);
                          setEditDialogOpen(true);
                        }}
                        data-testid={`button-edit-${membership.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Are you sure you want to remove this teacher from the school?")) {
                            deleteMembershipMutation.mutate(membership.id);
                          }
                        }}
                        data-testid={`button-delete-${membership.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Change the role for {editingMembership?.user?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editingMembership?.role}
                onValueChange={(value) =>
                  editingMembership &&
                  setEditingMembership({ ...editingMembership, role: value })
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
              onClick={() => setEditDialogOpen(false)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updateMembershipMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMembershipMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
