import { useState } from "react";
import { TeacherTable } from "@/components/teacher-table";
import { AddTeacherDialog } from "@/components/add-teacher-dialog";
import { EditTeacherDialog } from "@/components/edit-teacher-dialog";
import { ImportTeachersDialog } from "@/components/import-teachers-dialog";
import { TeachingGroupsManagement } from "@/components/teaching-groups-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import type { Teacher, TeachingGroup } from "@shared/schema";

const SCHOOL_ID = "3d629223-97f8-4d33-8e7e-974bbbf156b8";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ManageTeachers() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const isAdmin = currentUser?.role === "Admin";

  const { data: teachers = [], isLoading: teachersLoading } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers", SCHOOL_ID],
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${SCHOOL_ID}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
  });

  const { data: teachingGroups = [], isLoading: groupsLoading } = useQuery<TeachingGroup[]>({
    queryKey: ["/api/teaching-groups", SCHOOL_ID],
    queryFn: async () => {
      const response = await fetch(`/api/teaching-groups?schoolId=${SCHOOL_ID}`);
      if (!response.ok) throw new Error("Failed to fetch teaching groups");
      return response.json();
    },
  });

  const assignGroupMutation = useMutation({
    mutationFn: async ({ teacherId, groupId }: { teacherId: string; groupId: string | null }) => {
      return apiRequest("PATCH", `/api/teachers/${teacherId}`, { groupId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teachers", SCHOOL_ID] });
      toast({
        title: "Success",
        description: "Teacher group assignment updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update teacher group assignment",
        variant: "destructive",
      });
    },
  });

  const teachersWithMeta = teachers.map((teacher) => {
    const group = teachingGroups.find((g) => g.id === teacher.groupId);
    return {
      ...teacher,
      initials: getInitials(teacher.name),
      groupName: group?.name,
      observationCount: 0,
    };
  });

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Teachers</h1>
          <p className="text-muted-foreground mt-1">
            Manage teachers and teaching groups in your school
          </p>
        </div>
      </div>

      <Tabs defaultValue="teachers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="teachers" data-testid="tab-teachers">Teachers</TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-groups">Teaching Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="space-y-6">
          {isAdmin && (
            <div className="flex justify-end gap-2">
              <ImportTeachersDialog />
              <AddTeacherDialog />
            </div>
          )}
          {teachersLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading teachers...</div>
          ) : (
            <>
              <TeacherTable
                teachers={teachersWithMeta}
                teachingGroups={teachingGroups}
                onEdit={isAdmin ? (teacher) => {
                  setEditingTeacher(teacher);
                  setEditDialogOpen(true);
                } : undefined}
                onDelete={isAdmin ? (teacher) => console.log("Delete teacher:", teacher) : undefined}
                onAssignGroup={(teacherId, groupId) => {
                  assignGroupMutation.mutate({ teacherId, groupId });
                }}
              />
              {editingTeacher && (
                <EditTeacherDialog
                  teacher={editingTeacher}
                  schoolId={SCHOOL_ID}
                  open={editDialogOpen}
                  onOpenChange={setEditDialogOpen}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          <TeachingGroupsManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
