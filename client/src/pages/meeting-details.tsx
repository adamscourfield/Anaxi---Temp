import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Users, Calendar, CheckSquare, User, CheckCircle, Clock, Plus } from "lucide-react";
import { format } from "date-fns";
import { useSchool } from "@/hooks/use-school";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Teacher {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function MeetingDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { currentSchoolId } = useSchool();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddAction, setShowAddAction] = useState(false);
  const [newActionDescription, setNewActionDescription] = useState("");
  const [newActionAssignee, setNewActionAssignee] = useState("");
  const [newActionDueDate, setNewActionDueDate] = useState("");

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["/api/meetings", id],
    enabled: !!id,
  });

  const { data: attendees = [] } = useQuery({
    queryKey: ["/api/meetings", id, "attendees"],
    enabled: !!id,
  });

  const { data: actions = [] } = useQuery({
    queryKey: ["/api/meetings", id, "actions"],
    enabled: !!id,
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/schools", meeting?.schoolId, "memberships"],
    enabled: !!meeting?.schoolId,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${meeting?.schoolId}/memberships`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      const memberships = await response.json();
      return memberships.map((m: any) => ({
        id: m.id,
        userId: m.userId,
        email: m.user?.email || "",
        firstName: m.user?.first_name || "",
        lastName: m.user?.last_name || "",
        role: m.role,
      }));
    },
  });

  const { data: currentMembership } = useQuery({
    queryKey: ["/api/my-membership-role", meeting?.schoolId],
    enabled: !!user && !!meeting?.schoolId,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/schools/${meeting?.schoolId}/memberships`);
        if (!response.ok) return null;
        const memberships = await response.json();
        return memberships.find((m: any) => m.userId === user?.id) || null;
      } catch {
        return null;
      }
    },
  });

  const isCreator = user?.global_role === "Creator";
  const isManagerOrAbove = isCreator || 
    (currentMembership && (currentMembership.role === "Admin" || currentMembership.role === "Leader"));

  const addActionMutation = useMutation({
    mutationFn: async (data: { description: string; assignedToMembershipId: string; dueDate?: string }) => {
      const createdByMembershipId = isCreator
        ? teachers.find((t: Teacher) => t.userId === user?.id)?.id || data.assignedToMembershipId
        : currentMembership?.id;
      const res = await apiRequest("POST", `/api/meetings/${id}/actions`, {
        ...data,
        createdByMembershipId,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", id, "actions"] });
      toast({ title: "Action item added" });
      setNewActionDescription("");
      setNewActionAssignee("");
      setNewActionDueDate("");
      setShowAddAction(false);
    },
    onError: () => {
      toast({ title: "Failed to add action item", variant: "destructive" });
    },
  });

  const handleAddAction = () => {
    if (!newActionDescription.trim() || !newActionAssignee) {
      toast({ title: "Please fill in the description and assign to someone", variant: "destructive" });
      return;
    }
    addActionMutation.mutate({
      description: newActionDescription.trim(),
      assignedToMembershipId: newActionAssignee,
      dueDate: newActionDueDate || undefined,
    });
  };

  // Manager confirmation mutation - toggles the 'completed' field
  const managerConfirmMutation = useMutation({
    mutationFn: async ({ actionId, completed }: { actionId: string; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/meetings/${id}/actions/${actionId}`, {
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", id, "actions"] });
      toast({ title: "Action updated" });
    },
    onError: () => {
      toast({ title: "Failed to update action", variant: "destructive" });
    },
  });

  // Filter out current user from attendees
  const filteredAttendees = useMemo(() => {
    return attendees.filter((a: any) => a.userId !== user?.id);
  }, [attendees, user?.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading meeting details...</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-lg">Meeting not found</div>
        <Button onClick={() => setLocation("/meetings")}>
          Back to Meetings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/meetings")}
            data-testid="button-back-to-meetings"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="meeting-title">
              {meeting.subject}
            </h1>
            <p className="text-sm text-muted-foreground">
              Meeting Details
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Meeting Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Meeting Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Type
                  </label>
                  <div className="mt-1">
                    <Badge variant="outline" className="gap-1">
                      <Users className="w-3 h-3" />
                      {meeting.type}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Date
                  </label>
                  <p className="mt-1" data-testid="meeting-date">
                    {format(new Date(meeting.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                {meeting.organizerId && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Organizer
                    </label>
                    <p className="mt-1 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {meeting.organizerName || "Unknown"}
                    </p>
                  </div>
                )}
                {meeting.departmentId && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Department
                    </label>
                    <p className="mt-1">{meeting.departmentName || "Unknown"}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Meeting Notes/Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Meeting Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap" data-testid="meeting-details">
                  {meeting.details || "No notes recorded for this meeting."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Attendees Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Attendees {filteredAttendees.length > 0 && `(${filteredAttendees.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAttendees.length > 0 ? (
                <div className="space-y-3">
                  {filteredAttendees.map((attendee: any) => (
                    <div
                      key={attendee.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`attendee-${attendee.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{attendee.name}</p>
                          {attendee.role && (
                            <p className="text-sm text-muted-foreground">
                              {attendee.role}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {attendee.attendeeRole && (
                          <Badge variant="secondary">{attendee.attendeeRole}</Badge>
                        )}
                        <Badge
                          variant={
                            attendee.attendanceStatus === "attended"
                              ? "default"
                              : attendee.attendanceStatus === "declined"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {attendee.attendanceStatus || "pending"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No attendees recorded for this meeting.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Action Items Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Action Items {actions.length > 0 && `(${actions.length})`}
              </CardTitle>
              {isManagerOrAbove && !showAddAction && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddAction(true)}
                  data-testid="button-add-action"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Action
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {showAddAction && (
                <div className="space-y-4 p-4 rounded-lg border mb-4" data-testid="form-add-action">
                  <div>
                    <Label htmlFor="action-description">Description</Label>
                    <Input
                      id="action-description"
                      placeholder="Describe the action item..."
                      value={newActionDescription}
                      onChange={(e) => setNewActionDescription(e.target.value)}
                      data-testid="input-action-description"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="action-assignee">Assign To</Label>
                      <Select value={newActionAssignee} onValueChange={setNewActionAssignee}>
                        <SelectTrigger data-testid="select-action-assignee">
                          <SelectValue placeholder="Select a person" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.firstName} {teacher.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="action-due-date">Due Date (Optional)</Label>
                      <Input
                        id="action-due-date"
                        type="date"
                        value={newActionDueDate}
                        onChange={(e) => setNewActionDueDate(e.target.value)}
                        data-testid="input-action-due-date"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddAction}
                      disabled={addActionMutation.isPending}
                      data-testid="button-save-action"
                    >
                      {addActionMutation.isPending ? "Saving..." : "Save Action"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowAddAction(false);
                        setNewActionDescription("");
                        setNewActionAssignee("");
                        setNewActionDueDate("");
                      }}
                      data-testid="button-cancel-action"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {actions.length > 0 ? (
                <div className="space-y-3">
                  {actions.map((action: any) => (
                    <div
                      key={action.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border ${action.completed ? "opacity-75" : ""}`}
                      data-testid={`action-${action.id}`}
                    >
                      <CheckSquare
                        className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          action.completed
                            ? "text-green-600"
                            : action.userCompleted
                            ? "text-amber-500"
                            : "text-muted-foreground"
                        }`}
                      />
                      <div className="flex-1 space-y-2">
                        <p className={`font-medium ${action.completed ? "line-through" : ""}`}>{action.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {action.assignedTo && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Assigned to: {action.assignedTo}
                            </span>
                          )}
                          {action.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Due: {format(new Date(action.dueDate), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {action.completed ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="w-3 h-3" /> Fully Completed
                            </Badge>
                          ) : action.userCompleted ? (
                            <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
                              <Clock className="w-3 h-3" /> User Marked Complete
                            </Badge>
                          ) : (
                            <Badge variant={action.status === "in_progress" ? "secondary" : "outline"}>
                              {action.status || "open"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {action.completed ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => managerConfirmMutation.mutate({ actionId: action.id, completed: false })}
                            disabled={managerConfirmMutation.isPending}
                            data-testid={`button-undo-confirm-${action.id}`}
                          >
                            Undo
                          </Button>
                        ) : action.userCompleted ? (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => managerConfirmMutation.mutate({ actionId: action.id, completed: true })}
                            disabled={managerConfirmMutation.isPending}
                            data-testid={`button-confirm-action-${action.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Confirm Complete
                          </Button>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Awaiting user</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No action items recorded for this meeting.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
