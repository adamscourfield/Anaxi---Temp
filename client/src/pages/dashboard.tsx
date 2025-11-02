import { StatCard } from "@/components/stat-card";
import { ObservationCard } from "@/components/observation-card";
import { AnalyticsChart } from "@/components/analytics-chart";
import { CategoryPerformance } from "@/components/category-performance";
import { TeachingGroupsSection } from "@/components/teaching-groups-section";
import { ObservationDetailsPanel } from "@/components/observation-details-panel";
import { FilteredObservationsPanel } from "@/components/filtered-observations-panel";
import { Eye, Users, ClipboardCheck, TrendingUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/use-school";

interface DashboardStats {
  totalObservations: number;
  activeTeachers: number;
  avgScore: number;
  improvement: number;
}

export default function Dashboard() {
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"day" | "teacher" | "category" | null>(null);
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { currentSchoolId } = useSchool();

  // Fetch dashboard stats from API
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Fetch recent observations from API
  const { data: observations = [], isLoading: observationsLoading } = useQuery({
    queryKey: ["/api/observations", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/observations?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch observations");
      return response.json();
    },
  });

  // Filter observations based on search query
  const searchFilteredObservations = observations.filter((obs: any) => {
    if (!searchQuery) return true;
    const teacherName = obs.teacher?.name?.toLowerCase() || "";
    return teacherName.includes(searchQuery.toLowerCase());
  });

  // Get 3 most recent observations for the overview (from search filtered results)
  const recentObservations = searchFilteredObservations
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);
  
  // Fetch analytics data from API
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/dashboard/analytics", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/analytics?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  const observationTrend = analytics?.observationTrend || [];
  const topPerformers = analytics?.topPerformers || [];
  const categoryPerformance = analytics?.categoryPerformance || [];
  const teachingGroups = [];

  // Get selected observation details
  const selectedObservation = selectedObservationId
    ? observations.find((obs: any) => obs.id === selectedObservationId) || null
    : null;

  // Convert day name to a filter function
  const getDayOfWeek = (date: Date): string => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days[date.getDay()];
  };

  // Filter observations based on current filter
  const getFilteredObservations = () => {
    if (!filterType || !filterValue) return [];

    switch (filterType) {
      case "day":
        return observations.filter((obs: any) => getDayOfWeek(new Date(obs.date)) === filterValue);
      case "teacher":
        return observations.filter((obs: any) => obs.teacher?.name === filterValue);
      case "category":
        return observations.filter((obs: any) => 
          obs.categories?.some((cat: any) => cat.categoryName === filterValue)
        );
      default:
        return [];
    }
  };

  const filteredObservations = getFilteredObservations();

  // Click handlers for different analytics sections
  const handleDayClick = (day: string) => {
    setFilterType("day");
    setFilterValue(day);
  };

  const handleTeacherClick = (teacherName: string) => {
    setFilterType("teacher");
    setFilterValue(teacherName);
  };

  const handleCategoryClick = (categoryName: string) => {
    setFilterType("category");
    setFilterValue(categoryName);
  };

  const closeFilteredPanel = () => {
    setFilterType(null);
    setFilterValue(null);
  };

  const handleObservationClick = (obsId: string) => {
    setSelectedObservationId(obsId);
    closeFilteredPanel();
  };

  // Generate panel title based on filter type
  const getFilterPanelTitle = () => {
    if (!filterType || !filterValue) return "";
    
    switch (filterType) {
      case "day":
        return `Observations on ${filterValue}`;
      case "teacher":
        return `${filterValue}'s Observations`;
      case "category":
        return `${filterValue} Observations`;
      default:
        return "Filtered Observations";
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of observation activity and insights
          </p>
        </div>
        <Link href="/observe">
          <Button data-testid="button-new-observation">
            <Eye className="h-4 w-4 mr-2" />
            New Observation
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Observations"
          value={statsLoading ? "..." : stats?.totalObservations?.toString() || "0"}
          icon={Eye}
          description="This month"
          color="warning"
        />
        <StatCard
          title="Active Teachers"
          value={statsLoading ? "..." : stats?.activeTeachers?.toString() || "0"}
          icon={Users}
          description="In your school"
          color="primary"
        />
        <StatCard
          title="Avg. Score"
          value={statsLoading ? "..." : stats?.avgScore?.toString() || "0"}
          icon={ClipboardCheck}
          description="Out of 5"
          color="amber"
          variant="dark"
        />
        <StatCard
          title="Improvement"
          value={statsLoading ? "..." : (() => {
            const improvement = stats?.improvement ?? 0;
            const sign = improvement > 0 ? '+' : '';
            return `${sign}${improvement}%`;
          })()}
          icon={TrendingUp}
          description="vs. last month"
          color="warning"
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4 gap-4">
              <h2 className="text-xl font-semibold">Recent Observations</h2>
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by teacher name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-dashboard-observations"
                  />
                </div>
                <Link href="/history">
                  <Button variant="ghost" size="sm" data-testid="button-view-all">
                    View All
                  </Button>
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {observationsLoading ? (
                <div className="col-span-3 text-center text-muted-foreground py-12">
                  Loading observations...
                </div>
              ) : recentObservations.length === 0 ? (
                <div className="col-span-3 text-center text-muted-foreground py-12">
                  No observations yet. Create your first observation to get started.
                </div>
              ) : (
                recentObservations.map((obs: any) => (
                  <ObservationCard
                    key={obs.id}
                    teacherName={obs.teacher?.name || "Unknown Teacher"}
                    teacherInitials={obs.teacher?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || "??"}
                    date={new Date(obs.date)}
                    categories={obs.categories?.map((c: any) => c.categoryName) || []}
                    score={obs.totalScore}
                    maxScore={obs.totalMaxScore}
                    onView={() => setSelectedObservationId(obs.id)}
                  />
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <TeachingGroupsSection groups={teachingGroups} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsChart
              title="Observation Activity"
              data={observationTrend}
              showFilter
              onDataPointClick={handleDayClick}
            />
            <AnalyticsChart
              title="Top Performers"
              data={topPerformers}
              type="progress"
              onDataPointClick={handleTeacherClick}
            />
          </div>
          <CategoryPerformance 
            categories={categoryPerformance} 
            onCategoryClick={handleCategoryClick}
          />
        </TabsContent>
      </Tabs>

      <FilteredObservationsPanel
        isOpen={filterType !== null && filterValue !== null}
        onClose={closeFilteredPanel}
        title={getFilterPanelTitle()}
        observations={filteredObservations.map((obs: any) => ({
          id: obs.id,
          teacherName: obs.teacher?.name || "Unknown Teacher",
          teacherInitials: obs.teacher?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || "??",
          date: new Date(obs.date),
          categories: obs.categories?.map((cat: any) => cat.categoryName) || [],
          score: obs.totalScore,
          maxScore: obs.totalMaxScore,
        }))}
        onObservationClick={handleObservationClick}
      />

      <ObservationDetailsPanel
        isOpen={selectedObservationId !== null}
        onClose={() => setSelectedObservationId(null)}
        observation={selectedObservation}
      />
    </div>
  );
}
