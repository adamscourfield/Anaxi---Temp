import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Image as ImageIcon } from "lucide-react";

export default function Profile() {
  const { currentUser, setCurrentUser } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    profilePicture: "",
  });

  // Sync formData with currentUser when entering edit mode
  const handleEdit = () => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || "",
        email: currentUser.email || "",
        profilePicture: currentUser.profilePicture || "",
      });
    }
    setIsEditing(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("PATCH", `/api/teachers/${currentUser?.id}`, data);
      return response.json();
    },
    onSuccess: (updatedTeacher) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers"] });
      setCurrentUser(updatedTeacher);
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }
    
    // Validate name is not empty
    if (!formData.name.trim()) {
      toast({
        title: "Invalid Name",
        description: "Name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      name: currentUser?.name || "",
      email: currentUser?.email || "",
      profilePicture: currentUser?.profilePicture || "",
    });
    setIsEditing(false);
  };

  if (!currentUser) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No user logged in
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account information
        </p>
      </div>

      <Card data-testid="card-profile">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Account Information</CardTitle>
            {!isEditing && (
              <Button
                variant="outline"
                onClick={handleEdit}
                data-testid="button-edit-profile"
              >
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              {(isEditing ? formData.profilePicture : currentUser.profilePicture) && (
                <AvatarImage src={(isEditing ? formData.profilePicture : currentUser.profilePicture) || undefined} />
              )}
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{currentUser.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant={
                    currentUser.role === "Admin" ? "default" :
                    currentUser.role === "Leader" ? "secondary" :
                    "outline"
                  }
                  data-testid="badge-user-role"
                >
                  {currentUser.role || "Teacher"}
                </Badge>
              </div>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  <User className="w-4 h-4 inline mr-2" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profilePicture">
                  <ImageIcon className="w-4 h-4 inline mr-2" />
                  Profile Picture URL
                </Label>
                <Input
                  id="profilePicture"
                  value={formData.profilePicture}
                  onChange={(e) => setFormData({ ...formData, profilePicture: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                  data-testid="input-profile-picture"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-save"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Full Name</Label>
                <p className="text-base mt-1" data-testid="text-name">{currentUser.name}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Email Address</Label>
                <p className="text-base mt-1" data-testid="text-email">{currentUser.email || "Not set"}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Role</Label>
                <p className="text-base mt-1" data-testid="text-role">{currentUser.role || "Teacher"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
