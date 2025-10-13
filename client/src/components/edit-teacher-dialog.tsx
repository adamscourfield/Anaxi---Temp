import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Teacher, TeachingGroup } from "@shared/schema";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Upload } from "lucide-react";
import type { UploadResult } from "@uppy/core";

interface EditTeacherDialogProps {
  teacher: Teacher;
  schoolId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTeacherDialog({ teacher, schoolId, open, onOpenChange }: EditTeacherDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: teacher.name,
    email: teacher.email || "",
    role: teacher.role || "Teacher",
    profilePicture: teacher.profilePicture || "",
    groupId: teacher.groupId || "",
  });

  useEffect(() => {
    setFormData({
      name: teacher.name,
      email: teacher.email || "",
      role: teacher.role || "Teacher",
      profilePicture: teacher.profilePicture || "",
      groupId: teacher.groupId || "",
    });
  }, [teacher]);

  const { data: teachingGroups = [] } = useQuery<TeachingGroup[]>({
    queryKey: ["/api/teaching-groups", schoolId],
    queryFn: async () => {
      const response = await fetch(`/api/teaching-groups?schoolId=${schoolId}`);
      if (!response.ok) throw new Error("Failed to fetch teaching groups");
      return response.json();
    },
  });

  // Mutation for getting upload URL
  const getUploadUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/objects/upload");
      return response.json();
    },
  });

  // Mutation for setting ACL on uploaded profile picture (doesn't update database)
  const setProfilePictureAclMutation = useMutation({
    mutationFn: async (objectURL: string) => {
      const response = await apiRequest("POST", "/api/objects/set-acl", {
        objectURL,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Just update form data with the uploaded path
      // The teacher update will happen when form is submitted via PATCH /api/teachers/:id
      setFormData({
        ...formData,
        profilePicture: data.objectPath,
      });
      toast({
        title: "Success",
        description: "Profile picture uploaded successfully. Click 'Save Changes' to update.",
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
        // Set ACL to public and get the object path
        setProfilePictureAclMutation.mutate(uploadedFile.uploadURL);
      }
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PATCH", `/api/teachers/${teacher.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers", schoolId] });
      toast({
        title: "Success",
        description: "Teacher updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update teacher",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Teacher</DialogTitle>
          <DialogDescription>
            Update teacher information and permissions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Sarah Mitchell"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                data-testid="input-edit-teacher-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="s.mitchell@school.edu"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                data-testid="input-edit-teacher-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger id="edit-role" data-testid="select-edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Teacher">Teacher</SelectItem>
                  <SelectItem value="Leader">Leader</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-profile-picture">Profile Picture</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-profile-picture"
                  placeholder="https://example.com/photo.jpg or upload image"
                  value={formData.profilePicture}
                  onChange={(e) =>
                    setFormData({ ...formData, profilePicture: e.target.value })
                  }
                  data-testid="input-edit-profile-picture"
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
            <div className="space-y-2">
              <Label htmlFor="edit-department">Department</Label>
              <Select
                value={formData.groupId}
                onValueChange={(value) =>
                  setFormData({ ...formData, groupId: value })
                }
              >
                <SelectTrigger id="edit-department" data-testid="select-edit-department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {teachingGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-edit-teacher"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              data-testid="button-submit-edit-teacher"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
