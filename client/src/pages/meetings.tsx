import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import type { Meeting, SchoolMembership, MeetingAttendee, MeetingAction } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageSquare, Plus, Users, CheckSquare, X, Trash2 } from "lucide-react";
import { format } from "date-fns";

type FormType = "conversation" | "meeting" | null;

interface Teacher {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface ActionItem {
  description: string;
  assignedToMembershipId: string;
  dueDate?: string;
}

export default function Meetings() {
  const { toast } = useToast();
  const { user, isCreator } = useAuth();
  const { currentSchoolId } = useSchool();
  const [formType, setFormType] = useState<FormType>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newAction, setNewAction] = useState({ description: "", assignedToMembershipId: "", dueDate: "" });

  const [formData, setFormData] = useState({
    type: "two_person",
    subject: "",
    details: "",
    rating: "",
    minutes: "",
  });

  // Get current user's membership
  const { data: currentMembership } = useQuery<SchoolMembership>({
    queryKey: ["/api/my-membership-role", currentSchoolId],
    enabled: !!user && !!currentSchoolId && !isCreator,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/schools/${currentSchoolId}/memberships`);
        if (!response.ok) return null;
        const memberships = await response.json();
        return memberships.find((m: any) => m.userId === user?.id) || null;
      } catch {
        return null;
      }
    },
  });

  // Fetch teachers/memberships for attendee selection
  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/schools", currentSchoolId, "memberships"],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${currentSchoolId}/memberships`);
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

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings", currentSchoolId],
    queryFn: async () => {
      const response = await fetch(`/api/meetings?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch meetings");
      return response.json();
    },
    enabled: !!currentSchoolId,
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: { meeting: typeof formData; attendees: string[]; actions: ActionItem[] }) => {
      // Create the meeting first
      const meetingResponse = await apiRequest("POST", "/api/meetings", {
        ...data.meeting,
        schoolId: currentSchoolId,
        organizerId: user?.id,
      });

      const meeting = await meetingResponse.json();
      const meetingId = meeting.id;

      // Add attendees
      if (data.attendees.length > 0) {
        await Promise.all(
          data.attendees.map((membershipId) =>
            apiRequest("POST", "/api/meeting-attendees", {
              meetingId,
              membershipId,
              attendanceStatus: "pending",
              isRequired: true,
            })
          )
        );
      }

      // Add action items
      if (data.actions.length > 0 && currentMembership) {
        await Promise.all(
          data.actions.map((action) =>
            apiRequest("POST", "/api/meeting-actions", {
              meetingId,
              assignedToMembershipId: action.assignedToMembershipId,
              createdByMembershipId: currentMembership.id,
              description: action.description,
              status: "open",
              dueDate: action.dueDate || null,
            })
          )
        );
      }

      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", currentSchoolId] });
      toast({
        title: "Success",
        description: `${formType === "conversation" ? "Conversation" : "Meeting"} created successfully`,
      });
      resetForm();
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to create ${formType}`,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({ type: "two_person", subject: "", details: "", rating: "", minutes: "" });
    setSelectedAttendees([]);
    setActionItems([]);
    setNewAction({ description: "", assignedToMembershipId: "", dueDate: "" });
    setFormType(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.details) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createMeetingMutation.mutate({
      meeting: formData,
      attendees: selectedAttendees,
      actions: actionItems,
    });
  };

  const toggleAttendee = (membershipId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(membershipId)
        ? prev.filter((id) => id !== membershipId)
        : [...prev, membershipId]
    );
  };

  const addActionItem = () => {
    if (!newAction.description || !newAction.assignedToMembershipId) {
      toast({
        title: "Error",
        description: "Please fill in action description and assignee",
        variant: "destructive",
      });
      return;
    }
    setActionItems([...actionItems, newAction]);
    setNewAction({ description: "", assignedToMembershipId: "", dueDate: "" });
  };

  const removeActionItem = (index: number) => {
    setActionItems(actionItems.filter((_, i) => i !== index));
  };

  const filteredMeetings = meetings.filter((meeting) => {
    if (filterType === "all") return true;
    return meeting.type === filterType;
  });

  const ratingColors = {
    "Best Practice": "bg-success/10 text-success border-success/20",
    "Neutral": "bg-muted text-muted-foreground border-border",
    "Concern": "bg-destructive/10 text-destructive border-destructive/20",
  };

  const getTeacherName = (membershipId: string) => {
    const teacher = teachers.find((t) => t.id === membershipId);
    return teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unknown";
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground mt-1">
            Track meetings, conversations, and action items
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setFormType("conversation")}
            data-testid="button-toggle-conversation"
            variant="outline"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            New Conversation
          </Button>
          <Button
            onClick={() => setFormType("meeting")}
            data-testid="button-toggle-meeting"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Meeting
          </Button>
        </div>
      </div>

      {formType && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {formType === "conversation" ? "New Conversation" : "Create New Meeting"}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetForm}
                data-testid="button-close-form"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger data-testid="select-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="two_person">Two-Person</SelectItem>
                      <SelectItem value="group">Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formType === "meeting" && (
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (Optional)</Label>
                    <Select
                      value={formData.rating}
                      onValueChange={(value) =>
                        setFormData({ ...formData, rating: value })
                      }
                    >
                      <SelectTrigger data-testid="select-rating">
                        <SelectValue placeholder="None (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Best Practice">Best Practice</SelectItem>
                        <SelectItem value="Neutral">Neutral</SelectItem>
                        <SelectItem value="Concern">Concern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  placeholder={formType === "conversation" ? "Conversation topic" : "Meeting subject"}
                  required
                  data-testid="input-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="details">Details</Label>
                <Textarea
                  id="details"
                  value={formData.details}
                  onChange={(e) =>
                    setFormData({ ...formData, details: e.target.value })
                  }
                  placeholder={formType === "conversation" ? "Conversation notes" : "Meeting details and discussion points"}
                  rows={4}
                  required
                  data-testid="textarea-details"
                />
              </div>

              {formType === "meeting" && (
                <div className="space-y-2">
                  <Label htmlFor="minutes">Minutes (Optional)</Label>
                  <Textarea
                    id="minutes"
                    value={formData.minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, minutes: e.target.value })
                    }
                    placeholder="Meeting minutes and notes"
                    rows={4}
                    data-testid="textarea-minutes"
                  />
                </div>
              )}

