import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import type { Conversation, Teacher, SchoolMembership } from "@shared/schema";
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
import { MessageSquare, Plus, Download } from "lucide-react";
import { format } from "date-fns";
import { ConversationDetailsPanel } from "@/components/conversation-details-panel";

const ratingColors = {
  "Best Practice": "bg-success/10 text-success border-success/20",
  "Neutral": "bg-muted text-muted-foreground border-border",
  "Concern": "bg-destructive/10 text-destructive border-destructive/20",
};

export default function Conversations() {
  const { toast } = useToast();
  const { user, isCreator } = useAuth();
  const { currentSchoolId } = useSchool();
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [filterTeacherId, setFilterTeacherId] = useState<string>("all");
  const [filterRating, setFilterRating] = useState<string>("all");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    teacherId: "",
    subject: "",
    details: "",
    rating: "",
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

  // Leaders, Admins, and Creators can export
  const canExport = isCreator || currentMembership?.role === "Admin" || currentMembership?.role === "Leader";

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations", currentSchoolId],
    queryFn: async () => {
      const response = await fetch(`/api/conversations?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
    enabled: !!currentSchoolId,
  });

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers", currentSchoolId],
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
    enabled: !!currentSchoolId,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/conversations", {
        ...data,
        schoolId: currentSchoolId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", currentSchoolId] });
      toast({
        title: "Success",
        description: "Conversation recorded successfully",
      });
      setFormData({ teacherId: "", subject: "", details: "", rating: "" });
      setIsFormVisible(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record conversation",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teacherId || !formData.subject || !formData.details || !formData.rating) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    createConversationMutation.mutate(formData);
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesTeacher = filterTeacherId === "all" || conv.teacherId === filterTeacherId;
    const matchesRating = filterRating === "all" || conv.rating === filterRating;
    return matchesTeacher && matchesRating;
  });

  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find((t) => t.id === teacherId);
    return teacher?.name || "Unknown Teacher";
  };

  const exportToCSV = () => {
    const headers = ["Date", "Teacher", "Subject", "Details", "Rating"];
    const rows = filteredConversations.map((conv) => [
      format(new Date(conv.createdAt), "yyyy-MM-dd HH:mm:ss"),
      getTeacherName(conv.teacherId),
      conv.subject,
      conv.details.replace(/"/g, '""'), // Escape quotes in CSV
      conv.rating,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `conversations_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: `Exported ${filteredConversations.length} conversations to CSV`,
    });
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
          <p className="text-muted-foreground mt-1">
            Record and track teacher-to-teacher conversations
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredConversations.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Button
            onClick={() => setIsFormVisible(!isFormVisible)}
            data-testid="button-add-conversation"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isFormVisible ? "Cancel" : "Add Conversation"}
          </Button>
        </div>
      </div>

      {isFormVisible && (
        <Card data-testid="card-conversation-form">
          <CardHeader>
            <CardTitle>Record a Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teacher">Teacher</Label>
                <Select
                  value={formData.teacherId}
                  onValueChange={(value) => setFormData({ ...formData, teacherId: value })}
                >
                  <SelectTrigger id="teacher" data-testid="select-teacher">
                    <SelectValue placeholder="Select a teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Conversation Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Classroom Management Strategies"
                  data-testid="input-subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="details">Details</Label>
                <Textarea
                  id="details"
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Describe the conversation..."
                  rows={4}
                  data-testid="textarea-details"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rating">Rating</Label>
                <Select
                  value={formData.rating}
                  onValueChange={(value) => setFormData({ ...formData, rating: value })}
                >
                  <SelectTrigger id="rating" data-testid="select-rating">
                    <SelectValue placeholder="Select a rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Best Practice">Best Practice</SelectItem>
                    <SelectItem value="Neutral">Neutral</SelectItem>
                    <SelectItem value="Concern">Concern</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormVisible(false);
                    setFormData({ teacherId: "", subject: "", details: "", rating: "" });
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createConversationMutation.isPending}
                  data-testid="button-submit"
                >
                  {createConversationMutation.isPending ? "Saving..." : "Save Conversation"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex gap-3">
          <Select value={filterTeacherId} onValueChange={setFilterTeacherId}>
            <SelectTrigger className="w-[220px]" data-testid="select-filter-teacher">
              <SelectValue placeholder="All teachers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teachers</SelectItem>
              {teachers.map((teacher) => (
                <SelectItem key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-rating">
              <SelectValue placeholder="All ratings" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ratings</SelectItem>
              <SelectItem value="Best Practice">Best Practice</SelectItem>
              <SelectItem value="Neutral">Neutral</SelectItem>
              <SelectItem value="Concern">Concern</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg" data-testid="table-conversations">
          {conversationsLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No conversations recorded yet</p>
              <p className="text-sm mt-1">Click "Add Conversation" to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConversations.map((conversation) => (
                  <TableRow
                    key={conversation.id}
                    className="cursor-pointer"
                    data-testid={`row-conversation-${conversation.id}`}
                    onClick={() => setSelectedConversationId(conversation.id)}
                  >
                    <TableCell className="text-sm text-muted-foreground" data-testid={`text-date-${conversation.id}`}>
                      {format(new Date(conversation.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-teacher-${conversation.id}`}>
                      {getTeacherName(conversation.teacherId)}
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-subject-${conversation.id}`}>
                      {conversation.subject}
                    </TableCell>
                    <TableCell className="max-w-md truncate" data-testid={`text-details-${conversation.id}`}>
                      {conversation.details}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ratingColors[conversation.rating as keyof typeof ratingColors]}
                        data-testid={`badge-rating-${conversation.id}`}
                      >
                        {conversation.rating}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <ConversationDetailsPanel
        isOpen={selectedConversationId !== null}
        onClose={() => setSelectedConversationId(null)}
        conversation={
          selectedConversationId
            ? {
                ...conversations.find((c) => c.id === selectedConversationId)!,
                teacherName: getTeacherName(conversations.find((c) => c.id === selectedConversationId)?.teacherId || ""),
              }
            : null
        }
      />
    </div>
  );
}
