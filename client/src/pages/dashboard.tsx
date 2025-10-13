import { StatCard } from "@/components/stat-card";
import { ObservationCard } from "@/components/observation-card";
import { AnalyticsChart } from "@/components/analytics-chart";
import { CategoryPerformance } from "@/components/category-performance";
import { TeachingGroupsSection } from "@/components/teaching-groups-section";
import { ObservationDetailsPanel } from "@/components/observation-details-panel";
import { FilteredObservationsPanel } from "@/components/filtered-observations-panel";
import { Eye, Users, ClipboardCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { format } from "date-fns";

export default function Dashboard() {
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"day" | "teacher" | "category" | null>(null);
  const [filterValue, setFilterValue] = useState<string | null>(null);
  
  const observationTrend = [
    { label: "Mon", value: 3 },
    { label: "Tue", value: 5 },
    { label: "Wed", value: 4 },
    { label: "Thu", value: 6 },
    { label: "Fri", value: 4 },
  ];

  const topPerformers = [
    { label: "Sarah Mitchell", value: 4.8, maxValue: 5 },
    { label: "Emily Rodriguez", value: 4.6, maxValue: 5 },
    { label: "James Chen", value: 4.3, maxValue: 5 },
    { label: "Lisa Anderson", value: 4.2, maxValue: 5 },
  ];

  const categoryPerformance = [
    { name: "Entrance and Do Now", avgScore: 5.2, maxScore: 7, trend: "up" as const, trendValue: 12 },
    { name: "Direct Instruction", avgScore: 3.1, maxScore: 4, trend: "stable" as const, trendValue: 0 },
    { name: "Checking for Understanding", avgScore: 2.8, maxScore: 4, trend: "down" as const, trendValue: 5 },
    { name: "Application", avgScore: 3.5, maxScore: 4, trend: "up" as const, trendValue: 8 },
    { name: "Exit Routine", avgScore: 4.1, maxScore: 5, trend: "up" as const, trendValue: 15 },
  ];

  const recentObservations = [
    {
      teacherName: "Sarah Mitchell",
      teacherInitials: "SM",
      date: new Date(2025, 9, 8),
      categories: ["Entrance and Do Now", "Direct Instruction", "Pace and Presence"],
      score: 18,
      maxScore: 20,
    },
    {
      teacherName: "James Chen",
      teacherInitials: "JC",
      date: new Date(2025, 9, 5),
      categories: ["Behaviour Routines", "Academic Talk"],
      score: 12,
      maxScore: 15,
    },
    {
      teacherName: "Emily Rodriguez",
      teacherInitials: "ER",
      date: new Date(2025, 9, 3),
      categories: ["Application", "Exit Routine"],
      score: 9,
      maxScore: 10,
    },
  ];

  const teachingGroups = [
    {
      id: "1",
      name: "English Department",
      groupLead: {
        name: "Sarah Mitchell",
        initials: "SM",
      },
      memberCount: 5,
      avgScore: 4.5,
      maxScore: 5,
      totalObservations: 45,
      weeklyObservations: 10,
    },
    {
      id: "2",
      name: "Mathematics",
      groupLead: {
        name: "James Chen",
        initials: "JC",
      },
      memberCount: 4,
      avgScore: 4.1,
      maxScore: 5,
      totalObservations: 31,
      weeklyObservations: 6,
    },
    {
      id: "3",
      name: "Science Team",
      groupLead: {
        name: "Emily Rodriguez",
        initials: "ER",
      },
      memberCount: 6,
      avgScore: 4.3,
      maxScore: 5,
      totalObservations: 51,
      weeklyObservations: 11,
    },
  ];

  const allObservations = [
    {
      id: "obs1",
      teacherId: "t1",
      teacherName: "Sarah Mitchell",
      teacherInitials: "SM",
      observerName: "John Smith",
      date: new Date(2025, 9, 8),
      lessonTopic: "Advanced Grammar: Subjunctive Mood",
      classInfo: "Year 11 English",
      categories: [
        {
          name: "Entrance and Do Now",
          score: 6,
          maxScore: 7,
          habits: [
            { text: "Students enter quietly", observed: true },
            { text: "Do Now is visible on board", observed: true },
            { text: "Students begin work within 2 minutes", observed: true },
            { text: "Teacher circulates during Do Now", observed: false },
          ],
        },
        {
          name: "Direct Instruction",
          score: 3,
          maxScore: 4,
          habits: [
            { text: "Clear learning objectives stated", observed: true },
            { text: "Content is chunked appropriately", observed: true },
            { text: "Examples and non-examples provided", observed: true },
            { text: "Visual aids support instruction", observed: false },
          ],
        },
      ],
      qualitativeFeedback: "Excellent lesson with strong student engagement. Consider adding more visual supports for visual learners.",
      totalScore: 18,
      totalMaxScore: 20,
    },
    {
      id: "obs2",
      teacherId: "t1",
      teacherName: "Sarah Mitchell",
      teacherInitials: "SM",
      observerName: "Jane Doe",
      date: new Date(2025, 9, 3),
      lessonTopic: "Poetry Analysis: Metaphor and Simile",
      classInfo: "Year 10 English",
      categories: [
        {
          name: "Application",
          score: 4,
          maxScore: 4,
          habits: [
            { text: "Students practice independently", observed: true },
            { text: "Application tasks match learning objectives", observed: true },
            { text: "Differentiation is evident", observed: true },
            { text: "Students receive timely feedback", observed: true },
          ],
        },
      ],
      qualitativeFeedback: "Great application of concepts through creative tasks.",
      totalScore: 15,
      totalMaxScore: 17,
    },
    {
      id: "obs3",
      teacherId: "t6",
      teacherName: "James Chen",
      teacherInitials: "JC",
      observerName: "Mary Johnson",
      date: new Date(2025, 9, 5),
      lessonTopic: "Quadratic Equations",
      classInfo: "Year 9 Math",
      categories: [
        {
          name: "Behaviour Routines",
          score: 3,
          maxScore: 4,
          habits: [
            { text: "Clear expectations set", observed: true },
            { text: "Consistent consequences applied", observed: true },
            { text: "Positive reinforcement used", observed: true },
            { text: "Redirections are brief and respectful", observed: false },
          ],
        },
      ],
      qualitativeFeedback: "Solid classroom management with room for more positive reinforcement.",
      totalScore: 12,
      totalMaxScore: 15,
    },
    {
      id: "obs4",
      teacherId: "t10",
      teacherName: "Emily Rodriguez",
      teacherInitials: "ER",
      observerName: "David Lee",
      date: new Date(2025, 9, 3),
      lessonTopic: "Chemical Reactions Lab",
      classInfo: "Year 10 Science",
      categories: [
        {
          name: "Application",
          score: 4,
          maxScore: 4,
          habits: [
            { text: "Lab safety procedures followed", observed: true },
            { text: "Students engage with materials", observed: true },
            { text: "Scientific method applied", observed: true },
            { text: "Data collection is accurate", observed: true },
          ],
        },
        {
          name: "Exit Routine",
          score: 5,
          maxScore: 6,
          habits: [
            { text: "Summary of learning completed", observed: true },
            { text: "Exit ticket administered", observed: true },
            { text: "Homework clearly explained", observed: true },
            { text: "Dismissal is organized", observed: false },
          ],
        },
      ],
      qualitativeFeedback: "Excellent hands-on learning experience with strong student engagement.",
      totalScore: 9,
      totalMaxScore: 10,
    },
  ];

  const selectedObservation = selectedObservationId
    ? allObservations.find(obs => obs.id === selectedObservationId) || null
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
        return allObservations.filter(obs => getDayOfWeek(obs.date) === filterValue);
      case "teacher":
        return allObservations.filter(obs => obs.teacherName === filterValue);
      case "category":
        return allObservations.filter(obs => 
          obs.categories.some(cat => cat.name === filterValue)
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
          value="24"
          icon={Eye}
          description="This month"
          color="warning"
        />
        <StatCard
          title="Active Teachers"
          value="18"
          icon={Users}
          description="In your school"
          color="primary"
        />
        <StatCard
          title="Avg. Score"
          value="4.2"
          icon={ClipboardCheck}
          description="Out of 5"
          color="amber"
          variant="dark"
        />
        <StatCard
          title="Improvement"
          value="+12%"
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Observations</h2>
              <Link href="/history">
                <Button variant="ghost" size="sm" data-testid="button-view-all">
                  View All
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentObservations.map((obs, idx) => (
                <ObservationCard
                  key={idx}
                  {...obs}
                  onView={() => {
                    const fullObs = allObservations.find(o => 
                      o.teacherName === obs.teacherName && 
                      o.date.getTime() === obs.date.getTime()
                    );
                    if (fullObs) {
                      setSelectedObservationId(fullObs.id);
                    }
                  }}
                />
              ))}
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
        observations={filteredObservations.map(obs => ({
          id: obs.id,
          teacherName: obs.teacherName,
          teacherInitials: obs.teacherInitials,
          date: obs.date,
          categories: obs.categories.map(cat => cat.name),
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