              {/* Attendees Section */}
              <div className="space-y-4 border-t pt-4">
                <Label className="text-base font-semibold">Attendees</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2 border rounded-md">
                  {teachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center gap-2"
                      data-testid={`attendee-${teacher.id}`}
                    >
                      <Checkbox
                        id={`attendee-${teacher.id}`}
                        checked={selectedAttendees.includes(teacher.id)}
                        onCheckedChange={() => toggleAttendee(teacher.id)}
                        data-testid={`checkbox-attendee-${teacher.id}`}
                      />
                      <label
                        htmlFor={`attendee-${teacher.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {teacher.firstName} {teacher.lastName}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({teacher.role})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
                {selectedAttendees.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedAttendees.length} attendee(s) selected
                  </p>
                )}
              </div>

              {/* Action Items Section */}
              <div className="space-y-4 border-t pt-4">
                <Label className="text-base font-semibold">Action Items</Label>
                
                {actionItems.length > 0 && (
                  <div className="space-y-2">
                    {actionItems.map((action, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-3 border rounded-md bg-muted/30"
                        data-testid={`action-item-${index}`}
                      >
                        <CheckSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{action.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Assigned to: {getTeacherName(action.assignedToMembershipId)}
                            {action.dueDate && ` • Due: ${format(new Date(action.dueDate), "MMM d, yyyy")}`}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeActionItem(index)}
                          data-testid={`button-remove-action-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 p-3 border rounded-md">
                  <div className="space-y-2">
                    <Label htmlFor="action-description">Description</Label>
                    <Input
                      id="action-description"
                      value={newAction.description}
                      onChange={(e) =>
                        setNewAction({ ...newAction, description: e.target.value })
                      }
                      placeholder="Action item description"
                      data-testid="input-action-description"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="action-assignee">Assign To</Label>
                      <Select
                        value={newAction.assignedToMembershipId}
                        onValueChange={(value) =>
                          setNewAction({ ...newAction, assignedToMembershipId: value })
                        }
                      >
                        <SelectTrigger data-testid="select-action-assignee">
                          <SelectValue placeholder="Select teacher" />
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

                    <div className="space-y-2">
                      <Label htmlFor="action-due">Due Date (Optional)</Label>
                      <Input
                        id="action-due"
                        type="date"
                        value={newAction.dueDate}
                        onChange={(e) =>
                          setNewAction({ ...newAction, dueDate: e.target.value })
                        }
                        data-testid="input-action-due"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addActionItem}
                    data-testid="button-add-action"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Action Item
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createMeetingMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMeetingMutation.isPending
                    ? "Creating..."
                    : `Create ${formType === "conversation" ? "Conversation" : "Meeting"}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Meetings</CardTitle>
            <div className="flex gap-2 items-center">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48" data-testid="select-filter-type">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="two_person">Two-Person</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {meetingsLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="meetings-loading">
              Loading meetings...
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="meetings-empty">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No meetings found</p>
              <p className="text-sm">Create your first meeting to get started</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMeetings.map((meeting) => (
                    <TableRow key={meeting.id} data-testid={`meeting-row-${meeting.id}`}>
                      <TableCell className="whitespace-nowrap" data-testid={`meeting-date-${meeting.id}`}>
                        {format(new Date(meeting.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell data-testid={`meeting-type-${meeting.id}`}>
                        <Badge variant="outline" className="gap-1">
                          {meeting.type === "two_person" ? (
                            <>
                              <Users className="w-3 h-3" />
                              Two-Person
                            </>
                          ) : (
                            <>
                              <Users className="w-3 h-3" />
                              Group
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`meeting-subject-${meeting.id}`}>{meeting.subject}</TableCell>
                      <TableCell className="max-w-md truncate" data-testid={`meeting-details-${meeting.id}`}>
                        {meeting.details}
                      </TableCell>
                      <TableCell data-testid={`meeting-rating-${meeting.id}`}>
                        {meeting.rating && (
                          <Badge
                            variant="outline"
                            className={ratingColors[meeting.rating as keyof typeof ratingColors]}
                          >
                            {meeting.rating}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
