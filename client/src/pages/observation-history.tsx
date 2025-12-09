import { useState, useEffect } from "react";
import { FeedbackReport } from "@/components/feedback-report";
import { ObservationTable } from "@/components/observation-table";
import { AnalyticsChart } from "@/components/analytics-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, ArrowLeft, Download, BarChart3, ChevronDown, TrendingUp, Users, Eye } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import { useQuery } from "@tanstack/react-query";
import type { Observation, User } from "@shared/schema";

interface ObservationWithTeacher extends Observation {
  teacher?: User;
}

export default function ObservationHistory() {
  const { toast } = useToast();
  const { user, isCreator } = useAuth();
  const { currentSchoolId, hasNoSchools } = useSchool();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedObservation, setSelectedObservation] = useState<string | null>(null);
  const [location] = useLocation();

  // Check for observationId in URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const observationId = params.get('observationId');
    if (observationId) {
      setSelectedObservation(observationId);
    }
  }, [location]);

  // Fetch observations for current school
  const { data: observations = [], isLoading: observationsLoading } = useQuery<Observation[]>({
    queryKey: ["/api/observations", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/observations?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch observations");
      return response.json();
    },
  });

  // Fetch users (teachers) for display names
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/users?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Fetch selected observation details
  const { data: observationDetails, isLoading: observationDetailsLoading } = useQuery({
    queryKey: ["/api/observations", selectedObservation],
    enabled: !!selectedObservation,
    queryFn: async () => {
      const response = await fetch(`/api/observations/${selectedObservation}`);
      if (!response.ok) throw new Error("Failed to fetch observation details");
      return response.json();
    },
  });

  // Get current user's membership to check role for export permissions
  const { data: memberships = [] } = useQuery<any[]>({
    queryKey: ["/api/memberships", user?.id],
    enabled: !!user && !isCreator,
    queryFn: async () => {
      const response = await fetch(`/api/memberships?userId=${user?.id}`);
      if (!response.ok) throw new Error("Failed to fetch memberships");
      return response.json();
    },
  });

  const currentMembership = memberships.find(m => m.schoolId === currentSchoolId);
  const canExport = isCreator || currentMembership?.role === "Leader" || currentMembership?.role === "Admin";
  // For analytics, Creators always have access (they don't need memberships to be fetched)
  const isLeaderOrAbove = isCreator || currentMembership?.role === "Leader" || currentMembership?.role === "Admin";

  // Analytics state and data (for Leaders/Admins/Creators only)
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [categoryTimePeriod, setCategoryTimePeriod] = useState<"week" | "month" | "year" | "all">("month");
  const [performersTimePeriod, setPerformersTimePeriod] = useState<"week" | "month" | "year" | "all">("all");

  interface AnalyticsData {
    categoryAverages: Array<{ name: string; score: number; maxScore: number }>;
    topPerformers: Array<{ name: string; avgScore: number }>;
    lowestPerformers: Array<{ name: string; avgScore: number }>;
    observationTrend: Array<{ date: string; count: number }>;
    totalObservations: number;
    totalTeachersObserved: number;
    avgOverallScore: number;
  }

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/dashboard/analytics", currentSchoolId, categoryTimePeriod, performersTimePeriod],
    enabled: !!currentSchoolId && isLeaderOrAbove && analyticsOpen,
    queryFn: async () => {
      const response = await fetch(
        `/api/dashboard/analytics?schoolId=${currentSchoolId}&categoryTimePeriod=${categoryTimePeriod}&topPerformersTimePeriod=${performersTimePeriod}&lowestPerformersTimePeriod=${performersTimePeriod}&includeLowest=true`
      );
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  // Map observations with teacher and observer names
  const observationsWithNames = observations.map((obs: any) => {
    const teacher = users.find(u => u.id === obs.teacherId);
    const observer = users.find(u => u.id === obs.observerId);
    
    const teacherName = teacher 
      ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email
      : "Unknown";
    const teacherInitials = teacher && teacher.first_name && teacher.last_name
      ? `${teacher.first_name[0]}${teacher.last_name[0]}`
      : teacher?.email?.[0]?.toUpperCase() || "??";
    const observerName = observer
      ? `${observer.first_name || ''} ${observer.last_name || ''}`.trim() || observer.email
      : "Unknown";
    
    // Normalize categories to match ObservationTable format
    const categories = obs.categories?.map((cat: any) => ({
      name: cat.categoryName || cat.name,
    })) || [];
    
    return {
      ...obs,
      teacherName,
      teacherInitials,
      observerName,
      categories,
      classInfo: obs.classInfo || undefined,
    };
  });

  // Filter observations based on search query
  const filteredObservations = observationsWithNames.filter(obs => {
    if (!searchQuery) return true;
    const teacherName = obs.teacherName?.toLowerCase() || "";
    const observerName = obs.observerName?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return teacherName.includes(query) || observerName.includes(query);
  });

  const exportToCSV = () => {
    const headers = ["Date", "Teacher", "Observer", "Class", "Score", "Max Score", "Percentage"];
    const rows = filteredObservations.map((obs) => {
      const percentage = obs.totalMaxScore > 0 ? Math.round((obs.totalScore / obs.totalMaxScore) * 100) : 0;
      return [
        format(new Date(obs.date), "yyyy-MM-dd"),
        obs.teacherName,
        obs.observerName,
        obs.classInfo || "",
        obs.totalScore.toString(),
        obs.totalMaxScore.toString(),
        `${percentage}%`,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `observations_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: `Exported ${filteredObservations.length} observations to CSV`,
    });
  };

  if (selectedObservation) {
    if (observationDetailsLoading || !observationDetails) {
      return (
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedObservation(null)}
              data-testid="button-back-to-list"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Observation Details
              </h1>
              <p className="text-muted-foreground mt-1">
                Feedback report and performance summary
              </p>
            </div>
          </div>
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        </div>
      );
    }

    // Map observation details to FeedbackReport format
    const teacher = users.find(u => u.id === observationDetails.teacherId);
    const observer = users.find(u => u.id === observationDetails.observerId);
    
    const teacherName = teacher 
      ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email
      : "Unknown";
    const teacherInitials = teacher && teacher.first_name && teacher.last_name
      ? `${teacher.first_name[0]}${teacher.last_name[0]}`
      : teacher?.email?.[0]?.toUpperCase() || "??";
    const observerName = observer 
      ? `${observer.first_name || ''} ${observer.last_name || ''}`.trim() || observer.email
      : "Unknown";

    const feedbackData = {
      teacherName,
      teacherInitials,
      observerName,
      date: new Date(observationDetails.date),
      lessonTopic: observationDetails.lessonTopic,
      classInfo: observationDetails.classInfo,
      categories: observationDetails.categories || [],
      qualitativeFeedback: observationDetails.qualitativeFeedback,
      totalScore: observationDetails.totalScore,
      totalMaxScore: observationDetails.totalMaxScore,
    };

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedObservation(null)}
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Observation Details
            </h1>
            <p className="text-muted-foreground mt-1">
              Feedback report and performance summary
            </p>
          </div>
        </div>
        <FeedbackReport {...feedbackData} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Observation History
          </h1>
          <p className="text-muted-foreground mt-1">
            View all completed observations
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={observations.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Link href="/observe">
            <Button data-testid="button-new-observation-history">
              New Observation
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by teacher name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-observations"
        />
      </div>

      {/* Analytics Section - Leaders/Admins/Creators only */}
      {isLeaderOrAbove && (
        <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between"
              data-testid="button-toggle-analytics"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>Analytics & Insights</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${analyticsOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            {analyticsLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading analytics...</div>
            ) : analyticsData ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card data-testid="card-total-observations">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                      <CardTitle className="text-sm font-medium">Total Observations</CardTitle>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-obs">{analyticsData.totalObservations}</div>
                      <p className="text-xs text-muted-foreground">completed this period</p>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-teachers-observed">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                      <CardTitle className="text-sm font-medium">Teachers Observed</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-teachers-count">{analyticsData.totalTeachersObserved}</div>
                      <p className="text-xs text-muted-foreground">unique teachers</p>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-avg-score">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                      <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-avg-score">
                        {analyticsData.avgOverallScore ? analyticsData.avgOverallScore.toFixed(1) : "N/A"}
                      </div>
                      <p className="text-xs text-muted-foreground">out of 5.0</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Analytics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {analyticsData.categoryAverages && analyticsData.categoryAverages.length > 0 && (
                    <AnalyticsChart
                      title="Performance by Category"
                      data={analyticsData.categoryAverages
                        .filter(cat => cat.name && cat.score != null)
                        .map(cat => ({
                          label: cat.name,
                          value: cat.score || 0,
                          maxValue: cat.maxScore || 1,
                        }))}
                      type="progress"
                      showFilter
                      timePeriod={categoryTimePeriod}
                      onTimePeriodChange={setCategoryTimePeriod}
                    />
                  )}
                  {analyticsData.topPerformers && analyticsData.topPerformers.length > 0 && (
                    <AnalyticsChart
                      title="Top Performing Teachers"
                      data={analyticsData.topPerformers
                        .filter(p => p.name && p.avgScore != null)
                        .map(p => ({
                          label: p.name,
                          value: parseFloat((p.avgScore || 0).toFixed(2)),
                          maxValue: 5,
                        }))}
                      type="progress"
                      showFilter
                      timePeriod={performersTimePeriod}
                      onTimePeriodChange={setPerformersTimePeriod}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No analytics data available yet. Complete some observations first.
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {observationsLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading observations...</div>
      ) : hasNoSchools ? (
        <div className="text-center text-muted-foreground py-12">No school assigned</div>
      ) : filteredObservations.length === 0 ? (
        <Card className="p-8">
          <div className="text-center space-y-3">
            <p className="text-lg font-medium">No observations to display</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {searchQuery ? (
                <>
                  No observations found matching "{searchQuery}". Try a different search term.
                </>
              ) : !isCreator && currentMembership?.role !== "Admin" && currentMembership?.role !== "Leader" ? (
                <>
                  You don't have permission to view any observations yet. Administrators can grant you access to view specific teachers' observations for mentoring, department oversight, or peer observation groups.
                </>
              ) : (
                <>
                  No observations have been recorded yet. Start by creating your first observation.
                </>
              )}
            </p>
          </div>
        </Card>
      ) : (
        <ObservationTable
          observations={filteredObservations}
          onViewDetails={(id) => setSelectedObservation(id)}
        />
      )}
    </div>
  );
}
