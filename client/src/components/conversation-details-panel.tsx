import { SidePanel } from "./side-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar, MessageSquare, User } from "lucide-react";

interface ConversationDetailsData {
  id: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  details: string;
  rating: string;
  createdAt: Date;
}

interface ConversationDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: ConversationDetailsData | null;
}

const ratingColors = {
  "Best Practice": "bg-success/10 text-success border-success/20",
  "Neutral": "bg-muted text-muted-foreground border-border",
  "Concern": "bg-destructive/10 text-destructive border-destructive/20",
};

export function ConversationDetailsPanel({
  isOpen,
  onClose,
  conversation,
}: ConversationDetailsPanelProps) {
  if (!conversation) return null;

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Conversation Details"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{getInitials(conversation.teacherName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">{conversation.teacherName}</h3>
            <p className="text-sm text-muted-foreground">Teacher</p>
          </div>
          <Badge
            variant="outline"
            className={ratingColors[conversation.rating as keyof typeof ratingColors]}
            data-testid="badge-detail-rating"
          >
            {conversation.rating}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(conversation.createdAt, "MMMM d, yyyy 'at' h:mm a")}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Subject</p>
                  <p className="text-sm font-medium" data-testid="text-detail-subject">
                    {conversation.subject}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Teacher Involved</p>
                  <p className="text-sm" data-testid="text-detail-teacher">
                    {conversation.teacherName}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Conversation Details</h3>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm whitespace-pre-wrap" data-testid="text-detail-details">
                {conversation.details}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Rating</h3>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={ratingColors[conversation.rating as keyof typeof ratingColors]}
                >
                  {conversation.rating}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {conversation.rating === "Best Practice" && "This conversation highlights an excellent teaching practice"}
                  {conversation.rating === "Neutral" && "This conversation is informational"}
                  {conversation.rating === "Concern" && "This conversation raises an area that needs attention"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidePanel>
  );
}
