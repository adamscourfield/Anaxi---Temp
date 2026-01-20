import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import type { SchoolMembership } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Eye,
  TrendingUp,
  Calendar,
  MessageSquare,
  AlertCircle,
  CheckSquare,
  ArrowRight,
  Plus,
  Clock,
  FileText,
  BarChart3,
  Cake,
  User,
  Users,
  GraduationCap,
} from "lucide-react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardStats {
  totalObservations: number;
  activeTeachers: number;
  avgScore: number;
  improvement: number;
}

interface AnalyticsData {
  byCategory: Record<string, { total: number; average: number }>;
  byTeacher: Record<string, { name: string; count: number; avgScore: number }>;
  byObserver: Record<string, { name: string; count: number }>;
  recentTrend: { month: string; count: number; avgScore: number }[];
}

interface ObservationTrendData {
  summary: {
    totalObservations: number;
    uniqueTeachers: number;
    averageScore: number;
    scoreChange: number;
  };
  observationTrend: Array<{ label: string; value: number; quality: number; sortKey: number }>;
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

interface StaffBirthday {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  dateOfBirth: string;
  upcomingBirthday: string;
  daysUntil: number;
}

interface StudentBirthday {
  studentId: string;
  name: string;
  dateOfBirth: string;
  upcomingBirthday: string;
  daysUntil: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { currentSchoolId, currentSchool } = useSchool();

  const enabledFeatures = currentSchool?.enabled_features || [];
  const hasObservations = enabledFeatures.includes("observations");
  const hasMeetings = enabledFeatures.includes("meetings");
  const hasLeave = enabledFeatures.includes("absence_management");
  const hasBehaviour = enabledFeatures.includes("behaviour");

