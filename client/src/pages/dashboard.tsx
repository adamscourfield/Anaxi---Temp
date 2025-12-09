import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import type { User, SchoolMembership, School } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  Users,
  ClipboardCheck,
  TrendingUp,
  Calendar,
  MessageSquare,
  AlertCircle,
  CheckSquare,
  ArrowRight,
  Plus,
  Clock,
  FileText,
} from "lucide-react";

interface DashboardStats {
  totalObservations: number;
  activeTeachers: number;
  avgScore: number;
  improvement: number;
}

interface LeaveStats {
  pendingCount: number;
  myPendingCount: number;
  upcomingLeave: number;
}

interface MeetingStats {
  upcomingCount: number;
  overdueActionsCount: number;
  myActionsCount: number;
}

interface BehaviourStats {
  openOncallsCount: number;
  todayOncallsCount: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { currentSchoolId, currentSchool } = useSchool();

  const enabledFeatures = currentSchool?.enabled_features || [];
  const hasObservations = enabledFeatures.includes("observations");
  const hasMeetings = enabledFeatures.includes("meetings");
  const hasLeave = enabledFeatures.includes("absence_management");
  const hasBehaviour = enabledFeatures.includes("behaviour");

  // Get user's membership for current school
  const { data: userMemberships = [] } = useQuery<Array<SchoolMembership & { school?: any }>>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user,
  });

  const currentMembership = userMemberships.find(m => m.schoolId === currentSchoolId);
  const canApproveLeave = currentMembership?.canApproveLeaveRequests || false;
  const canManageBehaviour = currentMembership?.canManageBehaviour || false;

  // Observation stats (only if feature enabled)
  const { data: observationStats, isLoading: observationStatsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", currentSchoolId],
    enabled: !!currentSchoolId && hasObservations,
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Leave stats (only if feature enabled)
  const { data: leaveRequests = [], isLoading: leaveLoading } = useQuery<any[]>({
    queryKey: ["/api/leave-requests", currentSchoolId],
    enabled: !!currentSchoolId && hasLeave,
    queryFn: async () => {
      const response = await fetch(`/api/leave-requests?schoolId=${currentSchoolId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const leaveStats: LeaveStats = {
    pendingCount: leaveRequests.filter(lr => lr.status === "pending").length,
    myPendingCount: leaveRequests.filter(lr => lr.status === "pending" && lr.membershipId === currentMembership?.id).length,
    upcomingLeave: leaveRequests.filter(lr => lr.status === "approved" && new Date(lr.startDate) > new Date()).length,
  };

  // Meetings stats (only if feature enabled)
  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<any[]>({
    queryKey: ["/api/meetings", currentSchoolId],
    enabled: !!currentSchoolId && hasMeetings,
    queryFn: async () => {
      const response = await fetch(`/api/meetings?schoolId=${currentSchoolId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Get meeting actions for the current user
  const { data: myActions = [] } = useQuery<any[]>({
    queryKey: ["/api/meeting-actions/my", currentSchoolId],
    enabled: !!currentSchoolId && hasMeetings && !!currentMembership,
    queryFn: async () => {
      const response = await fetch(`/api/meeting-actions?membershipId=${currentMembership?.id}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const meetingStats: MeetingStats = {
    upcomingCount: meetings.filter(m => m.scheduledAt && new Date(m.scheduledAt) > new Date()).length,
    overdueActionsCount: myActions.filter((a: any) => a.status === "open" && a.dueDate && new Date(a.dueDate) < new Date()).length,
    myActionsCount: myActions.filter((a: any) => a.status === "open").length,
  };

  // Behaviour stats (only if feature enabled)
  const { data: oncalls = [], isLoading: oncallsLoading } = useQuery<any[]>({
    queryKey: ["/api/oncalls", currentSchoolId],
    enabled: !!currentSchoolId && hasBehaviour && canManageBehaviour,
    queryFn: async () => {
      const response = await fetch(`/api/oncalls?schoolId=${currentSchoolId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const behaviourStats: BehaviourStats = {
    openOncallsCount: oncalls.filter(o => o.status === "open").length,
    todayOncallsCount: oncalls.filter(o => {
      const created = new Date(o.createdAt);
      created.setHours(0, 0, 0, 0);
      return created.getTime() === today.getTime();
    }).length,
  };

  const userName = user?.first_name || user?.email?.split("@")[0] || "there";

  // Check if any features are enabled
  const hasAnyFeatures = hasObservations || hasMeetings || hasLeave || hasBehaviour;

  return (
    <div className="p-6 space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-welcome">
            Welcome back, {userName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening at {currentSchool?.name || "your school"}
          </p>
        </div>
      </div>

      {/* No features enabled state */}
      {!hasAnyFeatures && currentSchool && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No features enabled</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Contact your administrator to enable features like Observations, Meetings, Leave Management, or Behaviour Tracking.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Feature Widgets Grid */}
      {hasAnyFeatures && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Observations Widget */}
          {hasObservations && (
            <Card className="hover-elevate" data-testid="card-observations-widget">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Observations</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {observationStatsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-observations-count">
                      {observationStats?.totalObservations || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      observations this month
                    </p>
                    <div className="flex items-center gap-2 mt-4">
                      <Badge variant="secondary" className="gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {observationStats?.improvement || 0}% vs last month
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Link href="/observe">
                        <Button size="sm" data-testid="button-new-observation">
                          <Plus className="h-4 w-4 mr-1" />
                          New
                        </Button>
                      </Link>
                      <Link href="/history">
                        <Button size="sm" variant="outline" data-testid="button-view-observations">
                          View All
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Meetings Widget */}
          {hasMeetings && (
            <Card className="hover-elevate" data-testid="card-meetings-widget">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meetings</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {meetingsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-meetings-count">
                      {meetings.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      total meetings recorded
                    </p>
                    {meetingStats.myActionsCount > 0 && (
                      <div className="flex items-center gap-2 mt-4">
                        <Badge variant={meetingStats.overdueActionsCount > 0 ? "destructive" : "secondary"} className="gap-1">
                          <CheckSquare className="h-3 w-3" />
                          {meetingStats.myActionsCount} open action{meetingStats.myActionsCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Link href="/meetings">
                        <Button size="sm" data-testid="button-new-meeting">
                          <Plus className="h-4 w-4 mr-1" />
                          New
                        </Button>
                      </Link>
                      <Link href="/meetings">
                        <Button size="sm" variant="outline" data-testid="button-view-meetings">
                          View All
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Leave Widget */}
          {hasLeave && (
            <Card className="hover-elevate" data-testid="card-leave-widget">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {canApproveLeave ? "Leave Requests" : "My Leave"}
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {leaveLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : (
                  <>
                    {canApproveLeave ? (
                      <>
                        <div className="text-2xl font-bold" data-testid="text-pending-leave-count">
                          {leaveStats.pendingCount}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          pending approval{leaveStats.pendingCount !== 1 ? "s" : ""}
                        </p>
                        {leaveStats.pendingCount > 0 && (
                          <div className="flex items-center gap-2 mt-4">
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Needs attention
                            </Badge>
                          </div>
                        )}
                        <div className="flex gap-2 mt-4">
                          <Link href="/approve-leave">
                            <Button size="sm" data-testid="button-approve-leave">
                              Review
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold" data-testid="text-my-leave-count">
                          {leaveStats.myPendingCount}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          pending request{leaveStats.myPendingCount !== 1 ? "s" : ""}
                        </p>
                        {leaveStats.upcomingLeave > 0 && (
                          <div className="flex items-center gap-2 mt-4">
                            <Badge variant="secondary" className="gap-1">
                              <Calendar className="h-3 w-3" />
                              {leaveStats.upcomingLeave} upcoming
                            </Badge>
                          </div>
                        )}
                        <div className="flex gap-2 mt-4">
                          <Link href="/leave-requests">
                            <Button size="sm" data-testid="button-request-leave">
                              <Plus className="h-4 w-4 mr-1" />
                              Request
                            </Button>
                          </Link>
                          <Link href="/leave-requests">
                            <Button size="sm" variant="outline" data-testid="button-view-leave">
                              View All
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Behaviour Widget */}
          {hasBehaviour && (
            <Card className="hover-elevate" data-testid="card-behaviour-widget">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Behaviour</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {canManageBehaviour ? (
                  oncallsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ) : (
                    <>
                      <div className="text-2xl font-bold" data-testid="text-open-oncalls-count">
                        {behaviourStats.openOncallsCount}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        open on-call{behaviourStats.openOncallsCount !== 1 ? "s" : ""}
                      </p>
                      {behaviourStats.todayOncallsCount > 0 && (
                        <div className="flex items-center gap-2 mt-4">
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {behaviourStats.todayOncallsCount} today
                          </Badge>
                        </div>
                      )}
                      <div className="flex gap-2 mt-4">
                        <Link href="/on-call">
                          <Button size="sm" data-testid="button-raise-oncall">
                            <Plus className="h-4 w-4 mr-1" />
                            Raise On-Call
                          </Button>
                        </Link>
                        <Link href="/behaviour-management">
                          <Button size="sm" variant="outline" data-testid="button-manage-behaviour">
                            Manage
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-behaviour-placeholder">
                      On-Call
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Report behaviour incidents
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Link href="/on-call">
                        <Button size="sm" data-testid="button-raise-oncall">
                          <Plus className="h-4 w-4 mr-1" />
                          Raise On-Call
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* My Actions Section - Only show if there are open actions */}
      {hasMeetings && myActions.filter((a: any) => a.status === "open").length > 0 && (
        <Card data-testid="card-my-actions">
          <CardHeader>
            <CardTitle className="text-lg">My Action Items</CardTitle>
            <CardDescription>Tasks assigned to you from meetings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myActions
                .filter((a: any) => a.status === "open")
                .slice(0, 5)
                .map((action: any) => {
                  const isOverdue = action.dueDate && new Date(action.dueDate) < new Date();
                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      data-testid={`action-item-${action.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <CheckSquare className={`h-4 w-4 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                        <span className="text-sm">{action.description}</span>
                      </div>
                      {action.dueDate && (
                        <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs">
                          {isOverdue ? "Overdue" : `Due ${new Date(action.dueDate).toLocaleDateString()}`}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              {myActions.filter((a: any) => a.status === "open").length > 5 && (
                <Link href="/meetings">
                  <Button variant="ghost" size="sm" className="w-full" data-testid="button-view-all-actions">
                    View all {myActions.filter((a: any) => a.status === "open").length} actions
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
