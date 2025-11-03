import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Users, Calendar, CheckSquare, User } from "lucide-react";
import { format } from "date-fns";
import { useSchool } from "@/hooks/use-school";

export default function MeetingDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { currentSchoolId } = useSchool();

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
                Attendees {attendees.length > 0 && `(${attendees.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendees.length > 0 ? (
                <div className="space-y-3">
                  {attendees.map((attendee: any) => (
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Action Items {actions.length > 0 && `(${actions.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {actions.length > 0 ? (
                <div className="space-y-3">
                  {actions.map((action: any) => (
                    <div
                      key={action.id}
                      className="flex items-start gap-3 p-4 rounded-lg border"
                      data-testid={`action-${action.id}`}
                    >
                      <CheckSquare
                        className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                          action.status === "completed"
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      />
                      <div className="flex-1 space-y-2">
                        <p className="font-medium">{action.description}</p>
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
                        <Badge
                          variant={
                            action.status === "completed"
                              ? "default"
                              : action.status === "in_progress"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {action.status || "open"}
                        </Badge>
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