  const { data: userMemberships = [] } = useQuery<Array<SchoolMembership & { school?: any }>>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user,
  });

  const currentMembership = userMemberships.find(m => m.schoolId === currentSchoolId);
  const canApproveLeave = currentMembership?.canApproveLeaveRequests || false;
  const canManageBehaviour = currentMembership?.canManageBehaviour || false;
  const userRole = currentMembership?.role || "Teacher";
  const isLeaderOrAbove = userRole === "Leader" || userRole === "Admin" || user?.global_role === "Creator";

  const { data: observationStats, isLoading: observationStatsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", currentSchoolId],
    enabled: !!currentSchoolId && hasObservations,
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const { data: observationAnalytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/dashboard/analytics", currentSchoolId],
    enabled: !!currentSchoolId && hasObservations && isLeaderOrAbove,
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/analytics?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  const { data: recentObservations = [], isLoading: recentObsLoading } = useQuery<any[]>({
    queryKey: ["/api/observations", currentSchoolId],
    enabled: !!currentSchoolId && hasObservations,
    queryFn: async () => {
      const response = await fetch(`/api/observations?schoolId=${currentSchoolId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: observationTrendData, isLoading: trendLoading } = useQuery<ObservationTrendData>({
    queryKey: ["/api/observation-analytics", currentSchoolId, "month"],
    enabled: !!currentSchoolId && hasObservations && isLeaderOrAbove,
    queryFn: async () => {
      const response = await fetch(`/api/observation-analytics?schoolId=${currentSchoolId}&timePeriod=month`);
      if (!response.ok) throw new Error("Failed to fetch trend data");
      return response.json();
    },
  });

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

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<any[]>({
    queryKey: ["/api/meetings", currentSchoolId],
    enabled: !!currentSchoolId && hasMeetings,
    queryFn: async () => {
      const response = await fetch(`/api/meetings?schoolId=${currentSchoolId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: myActions = [] } = useQuery<any[]>({
    queryKey: ["/api/my-actions"],
    enabled: hasMeetings,
    queryFn: async () => {
      const response = await fetch("/api/my-actions");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const meetingStats: MeetingStats = {
    upcomingCount: meetings.filter(m => m.scheduledAt && new Date(m.scheduledAt) > new Date()).length,
    overdueActionsCount: myActions.filter((a: any) => a.status === "open" && a.dueDate && new Date(a.dueDate) < new Date()).length,
    myActionsCount: myActions.filter((a: any) => a.status === "open").length,
  };

  const upcomingMeetings = meetings
    .filter(m => m.scheduledAt && new Date(m.scheduledAt) > new Date())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 3);

  const { data: oncalls = [], isLoading: oncallsLoading } = useQuery<any[]>({
    queryKey: [`/api/schools/${currentSchoolId}/oncalls`],
    enabled: !!currentSchoolId && hasBehaviour && canManageBehaviour,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${currentSchoolId}/oncalls`);
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

  const openOncalls = oncalls
    .filter(o => o.status === "open")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const { data: staffBirthdays = [], isLoading: staffBirthdaysLoading } = useQuery<StaffBirthday[]>({
    queryKey: ["/api/schools", currentSchoolId, "birthdays/staff"],
    enabled: !!currentSchoolId && isLeaderOrAbove,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${currentSchoolId}/birthdays/staff?daysAhead=14`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: studentBirthdays = [], isLoading: studentBirthdaysLoading } = useQuery<StudentBirthday[]>({
    queryKey: ["/api/schools", currentSchoolId, "birthdays/students"],
    enabled: !!currentSchoolId && isLeaderOrAbove && hasBehaviour,
    queryFn: async () => {
      const response = await fetch(`/api/schools/${currentSchoolId}/birthdays/students?daysAhead=14`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  const userName = user?.first_name || user?.email?.split("@")[0] || "there";
  const hasAnyFeatures = hasObservations || hasMeetings || hasLeave || hasBehaviour;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getBirthdayLabel = (daysUntil: number) => {
    if (daysUntil === 0) return "Today!";
    if (daysUntil === 1) return "Tomorrow";
    return `In ${daysUntil} days`;
  };

  return (
    <div className="min-h-full p-6 space-y-8">
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

      {!hasAnyFeatures && currentSchool && (
        <Card variant="glass">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No features enabled</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Contact your administrator to enable features like Observations, Meetings, Leave Management, or Behaviour Tracking.
            </p>
          </CardContent>
        </Card>
      )}

      {hasAnyFeatures && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {hasObservations && (
              <Card data-testid="card-observations-widget" variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Observations</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {observationStatsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold" style={{ color: '#4761d6' }} data-testid="text-observations-count">
                        {observationStats?.totalObservations || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">this month</p>
                      {observationStats?.improvement !== undefined && observationStats.improvement !== 0 && (
                        <Badge variant="secondary" className="mt-2 gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {observationStats.improvement > 0 ? "+" : ""}{observationStats.improvement}%
                        </Badge>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {hasMeetings && (
              <Card data-testid="card-meetings-widget" variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Meetings</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {meetingsLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold" style={{ color: '#4761d6' }} data-testid="text-meetings-count">
                        {meetings.length}
                      </div>
                      <p className="text-xs text-muted-foreground">total recorded</p>
                      {meetingStats.myActionsCount > 0 && (
                        <Badge variant={meetingStats.overdueActionsCount > 0 ? "destructive" : "secondary"} className="mt-2 gap-1">
                          <CheckSquare className="h-3 w-3" />
                          {meetingStats.myActionsCount} action{meetingStats.myActionsCount !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {hasLeave && (
              <Card data-testid="card-leave-widget" variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">{canApproveLeave ? "Leave Requests" : "My Leave"}</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {leaveLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : canApproveLeave ? (
                    <>
                      <div className="text-2xl font-bold" style={{ color: '#4761d6' }} data-testid="text-pending-leave-count">
                        {leaveStats.pendingCount}
                      </div>
                      <p className="text-xs text-muted-foreground">pending approval</p>
                      {leaveStats.pendingCount > 0 && (
                        <Badge variant="outline" className="mt-2 gap-1">
                          <Clock className="h-3 w-3" />
                          Needs attention
                        </Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold" style={{ color: '#4761d6' }} data-testid="text-my-leave-count">
                        {leaveStats.myPendingCount}
                      </div>
                      <p className="text-xs text-muted-foreground">pending request{leaveStats.myPendingCount !== 1 ? "s" : ""}</p>
                      {leaveStats.upcomingLeave > 0 && (
                        <Badge variant="secondary" className="mt-2 gap-1">
                          <Calendar className="h-3 w-3" />
                          {leaveStats.upcomingLeave} upcoming
                        </Badge>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {hasBehaviour && (
              <Card data-testid="card-behaviour-widget" variant="glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Behaviour</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {canManageBehaviour ? (
                    oncallsLoading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <>
                        <div className="text-2xl font-bold" style={{ color: '#4761d6' }} data-testid="text-open-oncalls-count">
                          {behaviourStats.openOncallsCount}
                        </div>
                        <p className="text-xs text-muted-foreground">open on-call{behaviourStats.openOncallsCount !== 1 ? "s" : ""}</p>
                        {behaviourStats.todayOncallsCount > 0 && (
                          <Badge variant="outline" className="mt-2 gap-1">
                            <Clock className="h-3 w-3" />
                            {behaviourStats.todayOncallsCount} today
                          </Badge>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      <div className="text-2xl font-bold" style={{ color: '#4761d6' }} data-testid="text-behaviour-placeholder">On-Call</div>
                      <p className="text-xs text-muted-foreground">Report incidents</p>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {hasObservations && (
              <Card data-testid="card-observations-detail" variant="glass">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Observation Trend
                    </CardTitle>
                    <CardDescription>Weekly observation count and quality score</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/analytics">
                      <Button size="sm" variant="outline" data-testid="button-view-analytics">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Analytics
                      </Button>
                    </Link>
                    <Link href="/observe">
                      <Button size="sm" data-testid="button-new-observation">
                        <Plus className="h-4 w-4 mr-1" />
                        New
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  {!isLeaderOrAbove ? (
                    <div className="space-y-4">
                      {recentObsLoading ? (
                        <Skeleton className="h-[200px] w-full" />
                      ) : recentObservations.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No observations yet. Start by creating one!</p>
                      ) : (
                        <div className="space-y-3">
                          {recentObservations.slice(0, 3).map((obs: any) => (
                            <Link key={obs.id} href={`/history?observationId=${obs.id}`} className="block">
                              <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`observation-item-${obs.id}`}>
                                <div className="flex items-center gap-3">
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">{obs.teacherName || "Teacher"}</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(obs.date)}</p>
                                  </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </Link>
                          ))}
                          <Link href="/history">
                            <Button variant="ghost" size="sm" className="w-full" data-testid="button-view-all-observations">
                              View all observations
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : trendLoading ? (
                    <Skeleton className="h-[200px] w-full" />
                  ) : observationTrendData?.observationTrend && observationTrendData.observationTrend.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <ComposedChart data={observationTrendData.observationTrend}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="label" 
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            angle={-45}
                            textAnchor="end"
                            height={50}
                          />
                          <YAxis 
                            yAxisId="left"
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            width={30}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            domain={[0, 100]}
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                            width={30}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                            formatter={(value: number, name: string) => {
                              if (name === "quality") return [`${value.toFixed(0)}%`, "Quality Score"];
                              return [value, "Observations"];
                            }}
                          />
                          <Bar 
                            yAxisId="left"
                            dataKey="value" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                            name="Observations"
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="quality" 
                            stroke="hsl(var(--success))" 
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--success))', strokeWidth: 2 }}
                            name="quality"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <Link href="/history">
                        <Button variant="ghost" size="sm" className="w-full" data-testid="button-view-all-observations">
                          View all observations
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">No observation data available yet.</p>
                      <Link href="/observe">
                        <Button variant="outline" size="sm" className="mt-3">
                          <Plus className="h-4 w-4 mr-1" />
                          Create First Observation
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {hasMeetings && (
              <Card data-testid="card-meetings-detail" variant="glass">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">Meetings & Actions</CardTitle>
                    <CardDescription>Upcoming meetings and your action items</CardDescription>
                  </div>
                  <Link href="/meetings">
                    <Button size="sm" data-testid="button-new-meeting">
                      <Plus className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingMeetings.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Upcoming Meetings</h4>
                        <div className="space-y-4">
                          {upcomingMeetings.map((meeting: any) => (
                            <Link key={meeting.id} href={`/meetings?meetingId=${meeting.id}`} className="block">
                              <div className="flex items-center justify-between p-2 rounded-lg border hover-elevate cursor-pointer" data-testid={`meeting-item-${meeting.id}`}>
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{meeting.subject}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(meeting.scheduledAt)}
                                  </span>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {myActions.filter((a: any) => a.status === "open").length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">My Action Items</h4>
                        <div className="space-y-4">
                          {myActions.filter((a: any) => a.status === "open").slice(0, 3).map((action: any) => {
                            const isOverdue = action.dueDate && new Date(action.dueDate) < new Date();
                            return (
                              <Link key={action.id} href={`/meetings?meetingId=${action.meetingId}`} className="block">
                                <div className="flex items-center justify-between p-2 rounded-lg border hover-elevate cursor-pointer" data-testid={`action-item-${action.id}`}>
                                  <div className="flex items-center gap-2">
                                    <CheckSquare className={`h-4 w-4 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                                    <span className="text-sm truncate max-w-[200px]">{action.description}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {action.dueDate && (
                                      <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs">
                                        {isOverdue ? "Overdue" : formatDate(action.dueDate)}
                                      </Badge>
                                    )}
                                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {upcomingMeetings.length === 0 && myActions.filter((a: any) => a.status === "open").length === 0 && (
                      <p className="text-muted-foreground text-sm">No upcoming meetings or pending actions.</p>
                    )}

                    <Link href="/meetings">
                      <Button variant="ghost" size="sm" className="w-full" data-testid="button-view-all-meetings">
                        View all meetings
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {hasLeave && (
              <Card data-testid="card-leave-detail" variant="glass">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{canApproveLeave ? "Leave Approvals" : "Leave Requests"}</CardTitle>
                    <CardDescription>{canApproveLeave ? "Pending requests requiring your review" : "Your leave request status"}</CardDescription>
                  </div>
                  <Link href={canApproveLeave ? "/approve-leave" : "/leave-requests"}>
                    <Button size="sm" data-testid="button-manage-leave">
                      {canApproveLeave ? "Review" : <><Plus className="h-4 w-4 mr-1" />Request</>}
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {leaveLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <div className="space-y-5">
                      {leaveRequests.filter(lr => canApproveLeave ? lr.status === "pending" : lr.membershipId === currentMembership?.id).slice(0, 3).map((request: any) => (
                        <Link key={request.id} href={canApproveLeave ? `/approve-leave?requestId=${request.id}` : `/leave-requests?requestId=${request.id}`} className="block">
                          <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`leave-item-${request.id}`}>
                            <div className="flex items-center gap-3">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <div>
                                {canApproveLeave && request.requester && (
                                  <p className="text-sm font-medium">{request.requester.firstName} {request.requester.lastName}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(request.startDate)} - {formatDate(request.endDate)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={request.status === "pending" ? "outline" : request.status === "approved_with_pay" || request.status === "approved_without_pay" ? "secondary" : "destructive"}>
                                {request.status === "pending" ? "Pending" : request.status === "approved_with_pay" ? "Approved" : request.status === "approved_without_pay" ? "Approved (unpaid)" : "Denied"}
                              </Badge>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </Link>
                      ))}
                      {leaveRequests.filter(lr => canApproveLeave ? lr.status === "pending" : lr.membershipId === currentMembership?.id).length === 0 && (
                        <p className="text-muted-foreground text-sm">{canApproveLeave ? "No pending requests to review." : "No leave requests yet."}</p>
                      )}
                      <Link href={canApproveLeave ? "/approve-leave" : "/leave-requests"}>
                        <Button variant="ghost" size="sm" className="w-full" data-testid="button-view-all-leave">
                          View all
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {hasBehaviour && (
              <Card data-testid="card-behaviour-detail" variant="glass">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">Behaviour Management</CardTitle>
                    <CardDescription>{canManageBehaviour ? "Open on-call incidents" : "Report behaviour incidents"}</CardDescription>
                  </div>
                  <Link href="/on-call">
                    <Button size="sm" data-testid="button-raise-oncall">
                      <Plus className="h-4 w-4 mr-1" />
                      On-Call
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {canManageBehaviour ? (
                    oncallsLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : openOncalls.length > 0 ? (
                      <div className="space-y-5">
                        {openOncalls.map((oncall: any) => (
                          <Link key={oncall.id} href={`/behaviour-management?oncall_id=${oncall.id}`} className="block">
                            <div className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`oncall-item-${oncall.id}`}>
                              <div className="flex items-center gap-3">
                                <AlertCircle className="h-4 w-4 text-destructive" />
                                <div>
                                  <p className="text-sm font-medium">{oncall.location}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{oncall.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="destructive">Open</Badge>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </Link>
                        ))}
                        <Link href="/behaviour-management">
                          <Button variant="ghost" size="sm" className="w-full" data-testid="button-view-all-oncalls">
                            View all on-calls
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No open on-call incidents.</p>
                    )
                  ) : (
                    <div className="text-center py-4">
                      <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Use the On-Call button to report behaviour incidents that need immediate attention.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {isLeaderOrAbove && (staffBirthdays.length > 0 || studentBirthdays.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {staffBirthdays.length > 0 && (
                <Card data-testid="card-staff-birthdays" variant="glass">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Cake className="h-5 w-5" />
                      Staff Birthdays
                    </CardTitle>
                    <CardDescription>Upcoming in the next 2 weeks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {staffBirthdaysLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : (
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-4">
                          {staffBirthdays.map((staff) => (
                            <div key={staff.userId} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`staff-birthday-${staff.userId}`}>
                              <div className="flex items-center gap-3">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{staff.firstName} {staff.lastName}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(staff.upcomingBirthday)}</p>
                                </div>
                              </div>
                              <Badge variant={staff.daysUntil === 0 ? "default" : staff.daysUntil <= 3 ? "secondary" : "outline"}>
                                {getBirthdayLabel(staff.daysUntil)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}

              {studentBirthdays.length > 0 && hasBehaviour && (
                <Card data-testid="card-student-birthdays" variant="glass">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Student Birthdays
                    </CardTitle>
                    <CardDescription>Upcoming in the next 2 weeks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {studentBirthdaysLoading ? (
                      <Skeleton className="h-20 w-full" />
                    ) : (
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-4">
                          {studentBirthdays.map((student) => (
                            <div key={student.studentId} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`student-birthday-${student.studentId}`}>
                              <div className="flex items-center gap-3">
                                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{student.name}</p>
                                  <p className="text-xs text-muted-foreground">{formatDate(student.upcomingBirthday)}</p>
                                </div>
                              </div>
                              <Badge variant={student.daysUntil === 0 ? "default" : student.daysUntil <= 3 ? "secondary" : "outline"}>
                                {getBirthdayLabel(student.daysUntil)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
