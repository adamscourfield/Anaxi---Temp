import { StatCard } from "@/components/stat-card";
import { ObservationCard } from "@/components/observation-card";
import { AnalyticsChart } from "@/components/analytics-chart";
import { CategoryPerformance } from "@/components/category-performance";
import { TeachingGroupsSection } from "@/components/teaching-groups-section";
import { Eye, Users, ClipboardCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
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
      teachers: [
        {
          id: "t1",
          name: "Sarah Mitchell",
          initials: "SM",
          totalObservations: 12,
          avgScore: 4.5,
          maxScore: 5,
          weeklyObservations: 3,
        },
        {
          id: "t2",
          name: "David Brown",
          initials: "DB",
          totalObservations: 8,
          avgScore: 4.2,
          maxScore: 5,
          weeklyObservations: 2,
        },
        {
          id: "t3",
          name: "Jennifer Lee",
          initials: "JL",
          totalObservations: 10,
          avgScore: 4.7,
          maxScore: 5,
          weeklyObservations: 2,
        },
        {
          id: "t4",
          name: "Michael Taylor",
          initials: "MT",
          totalObservations: 6,
          avgScore: 3.8,
          maxScore: 5,
          weeklyObservations: 1,
        },
        {
          id: "t5",
          name: "Amy Wilson",
          initials: "AW",
          totalObservations: 9,
          avgScore: 4.4,
          maxScore: 5,
          weeklyObservations: 2,
        },
      ],
    },
    {
      id: "2",
      name: "Mathematics",
      groupLead: {
        name: "James Chen",
        initials: "JC",
      },
      teachers: [
        {
          id: "t6",
          name: "James Chen",
          initials: "JC",
          totalObservations: 10,
          avgScore: 4.3,
          maxScore: 5,
          weeklyObservations: 2,
        },
        {
          id: "t7",
          name: "Rachel Green",
          initials: "RG",
          totalObservations: 7,
          avgScore: 4.0,
          maxScore: 5,
          weeklyObservations: 1,
        },
        {
          id: "t8",
          name: "Tom Harris",
          initials: "TH",
          totalObservations: 9,
          avgScore: 4.1,
          maxScore: 5,
          weeklyObservations: 2,
        },
        {
          id: "t9",
          name: "Lisa Martinez",
          initials: "LM",
          totalObservations: 5,
          avgScore: 3.9,
          maxScore: 5,
          weeklyObservations: 1,
        },
      ],
    },
    {
      id: "3",
      name: "Science Team",
      groupLead: {
        name: "Emily Rodriguez",
        initials: "ER",
      },
      teachers: [
        {
          id: "t10",
          name: "Emily Rodriguez",
          initials: "ER",
          totalObservations: 11,
          avgScore: 4.6,
          maxScore: 5,
          weeklyObservations: 3,
        },
        {
          id: "t11",
          name: "Brian Johnson",
          initials: "BJ",
          totalObservations: 8,
          avgScore: 4.2,
          maxScore: 5,
          weeklyObservations: 2,
        },
        {
          id: "t12",
          name: "Nina Patel",
          initials: "NP",
          totalObservations: 10,
          avgScore: 4.5,
          maxScore: 5,
          weeklyObservations: 2,
        },
        {
          id: "t13",
          name: "Chris Anderson",
          initials: "CA",
          totalObservations: 7,
          avgScore: 4.0,
          maxScore: 5,
          weeklyObservations: 1,
        },
        {
          id: "t14",
          name: "Sophie Clark",
          initials: "SC",
          totalObservations: 9,
          avgScore: 4.3,
          maxScore: 5,
          weeklyObservations: 2,
        },
        {
          id: "t15",
          name: "Mark Thompson",
          initials: "MT",
          totalObservations: 6,
          avgScore: 3.8,
          maxScore: 5,
          weeklyObservations: 1,
        },
      ],
    },
  ];

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
          color="info"
        />
        <StatCard
          title="Active Teachers"
          value="18"
          icon={Users}
          description="In your school"
          color="pink"
        />
        <StatCard
          title="Avg. Score"
          value="4.2"
          icon={ClipboardCheck}
          description="Out of 5"
          color="success"
        />
        <StatCard
          title="Improvement"
          value="+12%"
          icon={TrendingUp}
          description="vs. last month"
          color="teal"
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
                  onView={() => console.log("View observation")}
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
            />
            <AnalyticsChart
              title="Top Performers"
              data={topPerformers}
              type="progress"
            />
          </div>
          <CategoryPerformance categories={categoryPerformance} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
