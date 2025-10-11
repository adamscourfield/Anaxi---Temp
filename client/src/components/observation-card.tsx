import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircularProgress } from "./circular-progress";
import { Eye } from "lucide-react";
import { format } from "date-fns";

interface ObservationCardProps {
  teacherName: string;
  teacherInitials: string;
  date: Date;
  categories: string[];
  score: number;
  maxScore: number;
  onView?: () => void;
}

const categoryColors: Record<string, string> = {
  "Entrance and Do Now": "bg-primary/10 text-primary border-primary/20",
  "Direct Instruction": "bg-[hsl(225_15%_25%_/_0.08)] text-[hsl(225_15%_25%)] border-[hsl(225_15%_25%_/_0.15)]",
  "Checking for Understanding": "bg-[hsl(var(--teal)_/_0.1)] text-[hsl(var(--teal))] border-[hsl(var(--teal)_/_0.2)]",
  "Application": "bg-[hsl(var(--success)_/_0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)_/_0.2)]",
  "Behaviour Routines": "bg-[hsl(var(--warning)_/_0.1)] text-[hsl(var(--warning))] border-[hsl(var(--warning)_/_0.2)]",
  "Exit Routine": "bg-[hsl(var(--pink)_/_0.1)] text-[hsl(var(--pink))] border-[hsl(var(--pink)_/_0.2)]",
  "Pace and Presence": "bg-[hsl(var(--amber)_/_0.1)] text-[hsl(var(--amber))] border-[hsl(var(--amber)_/_0.2)]",
  "Academic Talk": "bg-[hsl(225_15%_25%_/_0.08)] text-[hsl(225_15%_25%)] border-[hsl(225_15%_25%_/_0.15)]",
};

export function ObservationCard({
  teacherName,
  teacherInitials,
  date,
  categories,
  score,
  maxScore,
  onView,
}: ObservationCardProps) {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  
  return (
    <Card className="hover-elevate flex flex-col" data-testid={`card-observation-${teacherName.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{teacherInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{teacherName}</h3>
              <p className="text-xs text-muted-foreground">
                {format(date, "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <CircularProgress percentage={percentage} size={50} strokeWidth={5} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-3xl font-bold" data-testid="text-observation-score">
            {percentage}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">Performance Score</p>
        </div>
        <div className="flex flex-wrap gap-2 items-start">
          {categories.slice(0, 2).map((category) => (
            <Badge 
              key={category} 
              variant="outline" 
              className={`text-xs ${categoryColors[category] || 'bg-secondary/50 text-secondary-foreground'}`}
            >
              {category}
            </Badge>
          ))}
          {categories.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{categories.length - 2} more
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="mt-auto pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={onView}
          data-testid="button-view-observation"
        >
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
