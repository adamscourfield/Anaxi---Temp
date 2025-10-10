import { useState } from "react";
import { CategorySelector } from "@/components/category-selector";
import { HabitChecklist } from "@/components/habit-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

const categories = [
  {
    id: "1",
    name: "Entrance and Do Now",
    habitCount: 7,
    habits: [
      {
        id: "h1",
        text: "Do Now on board or distributed.",
        description:
          'Ensure your "Do Now" task is already displayed or handed out before students arrive.',
      },
      {
        id: "h2",
        text: "Uniforms checked and corrected silently.",
        description:
          "Quietly scan each pupil's uniform as they enter and use discreet gestures.",
      },
      {
        id: "h3",
        text: "Teacher positioned at threshold, greeting each pupil.",
        description:
          "Make sure you stand at the classroom door and personally welcome every student.",
      },
      {
        id: "h4",
        text: "Countdown used.",
        description:
          'Start a clear countdown (e.g., "20…19…18…") as soon as everyone is in.',
      },
      {
        id: "h5",
        text: "Students working within 20 seconds.",
        description:
          "Check that all pupils are writing or answering by twenty seconds into the task.",
      },
      {
        id: "h6",
        text: "Exercise books handed out by designated students.",
        description:
          "Confirm that your two pre-assigned book-handlers distribute exercise books quickly.",
      },
      {
        id: "h7",
        text: "All students seated silently within 5 seconds.",
        description:
          "Enforce a rapid transition into silence, with every pupil seated and focused.",
      },
    ],
  },
  {
    id: "2",
    name: "Direct Instruction",
    habitCount: 4,
    habits: [
      {
        id: "h8",
        text: "One clear strategy of instruction is being used.",
        description:
          'Choose and stick to a single modelling approach (e.g., "Stop and Jot" or "Live Model").',
      },
      {
        id: "h9",
        text: "Pupils are actively participating (jotting, repeating, constructing).",
        description:
          "Check that every student is engaged—writing their notes, repeating key phrases.",
      },
      {
        id: "h10",
        text: "Modelling is visible and structured.",
        description:
          'Display each step of your thinking clearly on the board, using a consistent framework.',
      },
      {
        id: "h11",
        text: "Teacher checks for accuracy and understanding throughout.",
        description:
          "Cold-call different students regularly to confirm they've grasped each point.",
      },
    ],
  },
  {
    id: "3",
    name: "Checking for Understanding",
    habitCount: 4,
    habits: [
      {
        id: "h12",
        text: "At least one strategy in use.",
        description:
          "Embed a check (e.g., mini-whiteboards, turn-and-talk or exit tickets) at least once every five minutes.",
      },
      {
        id: "h13",
        text: "Follow-up questions deepen thinking.",
        description:
          'After an initial answer, ask "Why?" or "Can you explain your reasoning?"',
      },
      {
        id: "h14",
        text: "Misconceptions are addressed instantly.",
        description:
          "As soon as you spot an error, pause the class briefly to correct the misunderstanding.",
      },
      {
        id: "h15",
        text: "Every pupil is participating (no opt out).",
        description:
          "Ensure you select reluctant or quieter students explicitly—no one should be able to sit out.",
      },
    ],
  },
  {
    id: "4",
    name: "Behaviour Routines and Sanctions",
    habitCount: 5,
    habits: [
      {
        id: "h16",
        text: "Warnings delivered calmly and clearly.",
        description:
          "Use a steady, authoritative tone to give each warning—avoid raising your voice.",
      },
      {
        id: "h17",
        text: "Praise-to-warning ratio of 4:1 observed.",
        description:
          "Aim to catch and praise at least four positive behaviours for every correction you issue.",
      },
      {
        id: "h18",
        text: "Teacher maintains calm authority throughout.",
        description:
          "Remain composed and confident—even under challenge—to reinforce your status.",
      },
      {
        id: "h19",
        text: "No negotiation of consequences or arguing.",
        description:
          "Stick to the agreed system: once a warning is given, do not engage in debate.",
      },
      {
        id: "h20",
        text: "Pupils consistently corrected and re-engaged.",
        description:
          "Use silent cues or brief verbal reminders to bring any off-task student swiftly back on track.",
      },
    ],
  },
];

export default function ConductObservation() {
  const [teacher, setTeacher] = useState("");
  const [lessonTopic, setLessonTopic] = useState("");
  const [classGroup, setClassGroup] = useState("");
  const [qualitativeFeedback, setQualitativeFeedback] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [checkedHabits, setCheckedHabits] = useState<string[]>([]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleHabit = (habitId: string) => {
    setCheckedHabits((prev) =>
      prev.includes(habitId)
        ? prev.filter((id) => id !== habitId)
        : [...prev, habitId]
    );
  };

  const selectedCategoryData = categories.filter((c) =>
    selectedCategories.includes(c.id)
  );

  const totalScore = checkedHabits.length;
  const totalMaxScore = selectedCategoryData.reduce(
    (sum, cat) => sum + cat.habits.length,
    0
  );

  const handleSubmit = () => {
    console.log("Submit observation:", {
      teacher,
      lessonTopic,
      classGroup,
      qualitativeFeedback,
      categories: selectedCategories,
      habits: checkedHabits,
      score: `${totalScore}/${totalMaxScore}`,
    });
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Conduct Observation</h1>
            <p className="text-muted-foreground mt-1">
              Select categories and mark observed habits
            </p>
          </div>
        </div>
        {selectedCategories.length > 0 && (
          <div className="text-right">
            <div className="text-3xl font-bold" data-testid="text-observation-score">
              {totalScore}/{totalMaxScore}
            </div>
            <p className="text-sm text-muted-foreground">Current Score</p>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Observation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="teacher">Teacher to observe</Label>
              <Select value={teacher} onValueChange={setTeacher}>
                <SelectTrigger id="teacher" data-testid="select-teacher">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sarah">Sarah Mitchell</SelectItem>
                  <SelectItem value="james">James Chen</SelectItem>
                  <SelectItem value="emily">Emily Rodriguez</SelectItem>
                  <SelectItem value="michael">Michael Thompson</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              <Input
                id="class"
                placeholder="e.g., Year 9 Mathematics"
                value={classGroup}
                onChange={(e) => setClassGroup(e.target.value)}
                data-testid="input-class"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lesson-topic">Lesson Topic</Label>
              <Input
                id="lesson-topic"
                placeholder="e.g., Introduction to Quadratic Equations"
                value={lessonTopic}
                onChange={(e) => setLessonTopic(e.target.value)}
                data-testid="input-lesson-topic"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="qualitative-feedback">Qualitative Feedback</Label>
              <Textarea
                id="qualitative-feedback"
                placeholder="Enter your overall observations and feedback about the lesson..."
                value={qualitativeFeedback}
                onChange={(e) => setQualitativeFeedback(e.target.value)}
                rows={4}
                data-testid="textarea-qualitative-feedback"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Select Categories to Observe</h2>
        <CategorySelector
          categories={categories}
          selectedCategories={selectedCategories}
          onToggleCategory={toggleCategory}
        />
      </div>

      {selectedCategoryData.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Mark Observed Habits</h2>
            <Button onClick={handleSubmit} data-testid="button-save-observation">
              <Save className="h-4 w-4 mr-2" />
              Save Observation
            </Button>
          </div>
          {selectedCategoryData.map((category) => (
            <HabitChecklist
              key={category.id}
              category={category}
              checkedHabits={checkedHabits}
              onToggleHabit={toggleHabit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
