import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, subMonths, startOfMonth, endOfMonth, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { 
  ArrowLeft, 
  Eye, 
  Users, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  MessageSquare,
  Target,
  Award,
  ChevronRight,
  ChevronDown,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  GitCompare,
  User
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ChartDisplayMode = "both" | "observations" | "quality";

interface DrillDownFilter {
  type: "teacher" | "group" | "habit" | "category" | "week";
  name: string;
  filterKey: string;
}

type TimePeriod = "week" | "month" | "year" | "all";
type AnalyticsTab = "performers" | "groups" | "habits" | "qualitative";

interface AnalyticsData {
  summary: {
    totalObservations: number;
    uniqueTeachers: number;
    averageScore: number;
    scoreChange: number;
  };
  observationTrend: Array<{ label: string; value: number; quality: number; sortKey: number }>;
  topPerformers: Array<{ teacherId: string; label: string; value: number; maxValue: number; count: number }>;
  lowestPerformers: Array<{ teacherId: string; label: string; value: number; maxValue: number; count: number }>;
  categoryPerformance: Array<{ name: string; avgScore: number; maxScore: number }>;
  teachingGroupAnalysis: Array<{ 
    groupId: string; 
    groupName: string; 
    observationCount: number; 
    avgScore: number;
    teacherCount: number;
  }>;
  habitAnalysis: Array<{ 
    habitName: string; 
    categoryName: string;
    observedCount: number; 
    totalCount: number;
    percentage: number;
  }>;
  commonPhrases: Array<{ phrase: string; count: number; sentiment: "positive" | "negative" | "neutral" }>;
  qualitativeFeedback: Array<{ teacherName: string; observerName: string; date: string; feedback: string }>;
}

interface TeacherCategoryChange {
  categoryName: string;
  percentageA: number;
  percentageB: number;
  delta: number;
  direction: "up" | "down" | "same";
}

interface TeacherChange {
  teacherId: string;
  teacherName: string;
  observationCountA: number;
  observationCountB: number;
  averageScoreA: number;
  averageScoreB: number;
  scoreDelta: number;
  direction: "up" | "down" | "same";
  topImprovements: TeacherCategoryChange[];
  topDeclines: TeacherCategoryChange[];
  allCategoryChanges: TeacherCategoryChange[];
}

interface ComparisonData {
  periodA: {
    startDate: string;
    endDate: string;
    totalObservations: number;
    averageScore: number;
    habitPerformance: Array<{ habitName: string; categoryName: string; percentage: number; count: number }>;
    categoryPerformance: Array<{ name: string; avgScore: number; maxScore: number; percentage: number }>;
  };
  periodB: {
    startDate: string;
    endDate: string;
    totalObservations: number;
    averageScore: number;
    habitPerformance: Array<{ habitName: string; categoryName: string; percentage: number; count: number }>;
    categoryPerformance: Array<{ name: string; avgScore: number; maxScore: number; percentage: number }>;
  };
  deltas: {
    observationCount: number;
    averageScore: number;
    habitChanges: Array<{ habitName: string; categoryName: string; percentageChange: number; direction: "up" | "down" | "same" }>;
    categoryChanges: Array<{ name: string; percentageChange: number; direction: "up" | "down" | "same" }>;
    teacherChanges?: TeacherChange[];
  };
}

export default function ObservationAnalytics() {
  const { user, isCreator } = useAuth();
  const { currentSchoolId, currentSchool } = useSchool();
  const [, setLocation] = useLocation();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [chartDisplayMode, setChartDisplayMode] = useState<ChartDisplayMode>("both");
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownFilter, setDrillDownFilter] = useState<DrillDownFilter | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>("performers");
  
  // Comparison mode state
  const [compareMode, setCompareMode] = useState(false);
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  const twoMonthsAgo = subMonths(now, 2);
  const [periodA, setPeriodA] = useState<DateRange>({
    from: startOfMonth(twoMonthsAgo),
    to: endOfMonth(twoMonthsAgo)
  });
  const [periodB, setPeriodB] = useState<DateRange>({
    from: startOfMonth(lastMonth),
    to: endOfMonth(lastMonth)
  });
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());

  const toggleTeacherExpand = (teacherId: string) => {
    setExpandedTeachers(prev => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  };

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
  const isLeaderOrAbove = isCreator || currentMembership?.role === "Leader" || currentMembership?.role === "Admin";

  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/observation-analytics", currentSchoolId, timePeriod],
    enabled: !!currentSchoolId && isLeaderOrAbove,
    queryFn: async () => {
      const response = await fetch(
        `/api/observation-analytics?schoolId=${currentSchoolId}&timePeriod=${timePeriod}`
      );
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  // Fetch all observations for drill-down filtering
  const { data: allObservations = [] } = useQuery<any[]>({
    queryKey: ["/api/observations", currentSchoolId],
    enabled: !!currentSchoolId && isLeaderOrAbove,
    queryFn: async () => {
      const response = await fetch(`/api/observations?schoolId=${currentSchoolId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch users for observation details
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/users?schoolId=${currentSchoolId}`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch comparison data when in compare mode
  const { data: comparisonData, isLoading: comparisonLoading } = useQuery<ComparisonData>({
    queryKey: ["/api/observation-comparison", currentSchoolId, periodA, periodB],
    enabled: !!currentSchoolId && isLeaderOrAbove && compareMode && !!periodA.from && !!periodA.to && !!periodB.from && !!periodB.to,
    queryFn: async () => {
      const params = new URLSearchParams({
        schoolId: currentSchoolId!,
        periodAStart: periodA.from!.toISOString(),
        periodAEnd: periodA.to!.toISOString(),
        periodBStart: periodB.from!.toISOString(),
        periodBEnd: periodB.to!.toISOString(),
      });
      const response = await fetch(`/api/observation-comparison?${params}`);
      if (!response.ok) throw new Error("Failed to fetch comparison data");
      return response.json();
    },
  });

  const pivotItems = useMemo(() => ([
    { value: "performers" as AnalyticsTab, label: "Performers", icon: Award, count: (analyticsData?.topPerformers?.length || 0) + (analyticsData?.lowestPerformers?.length || 0) },
    { value: "groups" as AnalyticsTab, label: "Teaching Groups", icon: Users, count: analyticsData?.teachingGroupAnalysis?.length || 0 },
    { value: "habits" as AnalyticsTab, label: "Habits & Categories", icon: Target, count: analyticsData?.habitAnalysis?.length || 0 },
    { value: "qualitative" as AnalyticsTab, label: "Qualitative", icon: MessageSquare, count: analyticsData?.qualitativeFeedback?.length || 0 },
  ]), [analyticsData]);

  // Get filtered observations for drill-down
  const drillDownObservations = drillDownFilter ? allObservations.filter(obs => {
    if (drillDownFilter.type === "teacher") {
      // Filter by teacherId for reliable matching
      return obs.teacherId === drillDownFilter.filterKey;
    }
    if (drillDownFilter.type === "group") {
      // Filter by group - would need membership data, for now show all
      return true;
    }
    if (drillDownFilter.type === "habit") {
      // Filter by habit name - check if observation has this habit observed
      const habitNames = obs.habitNames || [];
      return habitNames.includes(drillDownFilter.filterKey);
    }
    if (drillDownFilter.type === "category") {
      // Filter by category name
      const categories = obs.categories || [];
      return categories.some((c: any) => c.categoryName === drillDownFilter.filterKey);
    }
    if (drillDownFilter.type === "week") {
      // Filter by week - filterKey contains the week start timestamp
      const weekStart = parseInt(drillDownFilter.filterKey);
      const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000; // 7 days in ms
      const obsDate = new Date(obs.date).getTime();
      return obsDate >= weekStart && obsDate < weekEnd;
    }
    return true;
  }) : [];

  // Helper to get observation display data
  const getObservationDisplay = (obs: any) => {
    const teacher = users.find(u => u.id === obs.teacherId);
    const observer = users.find(u => u.id === obs.observerId);
    return {
      teacherName: teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() || teacher.email : "Unknown",
      observerName: observer ? `${observer.first_name || ''} ${observer.last_name || ''}`.trim() || observer.email : "Unknown",
      date: new Date(obs.date),
      score: obs.totalMaxScore > 0 ? ((obs.totalScore / obs.totalMaxScore) * 100).toFixed(0) : 0,
    };
  };

  const openDrillDown = (type: DrillDownFilter["type"], name: string, filterKey: string) => {
    setDrillDownFilter({ type, name, filterKey });
    setDrillDownOpen(true);
  };

  const viewObservation = (observationId: string) => {
    setDrillDownOpen(false);
    setLocation(`/history?observationId=${observationId}`);
  };

  if (!isLeaderOrAbove) {
    return (
      <div className="p-6">
        <Card className="p-8">
          <div className="text-center space-y-3">
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">
              Analytics are only available to Leaders, Admins, and Creators.
            </p>
            <Link href="/history">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Observations
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/history">
            <Button variant="ghost" size="icon" data-testid="button-back-to-observations">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Observation Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive analysis of teaching observations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch
              id="compare-mode"
              checked={compareMode}
              onCheckedChange={setCompareMode}
              data-testid="switch-compare-mode"
            />
            <Label htmlFor="compare-mode" className="flex items-center gap-1.5 cursor-pointer">
              <GitCompare className="h-4 w-4" />
              Compare Periods
            </Label>
          </div>
          {!compareMode && (
            <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <SelectTrigger className="w-[150px]" data-testid="select-time-period">
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Comparison Date Pickers */}
      {compareMode && (
        <Card className="p-4" data-testid="card-comparison-dates">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">Period A</Badge>
                Baseline Period
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-period-a">
                    <Calendar className="mr-2 h-4 w-4" />
                    {periodA.from ? (
                      periodA.to ? (
                        <>
                          {format(periodA.from, "dd MMM yyyy")} - {format(periodA.to, "dd MMM yyyy")}
                        </>
                      ) : (
                        format(periodA.from, "dd MMM yyyy")
                      )
                    ) : (
                      "Select date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={periodA}
                    onSelect={(range) => range && setPeriodA(range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="hidden lg:flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">Period B</Badge>
                Comparison Period
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-period-b">
                    <Calendar className="mr-2 h-4 w-4" />
                    {periodB.from ? (
                      periodB.to ? (
                        <>
                          {format(periodB.from, "dd MMM yyyy")} - {format(periodB.to, "dd MMM yyyy")}
                        </>
                      ) : (
                        format(periodB.from, "dd MMM yyyy")
                      )
                    ) : (
                      "Select date range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={periodB}
                    onSelect={(range) => range && setPeriodB(range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Card>
      )}

      {/* Comparison Results */}
      {compareMode && (
        comparisonLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading comparison data...</div>
        ) : comparisonData ? (
          <div className="space-y-6">
            {/* Summary Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card data-testid="card-comparison-obs-a">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">A</Badge>
                    Observations
                  </CardTitle>
                  <Eye className="h-4 w-4 accent-icon" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold accent-number">{comparisonData.periodA.totalObservations}</div>
                  <p className="text-xs text-muted-foreground">baseline period</p>
                </CardContent>
              </Card>
              <Card data-testid="card-comparison-obs-b">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">B</Badge>
                    Observations
                  </CardTitle>
                  <Eye className="h-4 w-4 accent-icon" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold accent-number">{comparisonData.periodB.totalObservations}</span>
                    {comparisonData.deltas.observationCount !== 0 && (
                      <Badge variant={comparisonData.deltas.observationCount > 0 ? "default" : "secondary"} className="text-xs">
                        {comparisonData.deltas.observationCount > 0 ? "+" : ""}{comparisonData.deltas.observationCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">comparison period</p>
                </CardContent>
              </Card>
              <Card data-testid="card-comparison-score-a">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">A</Badge>
                    Avg Score
                  </CardTitle>
                  <Target className="h-4 w-4 accent-icon" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold accent-number">{comparisonData.periodA.averageScore.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">out of 5.0</p>
                </CardContent>
              </Card>
              <Card data-testid="card-comparison-score-b">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300">B</Badge>
                    Avg Score
                  </CardTitle>
                  {comparisonData.deltas.averageScore >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold accent-number">{comparisonData.periodB.averageScore.toFixed(2)}</span>
                    {Math.abs(comparisonData.deltas.averageScore) > 0.01 && (
                      <Badge 
                        variant={comparisonData.deltas.averageScore > 0 ? "default" : "destructive"} 
                        className="text-xs"
                      >
                        {comparisonData.deltas.averageScore > 0 ? "+" : ""}{comparisonData.deltas.averageScore.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">out of 5.0</p>
                </CardContent>
              </Card>
            </div>

            {/* Category Comparison */}
            <Card data-testid="card-category-comparison">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Category Performance Comparison
                </CardTitle>
                <CardDescription>
                  How each category performed between the two periods
                </CardDescription>
              </CardHeader>
              <CardContent>
                {comparisonData.deltas.categoryChanges.length > 0 ? (
                  <div className="space-y-4">
                    {comparisonData.deltas.categoryChanges
                      .sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
                      .map((cat, idx) => {
                        const periodACat = comparisonData.periodA.categoryPerformance.find(c => c.name === cat.name);
                        const periodBCat = comparisonData.periodB.categoryPerformance.find(c => c.name === cat.name);
                        return (
                          <div key={idx} className="space-y-2" data-testid={`category-comparison-${idx}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{cat.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                  {(periodACat?.percentage || 0).toFixed(0)}%
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-sm font-medium">
                                  {(periodBCat?.percentage || 0).toFixed(0)}%
                                </span>
                                <Badge 
                                  variant={cat.direction === "up" ? "default" : cat.direction === "down" ? "destructive" : "secondary"}
                                  className="min-w-16 justify-center"
                                >
                                  {cat.direction === "up" && <ArrowUpRight className="h-3 w-3 mr-1" />}
                                  {cat.direction === "down" && <ArrowDownRight className="h-3 w-3 mr-1" />}
                                  {cat.direction === "same" && <Minus className="h-3 w-3 mr-1" />}
                                  {cat.percentageChange > 0 ? "+" : ""}{cat.percentageChange.toFixed(1)}%
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-1 h-2">
                              <div 
                                className="bg-blue-200 dark:bg-blue-800 rounded-l-full" 
                                style={{ width: `${periodACat?.percentage || 0}%` }}
                              />
                              <div 
                                className="bg-green-400 dark:bg-green-600 rounded-r-full" 
                                style={{ width: `${periodBCat?.percentage || 0}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No category data available for comparison.</p>
                )}
              </CardContent>
            </Card>

            {/* Habit Comparison */}
            <Card data-testid="card-habit-comparison">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Habit Performance Comparison
                </CardTitle>
                <CardDescription>
                  Changes in habit observation rates between periods
                </CardDescription>
              </CardHeader>
              <CardContent>
                {comparisonData.deltas.habitChanges.length > 0 ? (
                  <div className="space-y-3">
                    {comparisonData.deltas.habitChanges
                      .sort((a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange))
                      .slice(0, 15)
                      .map((habit, idx) => {
                        const periodAHabit = comparisonData.periodA.habitPerformance.find(h => h.habitName === habit.habitName);
                        const periodBHabit = comparisonData.periodB.habitPerformance.find(h => h.habitName === habit.habitName);
                        return (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                            data-testid={`habit-comparison-${idx}`}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="font-medium block truncate">{habit.habitName}</span>
                              <span className="text-xs text-muted-foreground">{habit.categoryName}</span>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              <div className="text-right text-sm">
                                <span className="text-muted-foreground">{(periodAHabit?.percentage || 0).toFixed(0)}%</span>
                                <span className="text-muted-foreground mx-1">→</span>
                                <span className="font-medium">{(periodBHabit?.percentage || 0).toFixed(0)}%</span>
                              </div>
                              <Badge 
                                variant={habit.direction === "up" ? "default" : habit.direction === "down" ? "destructive" : "secondary"}
                                className="min-w-16 justify-center"
                              >
                                {habit.direction === "up" && <ArrowUpRight className="h-3 w-3 mr-1" />}
                                {habit.direction === "down" && <ArrowDownRight className="h-3 w-3 mr-1" />}
                                {habit.direction === "same" && <Minus className="h-3 w-3 mr-1" />}
                                {habit.percentageChange > 0 ? "+" : ""}{habit.percentageChange.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    {comparisonData.deltas.habitChanges.length > 15 && (
                      <p className="text-sm text-muted-foreground text-center pt-2">
                        Showing top 15 of {comparisonData.deltas.habitChanges.length} habits by change magnitude
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No habit data available for comparison.</p>
                )}
              </CardContent>
            </Card>

            {/* Teacher Performance Comparison */}
            {comparisonData.deltas.teacherChanges && comparisonData.deltas.teacherChanges.length > 0 && (
              <Card className="col-span-full" data-testid="card-teacher-comparison">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Teacher Performance Comparison
                  </CardTitle>
                  <CardDescription>
                    Individual teacher progress between periods, sorted by change magnitude
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {comparisonData.deltas.teacherChanges.slice(0, 20).map((teacher, idx) => (
                      <Collapsible 
                        key={teacher.teacherId}
                        open={expandedTeachers.has(teacher.teacherId)}
                        onOpenChange={() => toggleTeacherExpand(teacher.teacherId)}
                      >
                        <div 
                          className="border rounded-lg overflow-hidden"
                          data-testid={`teacher-comparison-${idx}`}
                        >
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-3 hover-elevate cursor-pointer">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="text-left">
                                  <span className="font-medium block">{teacher.teacherName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {teacher.observationCountA} → {teacher.observationCountB} observations
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right text-sm">
                                  <span className="text-muted-foreground">{teacher.averageScoreA.toFixed(0)}%</span>
                                  <span className="text-muted-foreground mx-1">→</span>
                                  <span className="font-medium">{teacher.averageScoreB.toFixed(0)}%</span>
                                </div>
                                <Badge 
                                  variant={teacher.direction === "up" ? "default" : teacher.direction === "down" ? "destructive" : "secondary"}
                                  className="min-w-16 justify-center"
                                >
                                  {teacher.direction === "up" && <ArrowUpRight className="h-3 w-3 mr-1" />}
                                  {teacher.direction === "down" && <ArrowDownRight className="h-3 w-3 mr-1" />}
                                  {teacher.direction === "same" && <Minus className="h-3 w-3 mr-1" />}
                                  {teacher.scoreDelta > 0 ? "+" : ""}{teacher.scoreDelta.toFixed(1)}%
                                </Badge>
                                {expandedTeachers.has(teacher.teacherId) ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1 border-t bg-muted/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                {/* Top Improvements */}
                                <div>
                                  <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4" />
                                    Biggest Improvements
                                  </h4>
                                  {teacher.topImprovements.length > 0 ? (
                                    <div className="space-y-1">
                                      {teacher.topImprovements.map((cat, catIdx) => (
                                        <div 
                                          key={catIdx} 
                                          className="flex items-center justify-between text-sm p-2 bg-green-50 dark:bg-green-950/30 rounded"
                                        >
                                          <span className="truncate">{cat.categoryName}</span>
                                          <Badge variant="default" className="text-xs">
                                            +{cat.delta.toFixed(0)}%
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No improvements recorded</p>
                                  )}
                                </div>
                                {/* Top Declines */}
                                <div>
                                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                                    <TrendingDown className="h-4 w-4" />
                                    Areas to Watch
                                  </h4>
                                  {teacher.topDeclines.length > 0 ? (
                                    <div className="space-y-1">
                                      {teacher.topDeclines.map((cat, catIdx) => (
                                        <div 
                                          key={catIdx} 
                                          className="flex items-center justify-between text-sm p-2 bg-red-50 dark:bg-red-950/30 rounded"
                                        >
                                          <span className="truncate">{cat.categoryName}</span>
                                          <Badge variant="destructive" className="text-xs">
                                            {cat.delta.toFixed(0)}%
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">No declines recorded</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                    {comparisonData.deltas.teacherChanges.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center pt-2">
                        Showing top 20 of {comparisonData.deltas.teacherChanges.length} teachers by change magnitude
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-8">
            <div className="text-center space-y-3">
              <GitCompare className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">Select Date Ranges to Compare</p>
              <p className="text-sm text-muted-foreground">
                Choose Period A (baseline) and Period B (comparison) above to see performance changes.
              </p>
            </div>
          </Card>
        )
      )}

      {!compareMode && (isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading analytics...</div>
      ) : analyticsData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-observations">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Observations</CardTitle>
                <Eye className="h-4 w-4 accent-icon" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold accent-number" data-testid="text-total-obs">
                  {analyticsData.summary.totalObservations}
                </div>
                <p className="text-xs text-muted-foreground">in selected period</p>
              </CardContent>
            </Card>
            <Card data-testid="card-unique-teachers">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Unique Teachers</CardTitle>
                <Users className="h-4 w-4 accent-icon" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold accent-number" data-testid="text-unique-teachers">
                  {analyticsData.summary.uniqueTeachers}
                </div>
                <p className="text-xs text-muted-foreground">observed</p>
              </CardContent>
            </Card>
            <Card data-testid="card-average-score">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <Target className="h-4 w-4 accent-icon" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold accent-number" data-testid="text-avg-score">
                  {analyticsData.summary.averageScore.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">out of 5.0</p>
              </CardContent>
            </Card>
            <Card data-testid="card-score-change">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Score Change</CardTitle>
                {analyticsData.summary.scoreChange >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${analyticsData.summary.scoreChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analyticsData.summary.scoreChange >= 0 ? '+' : ''}{analyticsData.summary.scoreChange.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">vs previous period</p>
              </CardContent>
            </Card>
          </div>

          {/* Observation Trend Chart */}
          {analyticsData.observationTrend && analyticsData.observationTrend.length > 0 && (
            <Card data-testid="card-observation-trend">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Observation Trend
                  </CardTitle>
                  <CardDescription>Weekly observation count and quality score</CardDescription>
                </div>
                <ToggleGroup 
                  type="single" 
                  value={chartDisplayMode}
                  onValueChange={(value) => value && setChartDisplayMode(value as ChartDisplayMode)}
                  data-testid="toggle-chart-display"
                >
                  <ToggleGroupItem value="both" aria-label="Show both" data-testid="toggle-both">
                    Both
                  </ToggleGroupItem>
                  <ToggleGroupItem value="observations" aria-label="Show observations only" data-testid="toggle-observations">
                    Count
                  </ToggleGroupItem>
                  <ToggleGroupItem value="quality" aria-label="Show quality only" data-testid="toggle-quality">
                    Quality
                  </ToggleGroupItem>
                </ToggleGroup>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart 
                    data={analyticsData.observationTrend}
                    onClick={(data: any) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        const payload = data.activePayload[0].payload;
                        if (payload.sortKey) {
                          openDrillDown("week", `Week of ${payload.label}`, String(payload.sortKey));
                        }
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="label" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    {(chartDisplayMode === "both" || chartDisplayMode === "observations") && (
                      <YAxis 
                        yAxisId="left"
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }}
                        allowDecimals={false}
                      />
                    )}
                    {(chartDisplayMode === "both" || chartDisplayMode === "quality") && (
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        domain={[0, 5]}
                        label={{ value: 'Quality (0-5)', angle: 90, position: 'insideRight', style: { fill: 'hsl(var(--muted-foreground))' } }}
                      />
                    )}
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number, name: string) => [
                        name === "Average Quality" ? value.toFixed(2) : value,
                        name
                      ]}
                    />
                    <Legend />
                    {(chartDisplayMode === "both" || chartDisplayMode === "observations") && (
                      <Bar 
                        yAxisId="left"
                        dataKey="value" 
                        fill="hsl(var(--primary))" 
                        name="Observation Count"
                        radius={[4, 4, 0, 0]}
                      />
                    )}
                    {(chartDisplayMode === "both" || chartDisplayMode === "quality") && (
                      <Line 
                        yAxisId={chartDisplayMode === "quality" ? "right" : "right"}
                        type="monotone" 
                        dataKey="quality" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        name="Average Quality"
                        dot={{ fill: 'hsl(var(--chart-2))', r: 4 }}
                        connectNulls
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Tabs value={analyticsTab} onValueChange={(value) => setAnalyticsTab(value as AnalyticsTab)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto gap-2 bg-transparent p-0">
              {pivotItems.map((item) => {
                const Icon = item.icon;
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    data-testid={`tab-${item.value}`}
                    className="h-auto justify-between rounded-lg border bg-card px-3 py-2 text-left data-[state=active]:border-primary data-[state=active]:bg-primary/5"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <Badge variant="secondary" className="ml-2">{item.count}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="performers" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performers */}
                <Card data-testid="card-top-performers">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                      Top Performing Teachers
                    </CardTitle>
                    <CardDescription>Teachers with highest average scores (4.0+)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData.topPerformers && analyticsData.topPerformers.length > 0 ? (
                      <div className="space-y-3">
                        {analyticsData.topPerformers.map((teacher, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-2 rounded hover-elevate cursor-pointer" 
                            data-testid={`top-performer-${idx}`}
                            onClick={() => openDrillDown("teacher", teacher.label, teacher.teacherId)}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{idx + 1}</Badge>
                              <span className="font-medium">{teacher.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{teacher.count} obs</Badge>
                              <span className="font-bold text-green-600">{teacher.value.toFixed(2)}/5</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No top performers found in this period.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Lowest Performers */}
                <Card data-testid="card-lowest-performers">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-orange-500" />
                      Teachers Needing Support
                    </CardTitle>
                    <CardDescription>Teachers with lower scores (below 3.5) who may benefit from additional support</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {analyticsData.lowestPerformers && analyticsData.lowestPerformers.length > 0 ? (
                      <div className="space-y-3">
                        {analyticsData.lowestPerformers.map((teacher, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center justify-between p-2 rounded hover-elevate cursor-pointer" 
                            data-testid={`lowest-performer-${idx}`}
                            onClick={() => openDrillDown("teacher", teacher.label, teacher.teacherId)}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{idx + 1}</Badge>
                              <span className="font-medium">{teacher.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{teacher.count} obs</Badge>
                              <span className="font-bold text-orange-600">{teacher.value.toFixed(2)}/5</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No teachers below threshold in this period.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Category Performance */}
              {analyticsData.categoryPerformance && analyticsData.categoryPerformance.length > 0 && (
                <Card data-testid="card-category-performance">
                  <CardHeader>
                    <CardTitle>Category Performance</CardTitle>
                    <CardDescription>Average scores by observation category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analyticsData.categoryPerformance.map((cat, idx) => (
                        <div key={idx} className="space-y-2" data-testid={`category-${idx}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{cat.name}</span>
                            <span className="text-muted-foreground">
                              {cat.avgScore}/{cat.maxScore} ({cat.maxScore > 0 ? ((cat.avgScore / cat.maxScore) * 100).toFixed(0) : 0}%)
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${cat.maxScore > 0 ? (cat.avgScore / cat.maxScore) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="groups" className="space-y-4">
              <Card data-testid="card-teaching-groups">
                <CardHeader>
                  <CardTitle>Teaching Group Analysis</CardTitle>
                  <CardDescription>Performance breakdown by teaching group/department</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData.teachingGroupAnalysis && analyticsData.teachingGroupAnalysis.length > 0 ? (
                    <div className="space-y-4">
                      {analyticsData.teachingGroupAnalysis.map((group, idx) => (
                        <div 
                          key={idx} 
                          className="p-4 border rounded-lg space-y-2 hover-elevate cursor-pointer" 
                          data-testid={`teaching-group-${idx}`}
                          onClick={() => openDrillDown("group", group.groupName, group.groupId)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-lg">{group.groupName}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{group.teacherCount} teachers</Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Observations:</span>
                              <span className="ml-2 font-medium">{group.observationCount}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Avg Score:</span>
                              <span className={`ml-2 font-bold ${group.avgScore >= 4 ? 'text-green-600' : group.avgScore >= 3 ? 'text-yellow-600' : 'text-orange-600'}`}>
                                {group.avgScore.toFixed(2)}/5
                              </span>
                            </div>
                          </div>
                          <div className="h-2 bg-muted rounded-full">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(group.avgScore / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No teaching group data available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="habits" className="space-y-4">
              <Card data-testid="card-habit-analysis">
                <CardHeader>
                  <CardTitle>Habit & Category Analysis</CardTitle>
                  <CardDescription>Most common feedback points and areas of focus</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData.habitAnalysis && analyticsData.habitAnalysis.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.habitAnalysis.slice(0, 15).map((habit, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between p-2 border rounded hover-elevate cursor-pointer" 
                          data-testid={`habit-${idx}`}
                          onClick={() => openDrillDown("habit", habit.habitName, habit.habitName)}
                        >
                          <div className="flex-1">
                            <span className="font-medium">{habit.habitName}</span>
                            <span className="text-muted-foreground text-sm ml-2">({habit.categoryName})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-muted rounded-full">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${habit.percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-12 text-right">{habit.percentage.toFixed(0)}%</span>
                            <Badge variant="outline">{habit.observedCount}/{habit.totalCount}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No habit data available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qualitative" className="space-y-4">
              {/* Common Phrases */}
              <Card data-testid="card-common-phrases">
                <CardHeader>
                  <CardTitle>Common Phrases in Feedback</CardTitle>
                  <CardDescription>Most frequently used phrases in qualitative comments</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData.commonPhrases && analyticsData.commonPhrases.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {analyticsData.commonPhrases.map((phrase, idx) => (
                        <Badge
                          key={idx}
                          variant={phrase.sentiment === "positive" ? "default" : phrase.sentiment === "negative" ? "destructive" : "secondary"}
                          className="text-sm py-1 px-3"
                          data-testid={`phrase-${idx}`}
                        >
                          {phrase.phrase} ({phrase.count})
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No common phrases found.</p>
                  )}
                </CardContent>
              </Card>

              {/* Recent Qualitative Feedback */}
              <Card data-testid="card-qualitative-feedback">
                <CardHeader>
                  <CardTitle>Recent Qualitative Feedback</CardTitle>
                  <CardDescription>Latest comments from observations</CardDescription>
                </CardHeader>
                <CardContent>
                  {analyticsData.qualitativeFeedback && analyticsData.qualitativeFeedback.length > 0 ? (
                    <div className="space-y-4">
                      {analyticsData.qualitativeFeedback.slice(0, 10).map((fb, idx) => (
                        <div key={idx} className="p-3 border rounded-lg space-y-2" data-testid={`feedback-${idx}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{fb.teacherName}</span>
                            <span className="text-muted-foreground">
                              by {fb.observerName} • {new Date(fb.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{fb.feedback}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No qualitative feedback available.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <Card className="p-8">
          <div className="text-center space-y-3">
            <p className="text-lg font-medium">No Analytics Data</p>
            <p className="text-sm text-muted-foreground">
              Complete some observations first to see analytics.
            </p>
          </div>
        </Card>
      ))}

      {/* Drill-down Sheet */}
      <Sheet open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {drillDownFilter?.type === "teacher" && <Users className="h-5 w-5" />}
              {drillDownFilter?.type === "group" && <Users className="h-5 w-5" />}
              {drillDownFilter?.type === "habit" && <Target className="h-5 w-5" />}
              {drillDownFilter?.name}
            </SheetTitle>
            <SheetDescription>
              {drillDownFilter?.type === "teacher" && "All observations for this teacher"}
              {drillDownFilter?.type === "group" && "All observations for this teaching group"}
              {drillDownFilter?.type === "habit" && "Observations involving this habit"}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-150px)] mt-6">
            {drillDownObservations.length > 0 ? (
              <div className="space-y-3 pr-4">
                {drillDownObservations
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((obs) => {
                    const display = getObservationDisplay(obs);
                    return (
                      <div
                        key={obs.id}
                        className="p-4 border rounded-lg hover-elevate cursor-pointer space-y-2"
                        onClick={() => viewObservation(obs.id)}
                        data-testid={`drilldown-obs-${obs.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{display.teacherName}</span>
                          <Badge 
                            variant={Number(display.score) >= 80 ? "default" : Number(display.score) >= 60 ? "secondary" : "outline"}
                          >
                            {display.score}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3 w-3" />
                            <span>by {display.observerName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>{format(display.date, "dd MMM yyyy")}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-end">
                          <Button variant="ghost" size="sm" className="text-xs">
                            View Details <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No observations found for this filter.
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
