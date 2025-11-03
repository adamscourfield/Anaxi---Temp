import { SidePanel } from "./side-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CircularProgress } from "./circular-progress";
import { format } from "date-fns";
import { Calendar, FileText, GraduationCap } from "lucide-react";

interface ObservationDetailsData {
  id: string;
  teacherName: string;
  teacherInitials: string;
  observerName: string;
  date: Date;
  lessonTopic?: string;
  classInfo?: string;
  categories: Array<{
    name: string;
    score: number;
    maxScore: number;
    habits: Array<{
      text: string;
      observed: boolean;
    }>;
  }>;
  qualitativeFeedback?: string;
  totalScore: number;
  totalMaxScore: number;
}

interface ObservationDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  observation: ObservationDetailsData | null;
}

const categoryColors: Record<string, string> = {
  "Entrance and Do Now": "bg-primary/[0.06] text-primary border-primary/[0.12]",
  "Direct Instruction": "bg-[hsl(225_15%_25%_/_0.06)] text-[hsl(225_15%_25%)] border-[hsl(225_15%_25%_/_0.12)]",
  "Checking for Understanding": "bg-[hsl(var(--teal)_/_0.06)] text-[hsl(var(--teal))] border-[hsl(var(--teal)_/_0.12)]",
  "Application": "bg-[hsl(var(--success)_/_0.06)] text-[hsl(var(--success))] border-[hsl(var(--success)_/_0.12)]",
  "Behaviour Routines": "bg-[hsl(var(--warning)_/_0.06)] text-[hsl(var(--warning))] border-[hsl(var(--warning)_/_0.12)]",
  "Exit Routine": "bg-[hsl(var(--pink)_/_0.06)] text-[hsl(var(--pink))] border-[hsl(var(--pink)_/_0.12)]",
  "Pace and Presence": "bg-[hsl(var(--amber)_/_0.06)] text-[hsl(var(--amber))] border-[hsl(var(--amber)_/_0.12)]",
  "Academic Talk": "bg-[hsl(225_15%_25%_/_0.06)] text-[hsl(225_15%_25%)] border-[hsl(225_15%_25%_/_0.12)]",
};

export function ObservationDetailsPanel({
  isOpen,
  onClose,
  observation,
}: ObservationDetailsPanelProps) {
  if (!observation) return null;

  const percentage = observation.totalMaxScore > 0
    ? Math.round((observation.totalScore / observation.totalMaxScore) * 100)
    : 0;

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Observation Details"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{observation.teacherInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">{observation.teacherName}</h3>
            <p className="text-sm text-muted-foreground">
              Observed by {observation.observerName}
            </p>
          </div>
          <CircularProgress percentage={percentage} size={80} />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(observation.date, "MMMM d, yyyy")}
                </span>
              </div>
            </CardContent>
          </Card>

          {observation.lessonTopic && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Lesson Topic</p>
                    <p className="text-sm">{observation.lessonTopic}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {observation.classInfo && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Class</p>
                    <p className="text-sm">{observation.classInfo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold">Categories</h3>
          {observation.categories?.map((category, idx) => {
            const catPercentage = category.maxScore > 0
              ? Math.round((category.score / category.maxScore) * 100)
              : 0;

            return (
              <Card key={idx}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={categoryColors[category.name] || 'bg-secondary/50 text-secondary-foreground'}
                    >
                      {category.name}
                    </Badge>
                    <span className="text-sm font-medium">
                      {category.score}/{category.maxScore} ({catPercentage}%)
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {category.habits.map((habit, habitIdx) => (
                    <div
                      key={habitIdx}
                      className={`flex items-start gap-2 text-sm ${
                        habit.observed ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <div className={`mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        habit.observed
                          ? "border-[hsl(var(--success))] bg-[hsl(var(--success)_/_0.1)]"
                          : "border-muted-foreground/30"
                      }`}>
                        {habit.observed && (
                          <div className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />
                        )}
                      </div>
                      <span className="flex-1">{habit.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {observation.qualitativeFeedback && (
          <div className="space-y-2">
            <h3 className="font-semibold">Feedback</h3>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm whitespace-pre-wrap">
                  {observation.qualitativeFeedback}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
