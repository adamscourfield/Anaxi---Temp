import { StatCard } from "@/components/stat-card";
import { ObservationTable } from "@/components/observation-table";
import { AnalyticsChart } from "@/components/analytics-chart";
import { CategoryPerformance } from "@/components/category-performance";
import { TeachingGroupsSection } from "@/components/teaching-groups-section";
import { ObservationDetailsPanel } from "@/components/observation-details-panel";
import { FilteredObservationsPanel } from "@/components/filtered-observations-panel";
import { LowestPerformers } from "@/components/lowest-performers";
import { QualityQuantityChart } from "@/components/quality-quantity-chart";
import { QualitativeFeedbackSummary } from "@/components/qualitative-feedback-summary";
import { StaffFilter } from "@/components/staff-filter";
import { Eye, Users, ClipboardCheck, TrendingUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useSchool } from "@/hooks/use-school";
import type { User } from "@shared/schema";

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
  const [categoryTimePeriod, setCategoryTimePeriod] = useState<"week" | "month" | "year">("month");
  const [performersTimePeriod, setPerformersTimePeriod] = useState<"week" | "month" | "year" | "all">("all");
  const [trendTimePeriod, setTrendTimePeriod] = useState<"week" | "month" | "year">("week");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const { currentSchoolId } = useSchool();
  const [, setLocation] = useLocation();

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

  // Fetch users for the current school (for teacher and observer names)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/users?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch users");
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

  // Map observations with teacher and observer data
  const observationsWithNames = observations.map((obs: any) => {
    const teacher = users.find((u: User) => u.id === obs.teacherId);
    const observer = users.find((u: User) => u.id === obs.observerId);
    
    const teacherName = teacher 
      ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email
      : "Unknown";
    const teacherInitials = teacher && teacher.first_name && teacher.last_name
      ? `${teacher.first_name[0]}${teacher.last_name[0]}`.toUpperCase()
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
    };
  });

  // Filter observations based on search query
  const searchFilteredObservations = observationsWithNames.filter((obs: any) => {
    if (!searchQuery) return true;
    const teacherName = obs.teacherName?.toLowerCase() || "";
    const observerName = obs.observerName?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();
    return teacherName.includes(query) || observerName.includes(query);
  });

  // Get 5 most recent observations for the overview (from search filtered results)
  const recentObservations = searchFilteredObservations
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  
  // Fetch analytics data from API
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: [
      "/api/dashboard/analytics", 
      currentSchoolId, 
      categoryTimePeriod, 
      performersTimePeriod, 
      trendTimePeriod,
      selectedStaffIds
    ],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const params = new URLSearchParams({
        schoolId: currentSchoolId!,
        categoryTimePeriod,
        performersTimePeriod,
        trendTimePeriod,
        includeLowest: "true",
      });
      
      selectedStaffIds.forEach(id => params.append("staffIds", id));
      
      const response = await fetch(`/api/dashboard/analytics?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  const observationTrend = analytics?.observationTrend || [];
  const topPerformers = analytics?.topPerformers || [];
  const lowestPerformers = analytics?.lowestPerformers || [];
  const categoryPerformance = analytics?.categoryPerformance || [];
  const qualitativeFeedback = analytics?.qualitativeFeedback || [];
  const teachingGroups: any[] = [];

  // Get selected observation details
  const selectedObservation = selectedObservationId
    ? observationsWithNames.find((obs: any) => obs.id === selectedObservationId) || null
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
        return observationsWithNames.filter((obs: any) => getDayOfWeek(new Date(obs.date)) === filterValue);
      case "teacher":
        return observationsWithNames.filter((obs: any) => obs.teacherName === filterValue);
      case "category":
        return observationsWithNames.filter((obs: any) => 
          obs.categories?.some((cat: any) => cat.name === filterValue)
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
            {observationsLoading ? (
              <div className="text-center text-muted-foreground py-12">
                Loading observations...
              </div>
            ) : recentObservations.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                No observations yet. Create your first observation to get started.
              </div>
            ) : (
              <ObservationTable
                observations={recentObservations}
                onViewDetails={(id) => setLocation(`/history?observationId=${id}`)}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <TeachingGroupsSection groups={teachingGroups} />
          
          {/* Quality & Quantity Trend */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Observation Trends</h2>
              <StaffFilter 
                users={users}
                selectedIds={selectedStaffIds}
                onSelectionChange={setSelectedStaffIds}
              />
            </div>
            <QualityQuantityChart
              data={observationTrend}
              timePeriod={trendTimePeriod}
              onTimePeriodChange={setTrendTimePeriod}
            />
          </div>

          {/* Top and Lowest Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnalyticsChart
              title="Top Performers"
              data={topPerformers}
              type="progress"
              onDataPointClick={handleTeacherClick}
            />
            <LowestPerformers
              data={lowestPerformers}
              timePeriod={performersTimePeriod}
              onTimePeriodChange={setPerformersTimePeriod}
              onDataPointClick={handleTeacherClick}
            />
          </div>

          {/* Category Performance */}
          <CategoryPerformance 
            categories={categoryPerformance} 
            onCategoryClick={handleCategoryClick}
            timePeriod={categoryTimePeriod}
            onTimePeriodChange={setCategoryTimePeriod}
          />

          {/* Qualitative Feedback */}
          <QualitativeFeedbackSummary data={qualitativeFeedback} />
        </TabsContent>
      </Tabs>

      <FilteredObservationsPanel
        isOpen={filterType !== null && filterValue !== null}
        onClose={closeFilteredPanel}
        title={getFilterPanelTitle()}
        observations={filteredObservations.map((obs: any) => ({
          id: obs.id,
          teacherName: obs.teacherName,
          teacherInitials: obs.teacherInitials,
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
