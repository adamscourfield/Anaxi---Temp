import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Users, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const groupFormSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  groupLeadId: z.string().min(1, "Group lead is required"),
});

type GroupFormValues = z.infer<typeof groupFormSchema>;

interface TeachingGroup {
  id: string;
  name: string;
  groupLead: {
    id: string;
    name: string;
    initials: string;
  };
  members: Array<{
    id: string;
    name: string;
    initials: string;
  }>;
}

const mockTeachers = [
  { id: "1", name: "Sarah Mitchell", initials: "SM" },
  { id: "2", name: "James Chen", initials: "JC" },
  { id: "3", name: "Emily Rodriguez", initials: "ER" },
  { id: "4", name: "Michael Thompson", initials: "MT" },
  { id: "5", name: "Lisa Anderson", initials: "LA" },
];

export function TeachingGroupsManagement() {
  const [open, setOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<TeachingGroup[]>([
    {
      id: "1",
      name: "English Department",
      groupLead: { id: "1", name: "Sarah Mitchell", initials: "SM" },
      members: [
        { id: "1", name: "Sarah Mitchell", initials: "SM" },
        { id: "2", name: "James Chen", initials: "JC" },
        { id: "3", name: "Emily Rodriguez", initials: "ER" },
      ],
    },
    {
      id: "2",
      name: "Mathematics",
      groupLead: { id: "2", name: "James Chen", initials: "JC" },
      members: [
        { id: "2", name: "James Chen", initials: "JC" },
        { id: "4", name: "Michael Thompson", initials: "MT" },
      ],
    },
  ]);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: "",
      groupLeadId: "",
    },
  });

  const onSubmit = (data: GroupFormValues) => {
    const selectedTeacher = mockTeachers.find(t => t.id === data.groupLeadId);
    if (!selectedTeacher) return;

    if (editingGroupId) {
      // Update existing group
      setGroups(groups.map(group => 
        group.id === editingGroupId
          ? {
              ...group,
              name: data.name,
              groupLead: selectedTeacher,
              members: group.members.some(m => m.id === selectedTeacher.id)
                ? group.members
                : [...group.members, selectedTeacher],
            }
          : group
      ));
    } else {
      // Create new group
      const newGroup: TeachingGroup = {
        id: String(Date.now()),
        name: data.name,
        groupLead: selectedTeacher,
        members: [selectedTeacher],
      };
      setGroups([...groups, newGroup]);
    }

    setOpen(false);
    setEditingGroupId(null);
    form.reset();
  };

  const handleDelete = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const handleEdit = (group: TeachingGroup) => {
    setEditingGroupId(group.id);
    form.setValue("name", group.name);
    form.setValue("groupLeadId", group.groupLead.id);
    setOpen(true);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setEditingGroupId(null);
      form.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-group">
              <Plus className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGroupId ? "Edit Teaching Group" : "Create Teaching Group"}
              </DialogTitle>
              <DialogDescription>
                {editingGroupId 
                  ? "Update the teaching group details and group lead" 
                  : "Create a new teaching group and assign a group lead"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., English Department"
                          {...field}
                          data-testid="input-group-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="groupLeadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Lead</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-group-lead">
                            <SelectValue placeholder="Select a teacher" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mockTeachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-group">
                    {editingGroupId ? "Update Group" : "Create Group"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <Card key={group.id} data-testid={`card-group-${group.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(group)}
                    data-testid={`button-edit-group-${group.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(group.id)}
                    data-testid={`button-delete-group-${group.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="text-sm text-muted-foreground">Group Lead</span>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {group.groupLead.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{group.groupLead.name}</span>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground mb-2 block">Members</span>
                <div className="flex flex-wrap gap-2">
                  {group.members.map((member) => (
                    <Badge key={member.id} variant="secondary" className="text-xs">
                      {member.initials}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
