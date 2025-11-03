import { format } from "date-fns";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ObservationData {
  id: string;
  teacherName: string;
  observerName: string;
  date: Date;
  totalScore: number;
  totalMaxScore: number;
  classGroup?: string;
  categories?: Array<{ name: string }>;
}

interface ObservationTableProps {
  observations: ObservationData[];
  onViewDetails: (observationId: string) => void;
}

export function ObservationTable({ observations, onViewDetails }: ObservationTableProps) {
  if (observations.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No observations to display
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Teacher</TableHead>
            <TableHead>Observer</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Categories</TableHead>
            <TableHead>Class</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {observations.map((obs) => {
            const percentage = obs.totalMaxScore > 0
              ? Math.round((obs.totalScore / obs.totalMaxScore) * 100)
              : 0;

            return (
              <TableRow key={obs.id} data-testid={`row-observation-${obs.id}`}>
                <TableCell className="font-medium" data-testid={`cell-teacher-${obs.id}`}>
                  {obs.teacherName}
                </TableCell>
                <TableCell data-testid={`cell-observer-${obs.id}`}>
                  {obs.observerName}
                </TableCell>
                <TableCell data-testid={`cell-date-${obs.id}`}>
                  {format(new Date(obs.date), "MMM d, yyyy")}
                </TableCell>
                <TableCell data-testid={`cell-score-${obs.id}`}>
                  <div className="flex items-center gap-3">
                    <Progress value={percentage} className="w-24" />
                    <span className="text-sm text-muted-foreground min-w-[3rem]">
                      {percentage}%
                    </span>
                  </div>
                </TableCell>
                <TableCell data-testid={`cell-categories-${obs.id}`}>
                  {obs.categories && obs.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {obs.categories.slice(0, 2).map((cat, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {cat.name}
                        </Badge>
                      ))}
                      {obs.categories.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{obs.categories.length - 2}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell data-testid={`cell-class-${obs.id}`}>
                  {obs.classGroup || <span className="text-muted-foreground">-</span>}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onViewDetails(obs.id)}
                    data-testid={`button-view-observation-${obs.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
