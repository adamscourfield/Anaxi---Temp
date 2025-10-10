import { useState } from "react";
import { FeedbackReport } from "@/components/feedback-report";
import { ObservationCard } from "@/components/observation-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const observations = [
  {
    id: "1",
    teacherName: "Sarah Mitchell",
    teacherInitials: "SM",
    date: new Date(2025, 9, 8),
    categories: ["Entrance and Do Now", "Direct Instruction"],
    score: 8,
    maxScore: 11,
  },
  {
    id: "2",
    teacherName: "James Chen",
    teacherInitials: "JC",
    date: new Date(2025, 9, 5),
    categories: ["Behaviour Routines", "Academic Talk"],
    score: 7,
    maxScore: 9,
  },
  {
    id: "3",
    teacherName: "Emily Rodriguez",
    teacherInitials: "ER",
    date: new Date(2025, 9, 3),
    categories: ["Application", "Exit Routine"],
    score: 9,
    maxScore: 10,
  },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedObservation, setSelectedObservation] = useState<string | null>(
    null
  );

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
        <Link href="/observe">
          <Button data-testid="button-new-observation-history">
            New Observation
          </Button>
        </Link>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {observations.map((obs) => (
          <ObservationCard
            key={obs.id}
            {...obs}
            onView={() => setSelectedObservation(obs.id)}
          />
        ))}
      </div>
    </div>
  );
}
