import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, FileText, GraduationCap } from "lucide-react";
import { format } from "date-fns";

interface Habit {
  text: string;
  description: string;
  observed: boolean;
}

interface CategoryFeedback {
  name: string;
  score: number;
  maxScore: number;
  habits: Habit[];
}

interface FeedbackReportProps {
  teacherName: string;
  teacherInitials: string;
  observerName: string;
  date: Date;
  lessonTopic?: string;
  classInfo?: string;
  qualitativeFeedback?: string;
  categories: CategoryFeedback[];
  totalScore: number;
  totalMaxScore: number;
}

export function FeedbackReport({
  teacherName,
  teacherInitials,
  observerName,
  date,
  lessonTopic,
  classInfo,
  qualitativeFeedback,
  categories,
  totalScore,
  totalMaxScore,
}: FeedbackReportProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback>{teacherInitials}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{teacherName}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Observed by {observerName} on {format(date, "MMMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold" data-testid="text-total-score">
                {totalScore}/{totalMaxScore}
              </div>
              <p className="text-sm text-muted-foreground">Total Score</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {lessonTopic && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Lesson Topic</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm" data-testid="text-lesson-topic">{lessonTopic}</p>
          </CardContent>
        </Card>
      )}

      {classInfo && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Class</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm" data-testid="text-class-info">{classInfo}</p>
          </CardContent>
        </Card>
      )}

      {qualitativeFeedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap" data-testid="text-qualitative-feedback">
              {qualitativeFeedback}
            </p>
          </CardContent>
        </Card>
      )}

      {categories.map((category, idx) => (
        <Card key={idx}>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg">{category.name}</CardTitle>
              <Badge variant="secondary">
                {category.score}/{category.maxScore}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {category.habits.map((habit, habitIdx) => (
              <div
                key={habitIdx}
                className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
              >
                {habit.observed ? (
                  <CheckCircle2 className="h-5 w-5 text-chart-1 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-chart-2 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{habit.text}</p>
                  {!habit.observed && (
                    <p className="text-xs text-muted-foreground">
                      {habit.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
