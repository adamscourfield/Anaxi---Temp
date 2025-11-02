import { useState } from "react";
import { FeedbackReport } from "@/components/feedback-report";
import { ObservationCard } from "@/components/observation-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft, Download } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import { useQuery } from "@tanstack/react-query";
import type { Observation, Teacher } from "@shared/schema";

interface ObservationWithTeacher extends Observation {
  teacher?: Teacher;
}

const sampleFeedback = {
  teacherName: "Sarah Mitchell",
  teacherInitials: "SM",
  observerName: "Rachel Johnson",
  date: new Date(2025, 9, 8),
  categories: [
    {
      name: "Entrance and Do Now",
      score: 5,
      maxScore: 7,
      habits: [
        {
          text: "Do Now on board or distributed.",
          description: "",
          observed: true,
        },
        {
          text: "Uniforms checked and corrected silently.",
          description:
            "Quietly scan each pupil's uniform as they enter and use discreet gestures.",
          observed: false,
        },
        {
          text: "Teacher positioned at threshold, greeting each pupil.",
          description: "",
          observed: true,
        },
        { text: "Countdown used.", description: "", observed: true },
        {
          text: "Students working within 20 seconds.",
          description: "",
          observed: true,
        },
        {
          text: "Exercise books handed out by designated students.",
          description:
            "Confirm that your two pre-assigned book-handlers distribute exercise books quickly.",
          observed: false,
        },
        {
          text: "All students seated silently within 5 seconds.",
          description: "",
          observed: true,
        },
      ],
    },
    {
      name: "Direct Instruction",
      score: 3,
      maxScore: 4,
      habits: [
        {
          text: "One clear strategy of instruction is being used.",
          description: "",
          observed: true,
        },
        {
          text: "Pupils are actively participating.",
          description: "",
          observed: true,
        },
        {
          text: "Modelling is visible and structured.",
          description: "",
          observed: true,
        },
        {
          text: "Teacher checks for accuracy and understanding throughout.",
          description:
            "Cold-call different students regularly to confirm they've grasped each point.",
          observed: false,
        },
      ],
    },
  ],
  totalScore: 8,
  totalMaxScore: 11,
};

export default function ObservationHistory() {
  const { toast } = useToast();
  const { user, isCreator } = useAuth();
  const { currentSchoolId, hasNoSchools } = useSchool();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedObservation, setSelectedObservation] = useState<string | null>(null);

  // Fetch observations for current school
  const { data: observations = [], isLoading: observationsLoading } = useQuery<Observation[]>({
    queryKey: ["/api/observations", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/observations?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch observations");
      return response.json();
    },
  });

  // Fetch teachers for display names
  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
  });

  // Get teacher profile to check role for export permissions
  const { data: currentTeacher } = useQuery<Teacher>({
    queryKey: ["/api/teachers/me", currentSchoolId],
    enabled: !!user && !!currentSchoolId && !isCreator,
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      const allTeachers: Teacher[] = await response.json();
      const myTeacher = allTeachers.find(t => t.userId === user?.id);
      if (!myTeacher) throw new Error("Teacher profile not found");
      return myTeacher;
    },
  });

  const canExport = isCreator || currentTeacher?.role === "Leader" || currentTeacher?.role === "Admin";

  // Map observations with teacher names
  const observationsWithNames = observations.map(obs => {
    const teacher = teachers.find(t => t.id === obs.teacherId);
    return {
      ...obs,
      teacherName: teacher?.name || "Unknown",
      teacherInitials: teacher ? teacher.name.split(' ').map(n => n[0]).join('') : "??",
    };
  });

  const exportToCSV = () => {
    const headers = ["Date", "Teacher", "Score", "Max Score", "Percentage"];
    const rows = observationsWithNames.map((obs) => {
      const percentage = obs.totalMaxScore > 0 ? Math.round((obs.totalScore / obs.totalMaxScore) * 100) : 0;
      return [
        format(new Date(obs.date), "yyyy-MM-dd"),
        obs.teacherName,
        obs.totalScore.toString(),
        obs.totalMaxScore.toString(),
        `${percentage}%`,
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `observations_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: `Exported ${observations.length} observations to CSV`,
    });
  };

  if (selectedObservation) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedObservation(null)}
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Observation Details
            </h1>
            <p className="text-muted-foreground mt-1">
              Feedback report and performance summary
            </p>
          </div>
        </div>
        <FeedbackReport {...sampleFeedback} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Observation History
          </h1>
          <p className="text-muted-foreground mt-1">
            View all completed observations
          </p>
        </div>
        <div className="flex gap-2">
          {canExport && (
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={observations.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
          <Link href="/observe">
            <Button data-testid="button-new-observation-history">
              New Observation
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by teacher name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-observations"
        />
      </div>

      {observationsLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading observations...</div>
      ) : hasNoSchools ? (
        <div className="text-center text-muted-foreground py-12">No school assigned</div>
      ) : observations.length === 0 ? (
        <Card className="p-8">
          <div className="text-center space-y-3">
            <p className="text-lg font-medium">No observations to display</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {!isCreator && currentTeacher?.role !== "Admin" && currentTeacher?.role !== "Leader" ? (
                <>
                  You don't have permission to view any observations yet. Administrators can grant you access to view specific teachers' observations for mentoring, department oversight, or peer observation groups.
                </>
              ) : (
                <>
                  No observations have been recorded yet. Start by creating your first observation.
                </>
              )}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {observationsWithNames.map((obs) => (
            <ObservationCard
              key={obs.id}
              teacherName={obs.teacherName}
              teacherInitials={obs.teacherInitials}
              date={new Date(obs.date)}
              categories={[]} // Categories not yet implemented
              score={obs.totalScore}
              maxScore={obs.totalMaxScore}
              onView={() => setSelectedObservation(obs.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
