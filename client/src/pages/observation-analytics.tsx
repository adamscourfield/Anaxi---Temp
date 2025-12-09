import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Eye, 
  Users, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  MessageSquare,
  Target,
  Award
} from "lucide-react";

type TimePeriod = "week" | "month" | "year" | "all";

interface AnalyticsData {
  summary: {
    totalObservations: number;
    uniqueTeachers: number;
    averageScore: number;
    scoreChange: number;
  };
  observationTrend: Array<{ label: string; value: number; quality: number }>;
  topPerformers: Array<{ label: string; value: number; maxValue: number; count: number }>;
  lowestPerformers: Array<{ label: string; value: number; maxValue: number; count: number }>;
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

export default function ObservationAnalytics() {
  const { user, isCreator } = useAuth();
  const { currentSchoolId, currentSchool } = useSchool();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");

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
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading analytics...</div>
      ) : analyticsData ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-observations">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Observations</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-obs">
                  {analyticsData.summary.totalObservations}
                </div>
                <p className="text-xs text-muted-foreground">in selected period</p>
              </CardContent>
            </Card>
            <Card data-testid="card-unique-teachers">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Unique Teachers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-unique-teachers">
                  {analyticsData.summary.uniqueTeachers}
                </div>
                <p className="text-xs text-muted-foreground">observed</p>
              </CardContent>
            </Card>
            <Card data-testid="card-average-score">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-score">
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Observation Trend
                </CardTitle>
                <CardDescription>Observations (bars) and average quality score (line)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between gap-1">
                  {analyticsData.observationTrend.map((item, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs text-muted-foreground">{item.quality.toFixed(1)}</div>
                      <div 
                        className="w-full bg-primary rounded-t relative"
                        style={{ 
                          height: `${Math.max(10, (item.value / Math.max(...analyticsData.observationTrend.map(t => t.value))) * 150)}px` 
                        }}
                        data-testid={`bar-trend-${idx}`}
                      >
                        <div 
                          className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-orange-500 rounded-full"
                          style={{ 
                            bottom: `${(item.quality / 5) * 100}%`
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-center truncate w-full">
                        {item.label}
                      </div>
                      <div className="text-xs font-medium">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded" />
                    <span>Observations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full" />
                    <span>Quality Score</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="performers" className="space-y-4">
            <TabsList>
              <TabsTrigger value="performers" data-testid="tab-performers">
                <Award className="h-4 w-4 mr-2" />
                Performers
              </TabsTrigger>
              <TabsTrigger value="groups" data-testid="tab-groups">
                <Users className="h-4 w-4 mr-2" />
                Teaching Groups
              </TabsTrigger>
              <TabsTrigger value="habits" data-testid="tab-habits">
                <Target className="h-4 w-4 mr-2" />
                Habits & Categories
              </TabsTrigger>
              <TabsTrigger value="qualitative" data-testid="tab-qualitative">
                <MessageSquare className="h-4 w-4 mr-2" />
                Qualitative
              </TabsTrigger>
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
                          <div key={idx} className="flex items-center justify-between" data-testid={`top-performer-${idx}`}>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{idx + 1}</Badge>
                              <span className="font-medium">{teacher.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{teacher.count} obs</Badge>
                              <span className="font-bold text-green-600">{teacher.value.toFixed(2)}/5</span>
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
                          <div key={idx} className="flex items-center justify-between" data-testid={`lowest-performer-${idx}`}>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{idx + 1}</Badge>
                              <span className="font-medium">{teacher.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{teacher.count} obs</Badge>
                              <span className="font-bold text-orange-600">{teacher.value.toFixed(2)}/5</span>
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
                        <div key={idx} className="p-4 border rounded-lg space-y-2" data-testid={`teaching-group-${idx}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-lg">{group.groupName}</span>
                            <Badge variant="secondary">{group.teacherCount} teachers</Badge>
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
                        <div key={idx} className="flex items-center justify-between p-2 border rounded" data-testid={`habit-${idx}`}>
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
      )}
    </div>
  );
}
