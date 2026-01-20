import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import type { Meeting, SchoolMembership, MeetingAttendee, MeetingAction, Department } from "@shared/schema";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MessageSquare, Plus, Users, CheckSquare, X, Trash2, UserPlus, Check, Eye } from "lucide-react";
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
  const [, setLocation] = useLocation();
  const [formType, setFormType] = useState<FormType>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [attendeeSearchOpen, setAttendeeSearchOpen] = useState(false);
  const [peopleFilterOpen, setPeopleFilterOpen] = useState(false);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newAction, setNewAction] = useState({ description: "", assignedToMembershipId: "", dueDate: "" });

  const [formData, setFormData] = useState({
    type: "Line Management",
    subject: "",
    details: "",
    staffMemberId: "", // For conversations - single staff member
    departmentId: "", // For department meetings
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

  // Fetch departments for the current school
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ["/api/schools", currentSchoolId, "departments"],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${currentSchoolId}/departments`);
      if (!response.ok) throw new Error("Failed to fetch departments");
      return response.json();
    },
  });

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<any[]>({
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
      // Build the correct data structure based on form type
      let meetingPayload;
      if (formType === "conversation") {
        // Conversations are meetings with type="Conversation"
        meetingPayload = {
          type: "Conversation",
          subject: data.meeting.subject,
          details: data.meeting.details,
          schoolId: currentSchoolId,
          organizerId: user?.id,
          departmentId: null,
        };
      } else {
        // Meetings have: type, subject, details
        meetingPayload = {
          type: data.meeting.type,
          subject: data.meeting.subject,
          details: data.meeting.details,
          schoolId: currentSchoolId,
          organizerId: user?.id,
          departmentId: data.meeting.type === "Department" ? data.meeting.departmentId : null,
        };
      }

      // Create the meeting first
      const meetingResponse = await apiRequest("POST", "/api/meetings", meetingPayload);

      const meeting = await meetingResponse.json();
      const meetingId = meeting.id;

      // Add attendees (for meetings) or single staff member (for conversations)
      if (formType === "conversation" && data.meeting.staffMemberId) {
        // For conversations, add the single staff member as an attendee
        try {
          await apiRequest("POST", `/api/meetings/${meetingId}/attendees`, {
            membershipId: data.meeting.staffMemberId,
            attendanceStatus: "pending",
            isRequired: true,
          });
        } catch (error) {
          console.error("Failed to add staff member to conversation:", error);
          throw new Error("Failed to add staff member to conversation");
        }
      } else if (formType === "meeting" && data.attendees.length > 0) {
        // For meetings, add all selected attendees
        const attendeeResults = await Promise.allSettled(
          data.attendees.map((membershipId) =>
            apiRequest("POST", `/api/meetings/${meetingId}/attendees`, {
              membershipId,
              attendanceStatus: "pending",
              isRequired: true,
            })
          )
        );
        
        // Check for failed attendee creations
        const failedAttendees = attendeeResults.filter(r => r.status === 'rejected');
        if (failedAttendees.length > 0) {
          console.error("Failed to add some attendees:", failedAttendees);
          throw new Error(`Failed to add ${failedAttendees.length} attendee(s)`);
        }
      }

      // Add action items (only for meetings, not conversations)
      if (formType === "meeting" && data.actions.length > 0 && currentMembership) {
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
    setFormData({ type: "Line Management", subject: "", details: "", staffMemberId: "", departmentId: "" });
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
    // Validate staff member for conversations
    if (formType === "conversation" && !formData.staffMemberId) {
      toast({
        title: "Error",
        description: "Please select a staff member for the conversation",
        variant: "destructive",
      });
      return;
    }
    // Validate department for department meetings
    if (formType === "meeting" && formData.type === "Department" && !formData.departmentId) {
      toast({
        title: "Error",
        description: "Please select a department for this meeting",
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

  const removeAttendee = (membershipId: string) => {
    setSelectedAttendees((prev) => prev.filter((id) => id !== membershipId));
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
    // Filter by type (including conversations)
    if (filterType !== "all") {
      if (filterType === "Conversation" && meeting.type !== "Conversation") return false;
      if (filterType !== "Conversation" && meeting.type !== filterType) return false;
    }
    
    // Filter by user/attendee
    if (filterUser !== "all") {
      const attendeeIds = meeting.attendees?.map((a: any) => a.membershipId) || [];
      if (!attendeeIds.includes(filterUser)) return false;
    }
    
    return true;
  });

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
              {/* Attendees Section - Top for Meetings */}
              {formType === "meeting" && (
                <div className="space-y-4 border-b pb-4">
                  <Label className="text-base font-semibold">Attendees</Label>
                  <Popover open={attendeeSearchOpen} onOpenChange={setAttendeeSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={attendeeSearchOpen}
                        className="w-full justify-between"
                        type="button"
                        data-testid="button-select-attendees"
                      >
                        <span className="flex items-center gap-2">
                          <UserPlus className="w-4 h-4" />
                          {selectedAttendees.length === 0
                            ? "Select attendees..."
                            : `${selectedAttendees.length} attendee${selectedAttendees.length > 1 ? "s" : ""} selected`}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search teachers..." data-testid="input-search-attendees" />
                        <CommandList>
                          <CommandEmpty>No teachers found.</CommandEmpty>
                          <CommandGroup>
                            {teachers.map((teacher) => (
                              <CommandItem
                                key={teacher.id}
                                value={teacher.id}
                                keywords={[teacher.firstName, teacher.lastName, teacher.email]}
                                onSelect={(value) => {
                                  toggleAttendee(value);
                                  setAttendeeSearchOpen(true); // Keep the popover open for multi-select
                                }}
                                data-testid={`command-item-attendee-${teacher.id}`}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedAttendees.includes(teacher.id) ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm">{teacher.firstName} {teacher.lastName}</span>
                                  <span className="text-xs text-muted-foreground">{teacher.role}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {selectedAttendees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedAttendees.map((membershipId) => {
                        const teacher = teachers.find((t) => t.id === membershipId);
                        if (!teacher) return null;
                        return (
                          <Badge
                            key={membershipId}
                            variant="secondary"
                            className="gap-1"
                            data-testid={`badge-attendee-${membershipId}`}
                          >
                            {teacher.firstName} {teacher.lastName}
                            <X
                              className="w-3 h-3 cursor-pointer hover-elevate"
                              onClick={() => removeAttendee(membershipId)}
                              data-testid={`button-remove-attendee-${membershipId}`}
                            />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {formType === "meeting" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="type">Meeting Type</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value) =>
                          setFormData({ ...formData, type: value, departmentId: "" })
                        }
                      >
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Line Management">Line Management</SelectItem>
                          <SelectItem value="Department">Department</SelectItem>
                          <SelectItem value="Leadership">Leadership</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.type === "Department" && (
                      <div className="space-y-2">
                        <Label htmlFor="department">Department *</Label>
                        <Select
                          value={formData.departmentId}
                          onValueChange={(value) =>
                            setFormData({ ...formData, departmentId: value })
                          }
                        >
                          <SelectTrigger data-testid="select-department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                {formType === "conversation" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="staffMember">Staff Member</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            type="button"
                            data-testid="button-select-staff-member"
                          >
                            <span className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              {formData.staffMemberId
                                ? teachers.find((t) => t.id === formData.staffMemberId)?.firstName + " " + teachers.find((t) => t.id === formData.staffMemberId)?.lastName
                                : "Select staff member..."}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search staff..." data-testid="input-search-staff-member" />
                            <CommandList>
                              <CommandEmpty>No staff found.</CommandEmpty>
                              <CommandGroup>
                                {teachers.map((teacher) => (
                                  <CommandItem
                                    key={teacher.id}
                                    value={`${teacher.firstName} ${teacher.lastName}`}
                                    onSelect={() => setFormData({ ...formData, staffMemberId: teacher.id })}
                                    data-testid={`command-item-staff-${teacher.id}`}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        formData.staffMemberId === teacher.id ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    <div className="flex flex-col">
                                      <span className="text-sm">{teacher.firstName} {teacher.lastName}</span>
                                      <span className="text-xs text-muted-foreground">{teacher.role}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
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

              {/* Action Items Section - Only for Meetings */}
              {formType === "meeting" && (
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
              )}

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
            <div className="flex gap-2 items-center flex-wrap">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48" data-testid="select-filter-type">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Conversation">Conversations</SelectItem>
                  <SelectItem value="Line Management">Line Management</SelectItem>
                  <SelectItem value="Department">Department</SelectItem>
                  <SelectItem value="Leadership">Leadership</SelectItem>
                </SelectContent>
              </Select>
              <Popover open={peopleFilterOpen} onOpenChange={setPeopleFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={peopleFilterOpen}
                    className="w-48 justify-between"
                    data-testid="button-filter-user"
                  >
                    <span className="truncate">
                      {filterUser === "all" ? "All People" : getTeacherName(filterUser)}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search people..." data-testid="input-search-filter-user" />
                    <CommandList>
                      <CommandEmpty>No person found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="all"
                          onSelect={() => {
                            setFilterUser("all");
                            setPeopleFilterOpen(false);
                          }}
                          data-testid="command-item-filter-all"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${filterUser === "all" ? "opacity-100" : "opacity-0"}`}
                          />
                          All People
                        </CommandItem>
                        {teachers.map((teacher) => (
                          <CommandItem
                            key={teacher.id}
                            value={teacher.id}
                            keywords={[teacher.firstName, teacher.lastName, teacher.email]}
                            onSelect={(value) => {
                              setFilterUser(value);
                              setPeopleFilterOpen(false);
                            }}
                            data-testid={`command-item-filter-${teacher.id}`}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${filterUser === teacher.id ? "opacity-100" : "opacity-0"}`}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{teacher.firstName} {teacher.lastName}</span>
                              <span className="text-xs text-muted-foreground">{teacher.role}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50 accent-icon" />
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
                    <TableHead>Attendees</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMeetings.map((meeting: any) => (
                    <TableRow key={meeting.id} data-testid={`meeting-row-${meeting.id}`}>
                      <TableCell className="whitespace-nowrap" data-testid={`meeting-date-${meeting.id}`}>
                        {format(new Date(meeting.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell data-testid={`meeting-type-${meeting.id}`}>
                        <Badge variant="outline" className="gap-1">
                          <Users className="w-3 h-3" />
                          {meeting.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium" data-testid={`meeting-subject-${meeting.id}`}>{meeting.subject}</TableCell>
                      <TableCell data-testid={`meeting-attendees-${meeting.id}`}>
                        {(() => {
                          const filteredAttendees = meeting.attendees?.filter((a: any) => a.userId !== user?.id) || [];
                          return filteredAttendees.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {filteredAttendees.slice(0, 3).map((attendee: any, index: number) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {attendee.name}
                                </Badge>
                              ))}
                              {filteredAttendees.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{filteredAttendees.length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No attendees</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="max-w-md truncate" data-testid={`meeting-details-${meeting.id}`}>
                        {meeting.details}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setLocation(`/meetings/${meeting.id}`)}
                          data-testid={`button-view-meeting-${meeting.id}`}
                        >
                          <Eye className="w-4 h-4 accent-icon" />
                        </Button>
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
