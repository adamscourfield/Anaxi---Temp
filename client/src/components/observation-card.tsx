import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export function ObservationCard({
  teacherName,
  teacherInitials,
  date,
  categories,
  score,
  maxScore,
  onView,
}: ObservationCardProps) {
  return (
    <Card className="hover-elevate" data-testid={`card-observation-${teacherName.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="space-y-0 pb-4">
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
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Score:</span>
          <span className="text-2xl font-semibold" data-testid="text-observation-score">
            {score}/{maxScore}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 2).map((category) => (
            <Badge key={category} variant="secondary" className="text-xs">
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
      <CardFooter>
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
