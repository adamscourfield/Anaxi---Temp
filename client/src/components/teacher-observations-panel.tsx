import { SidePanel } from "./side-panel";
import { ObservationCard } from "./observation-card";

interface TeacherObservation {
  id: string;
  teacherName: string;
  teacherInitials: string;
  date: Date;
  categories: string[];
  score: number;
  maxScore: number;
}

interface TeacherObservationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  teacherName: string;
  observations: TeacherObservation[];
  onObservationClick?: (observationId: string) => void;
}

export function TeacherObservationsPanel({
  isOpen,
  onClose,
  teacherName,
  observations,
  onObservationClick,
}: TeacherObservationsPanelProps) {
  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={`${teacherName}'s Observations`}
    >
      {observations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No observations yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {observations.map((obs) => (
            <ObservationCard
              key={obs.id}
              teacherName={obs.teacherName}
              teacherInitials={obs.teacherInitials}
              date={obs.date}
              categories={obs.categories}
              score={obs.score}
              maxScore={obs.maxScore}
              onView={() => onObservationClick?.(obs.id)}
            />
          ))}
        </div>
      )}
    </SidePanel>
  );
}
