import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { useSchool } from "@/hooks/use-school";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User, Category, Habit } from "@shared/schema";

interface CategoryWithHabits extends Category {
  habits: Habit[];
}

export default function ConductObservation() {
  const { currentSchoolId } = useSchool();
  const { user } = useAuth();
  const { toast } = useToast();

  const [teacherId, setTeacherId] = useState("");
  const [lessonTopic, setLessonTopic] = useState("");
  const [classGroup, setClassGroup] = useState("");
  const [qualitativeFeedback, setQualitativeFeedback] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [checkedHabits, setCheckedHabits] = useState<string[]>([]);

  // Fetch teachers for the current school
  const { data: teachers = [], isLoading: teachersLoading } = useQuery<User[]>({
    queryKey: ["/api/teachers", currentSchoolId],
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
    enabled: !!currentSchoolId,
  });

  // Fetch rubric and categories for the current school
  const { data: rubrics = [] } = useQuery<any[]>({
    queryKey: ["/api/schools", currentSchoolId, "rubrics"],
    enabled: !!currentSchoolId,
  });

  const rubricId = rubrics[0]?.id;

  // Fetch categories for the rubric
  const { data: categoriesData = [], isLoading: categoriesLoading } = useQuery<CategoryWithHabits[]>({
    queryKey: ["/api/rubrics", rubricId, "categories"],
    enabled: !!rubricId,
  });

  const createObservationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/observations", data);
    },
    onSuccess: () => {
      toast({
        title: "Observation saved",
        description: "The teacher will receive an email notification.",
      });
      // Reset form
      setTeacherId("");
      setLessonTopic("");
      setClassGroup("");
      setQualitativeFeedback("");
      setSelectedCategories([]);
      setCheckedHabits([]);
      // Invalidate observations cache
      queryClient.invalidateQueries({ queryKey: ["/api/observations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving observation",
        description: error.message || "Failed to save observation",
        variant: "destructive",
      });
    },
  });

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

  const selectedCategoryData = categoriesData.filter((c) =>
    selectedCategories.includes(c.id)
  );

  const totalScore = checkedHabits.length;
  const totalMaxScore = selectedCategoryData.reduce(
    (sum, cat) => sum + cat.habits.length,
    0
  );

  const handleSubmit = () => {
    if (!teacherId) {
      toast({
        title: "Please select a teacher",
        variant: "destructive",
      });
      return;
    }

    if (!rubricId) {
      toast({
        title: "No rubric found",
        description: "Please create a rubric first",
        variant: "destructive",
      });
      return;
    }

    if (selectedCategories.length === 0) {
      toast({
        title: "Please select at least one category",
        variant: "destructive",
      });
      return;
    }

    createObservationMutation.mutate({
      teacherId,
      // observerId is set by backend from authenticated user
      schoolId: currentSchoolId,
      rubricId,
      date: new Date().toISOString(),
      lessonTopic: lessonTopic || null,
      classInfo: classGroup || null,
      qualitativeFeedback: qualitativeFeedback || null,
      totalScore,
      totalMaxScore,
    });
  };

  if (!currentSchoolId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Please select a school first.</p>
      </div>
    );
  }

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
              <Select value={teacherId} onValueChange={setTeacherId} disabled={teachersLoading}>
                <SelectTrigger id="teacher" data-testid="select-teacher">
                  <SelectValue placeholder={teachersLoading ? "Loading..." : "Select a teacher"} />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id} data-testid={`option-teacher-${teacher.id}`}>
                      {teacher.first_name && teacher.last_name 
                        ? `${teacher.first_name} ${teacher.last_name}` 
                        : teacher.email}
                    </SelectItem>
                  ))}
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

      {categoriesLoading ? (
        <p className="text-muted-foreground">Loading rubric...</p>
      ) : categoriesData.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No rubric found for this school. Please create a rubric first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-semibold mb-4">Select Categories to Observe</h2>
            <CategorySelector
              categories={categoriesData.map(c => ({ ...c, habitCount: c.habits.length }))}
              selectedCategories={selectedCategories}
              onToggleCategory={toggleCategory}
            />
          </div>

          {selectedCategoryData.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Mark Observed Habits</h2>
                <Button 
                  onClick={handleSubmit} 
                  disabled={createObservationMutation.isPending}
                  data-testid="button-save-observation"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createObservationMutation.isPending ? "Saving..." : "Save Observation"}
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
        </>
      )}
    </div>
  );
}
