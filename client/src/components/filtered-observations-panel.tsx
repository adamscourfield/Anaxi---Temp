import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ObservationCard } from "@/components/observation-card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Observation {
  id: string;
  teacherName: string;
  teacherInitials: string;
  date: Date;
  categories: string[];
  score: number;
  maxScore: number;
}

interface FilteredObservationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  observations: Observation[];
  onObservationClick: (id: string) => void;
}

export function FilteredObservationsPanel({
  isOpen,
  onClose,
  title,
  observations,
  onObservationClick,
}: FilteredObservationsPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={onClose}
        data-testid="overlay-filtered-observations"
      />
      <div className="fixed right-0 top-0 h-full w-full md:w-[500px] lg:w-[600px] bg-background border-l shadow-lg z-50 overflow-hidden flex flex-col">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {observations.length} observation{observations.length !== 1 ? 's' : ''} found
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-filtered-observations"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-6">
          {observations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No observations found for this selection
            </div>
          ) : (
            <div className="space-y-4">
              {observations.map((obs) => (
                <ObservationCard
                  key={obs.id}
                  {...obs}
                  onView={() => onObservationClick(obs.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
}
