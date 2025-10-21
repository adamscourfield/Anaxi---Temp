import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import type { Meeting, SchoolMembership } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { MessageSquare, Plus, Users, CheckSquare } from "lucide-react";
import { format } from "date-fns";

export default function Meetings() {
  const { toast } = useToast();
  const { user, isCreator } = useAuth();
  const { currentSchoolId } = useSchool();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const [formData, setFormData] = useState({
    type: "two_person",
    subject: "",
    details: "",
    rating: "",
    minutes: "",
  });

  // Get current user's membership to check role
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
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/meetings", {
        ...data,
        schoolId: currentSchoolId,
        organizerId: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings", currentSchoolId] });
      toast({
        title: "Success",
        description: "Meeting created successfully",
      });
      setFormData({ type: "two_person", subject: "", details: "", rating: "", minutes: "" });
      setIsFormVisible(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create meeting",
        variant: "destructive",
      });
    },
  });

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
    createMeetingMutation.mutate(formData);
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meetings</h1>
          <p className="text-muted-foreground">
            Track meetings, discussions, and action items
          </p>
        </div>
        <Button
          onClick={() => setIsFormVisible(!isFormVisible)}
          data-testid="button-toggle-form"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Meeting
        </Button>
      </div>

      {isFormVisible && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Meeting</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Meeting Type</Label>
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
                      <SelectItem value="two_person">Two-Person Meeting</SelectItem>
                      <SelectItem value="group">Group Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rating">Rating (Optional)</Label>
                  <Select
                    value={formData.rating}
                    onValueChange={(value) =>
                      setFormData({ ...formData, rating: value })
                    }
                  >
                    <SelectTrigger data-testid="select-rating">
                      <SelectValue placeholder="Select rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      <SelectItem value="Best Practice">Best Practice</SelectItem>
                      <SelectItem value="Neutral">Neutral</SelectItem>
                      <SelectItem value="Concern">Concern</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  placeholder="Meeting subject"
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
                  placeholder="Meeting details and discussion points"
                  rows={4}
                  required
                  data-testid="textarea-details"
                />
              </div>

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

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createMeetingMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMeetingMutation.isPending ? "Creating..." : "Create Meeting"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormVisible(false)}
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
