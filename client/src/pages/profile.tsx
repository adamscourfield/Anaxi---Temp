import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Image as ImageIcon, Upload, Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import type { LeaveRequest, MeetingAction } from "@shared/schema";
import { format } from "date-fns";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    profilePicture: "",
  });

  // Fetch user's leave requests
  const { data: leaveRequests = [], isLoading: isLoadingLeave } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/my-leave-requests"],
    enabled: !!user,
  });

  // Fetch user's meeting actions
  const { data: meetingActions = [], isLoading: isLoadingActions } = useQuery<MeetingAction[]>({
    queryKey: ["/api/my-actions"],
    enabled: !!user,
  });

  // Sync formData with user when entering edit mode
  const handleEdit = () => {
    if (user) {
      setFormData({
        firstName: user.first_name || "",
        lastName: user.last_name || "",
        email: user.email || "",
        profilePicture: user.profile_image_url || "",
      });
    }
    setIsEditing(true);
  };

  // Mutation for getting upload URL
  const getUploadUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/objects/upload");
      return response.json();
    },
  });

  // Mutation for setting profile picture after upload
  const setProfilePictureMutation = useMutation({
    mutationFn: async (profilePictureURL: string) => {
      const response = await apiRequest("PUT", "/api/profile-pictures", {
        profilePictureURL,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setFormData({
        ...formData,
        profilePicture: data.objectPath,
      });
      toast({
        title: "Success",
        description: "Profile picture uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    },
  });

  // Handler for getting upload parameters
  const handleGetUploadParameters = async () => {
    const data = await getUploadUrlMutation.mutateAsync();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  // Handler for upload complete
  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      if (uploadedFile.uploadURL) {
        setProfilePictureMutation.mutate(uploadedFile.uploadURL);
      }
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { first_name: string; last_name: string; email: string; profile_image_url: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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
    
    // Validate names are not empty
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast({
        title: "Invalid Name",
        description: "First and last name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    
    updateProfileMutation.mutate({
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      profile_image_url: formData.profilePicture,
    });
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.first_name || "",
      lastName: user?.last_name || "",
      email: user?.email || "",
      profilePicture: user?.profile_image_url || "",
    });
    setIsEditing(false);
  };

  if (!user) {
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

  const fullName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user.email || "User";

  const initials = user.first_name && user.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user.email?.[0]?.toUpperCase() || "U";

  // Helper function to get leave request status badge
  const getLeaveStatusBadge = (status: string) => {
    if (status === "pending") {
      return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
    } else if (status === "approved_with_pay" || status === "approved_without_pay") {
      return <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" /> Approved</Badge>;
    } else if (status === "denied") {
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Denied</Badge>;
    }
    return <Badge>{status}</Badge>;
  };

  // Helper function to get action status badge
  const getActionStatusBadge = (status: string, completed: boolean) => {
    if (completed) {
      return <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" /> Done</Badge>;
    } else if (status === "in_progress") {
      return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> In Progress</Badge>;
    } else {
      return <Badge variant="secondary" className="gap-1">Open</Badge>;
    }
  };

  // Group actions by status
  const openActions = meetingActions.filter(a => !a.completed && a.status === "open");
  const inProgressActions = meetingActions.filter(a => !a.completed && a.status === "in_progress");
  const completedActions = meetingActions.filter(a => a.completed);

  return (
    <div className="p-6 space-y-8">
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
              {(isEditing ? formData.profilePicture : user.profile_image_url) && (
                <AvatarImage src={(isEditing ? formData.profilePicture : user.profile_image_url) || undefined} />
              )}
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{fullName}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  data-testid="badge-user-role"
                >
                  {user.global_role === "Creator" ? "Platform Admin" : "User"}
                </Badge>
              </div>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  <User className="w-4 h-4 inline mr-2" />
                  First Name
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Enter your first name"
                  data-testid="input-first-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  <User className="w-4 h-4 inline mr-2" />
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Enter your last name"
                  data-testid="input-last-name"
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
                  Profile Picture
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="profilePicture"
                    value={formData.profilePicture}
                    onChange={(e) => setFormData({ ...formData, profilePicture: e.target.value })}
                    placeholder="https://example.com/photo.jpg or upload image"
                    data-testid="input-profile-picture"
                    className="flex-1"
                  />
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={5242880}
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handleUploadComplete}
                    buttonVariant="outline"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </ObjectUploader>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload an image or enter a URL
                </p>
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
                <p className="text-base mt-1" data-testid="text-name">{fullName}</p>
              </div>

              <div>
                <Label className="text-muted-foreground">Email Address</Label>
                <p className="text-base mt-1" data-testid="text-email">{user.email || "Not set"}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leave Requests Section */}
      <Card data-testid="card-leave-requests">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Leave Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLeave ? (
            <p className="text-center text-muted-foreground py-8">Loading leave requests...</p>
          ) : leaveRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No leave requests found</p>
          ) : (
            <div className="space-y-3">
              {leaveRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center p-4 rounded-lg border hover-elevate"
                  data-testid={`leave-request-${request.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{request.type}</p>
                      {getLeaveStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(request.startDate), "MMM d, yyyy")} - {format(new Date(request.endDate), "MMM d, yyyy")}
                    </p>
                    {request.reason && (
                      <p className="text-sm text-muted-foreground mt-1">{request.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meeting Actions Section */}
      <Card data-testid="card-meeting-actions">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Meeting Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingActions ? (
            <p className="text-center text-muted-foreground py-8">Loading actions...</p>
          ) : meetingActions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No actions assigned to you</p>
          ) : (
            <div className="space-y-6">
              {/* Open Actions */}
              {openActions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Open ({openActions.length})</h3>
                  <div className="space-y-2">
                    {openActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-start p-4 rounded-lg border hover-elevate"
                        data-testid={`action-${action.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getActionStatusBadge(action.status, action.completed)}
                          </div>
                          <p className="text-sm font-medium">{action.description}</p>
                          {action.dueDate && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Due: {format(new Date(action.dueDate), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* In Progress Actions */}
              {inProgressActions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground">In Progress ({inProgressActions.length})</h3>
                  <div className="space-y-2">
                    {inProgressActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-start p-4 rounded-lg border hover-elevate"
                        data-testid={`action-${action.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getActionStatusBadge(action.status, action.completed)}
                          </div>
                          <p className="text-sm font-medium">{action.description}</p>
                          {action.dueDate && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Due: {format(new Date(action.dueDate), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Actions */}
              {completedActions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Completed ({completedActions.length})</h3>
                  <div className="space-y-2">
                    {completedActions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-start p-4 rounded-lg border hover-elevate opacity-75"
                        data-testid={`action-${action.id}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getActionStatusBadge(action.status, action.completed)}
                          </div>
                          <p className="text-sm font-medium line-through">{action.description}</p>
                          {action.completedAt && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Completed: {format(new Date(action.completedAt), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
