import { useState, useEffect, useMemo } from "react";
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
import { Link, useLocation } from "wouter";
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
  const [, setLocation] = useLocation();

  const [teacherId, setTeacherId] = useState("");
  const [lessonTopic, setLessonTopic] = useState("");
  const [classGroup, setClassGroup] = useState("");
  const [qualitativeFeedback, setQualitativeFeedback] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [checkedHabits, setCheckedHabits] = useState<string[]>([]);

  const draftStorageKey = useMemo(() => {
    if (!currentSchoolId || !user?.id) return null;
    return `observation-draft:${currentSchoolId}:${user.id}`;
  }, [currentSchoolId, user?.id]);

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
  const { data: rubrics = [], isLoading: rubricsLoading } = useQuery<any[]>({
    queryKey: ["/api/schools", currentSchoolId, "rubrics"],
    enabled: !!currentSchoolId,
  });

  // Create default rubric mutation
  const createDefaultRubricMutation = useMutation({
    mutationFn: async () => {
      if (!currentSchoolId) throw new Error("No school selected");
      return await apiRequest('POST', `/api/schools/${currentSchoolId}/rubrics`, { 
        name: 'Default Rubric' 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchoolId, "rubrics"] });
    },
  });

  // Auto-create default rubric if none exists
  useEffect(() => {
    if (!rubricsLoading && currentSchoolId && rubrics?.length === 0 && !createDefaultRubricMutation.isPending) {
      createDefaultRubricMutation.mutate();
    }
  }, [rubricsLoading, currentSchoolId, rubrics?.length, createDefaultRubricMutation]);

  const rubricId = rubrics[0]?.id;

  // Fetch categories for the rubric
  const { data: categoriesData = [], isLoading: categoriesLoading } = useQuery<CategoryWithHabits[]>({
    queryKey: ["/api/rubrics", rubricId, "categories"],
    enabled: !!rubricId,
  });

  const createObservationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/observations", data);
      return response.json();
    },
    onSuccess: (createdObservation: any) => {
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
      if (draftStorageKey) {
        localStorage.removeItem(draftStorageKey);
      }
      // Invalidate observations cache
      queryClient.invalidateQueries({ queryKey: ["/api/observations"] });

      if (createdObservation?.id) {
        setLocation(`/history?observationId=${createdObservation.id}`);
      }
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

  const canSubmit = !!teacherId && selectedCategories.length > 0 && !!rubricId;

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

    // Build habit observations data
    const habitObservations = selectedCategoryData.flatMap(category =>
      category.habits.map(habit => ({
        categoryId: category.id,
        habitId: habit.id,
        observed: checkedHabits.includes(habit.id),
      }))
    );

    createObservationMutation.mutate({
      teacherId,
      // observerId is set by backend from authenticated user
      schoolId: currentSchoolId,
      rubricId,
      date: new Date(),
      lessonTopic: lessonTopic || null,
      classInfo: classGroup || null,
      qualitativeFeedback: qualitativeFeedback || null,
      totalScore,
      totalMaxScore,
      habits: habitObservations,
    });
  };

  const clearDraft = () => {
    setTeacherId("");
    setLessonTopic("");
    setClassGroup("");
    setQualitativeFeedback("");
    setSelectedCategories([]);
    setCheckedHabits([]);
    if (draftStorageKey) {
      localStorage.removeItem(draftStorageKey);
    }
    toast({ title: "Draft cleared" });
  };

  useEffect(() => {
    if (!draftStorageKey) return;
    try {
      const rawDraft = localStorage.getItem(draftStorageKey);
      if (!rawDraft) return;
      const draft = JSON.parse(rawDraft);
      setTeacherId(draft.teacherId || "");
      setLessonTopic(draft.lessonTopic || "");
      setClassGroup(draft.classGroup || "");
      setQualitativeFeedback(draft.qualitativeFeedback || "");
      setSelectedCategories(Array.isArray(draft.selectedCategories) ? draft.selectedCategories : []);
      setCheckedHabits(Array.isArray(draft.checkedHabits) ? draft.checkedHabits : []);
    } catch {
      // Ignore invalid draft payloads
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) return;
    const payload = {
      teacherId,
      lessonTopic,
      classGroup,
      qualitativeFeedback,
      selectedCategories,
      checkedHabits,
      savedAt: Date.now(),
    };
    localStorage.setItem(draftStorageKey, JSON.stringify(payload));
  }, [
    draftStorageKey,
    teacherId,
    lessonTopic,
    classGroup,
    qualitativeFeedback,
    selectedCategories,
    checkedHabits,
  ]);

  useEffect(() => {
    const hasChanges = !!teacherId || !!lessonTopic || !!classGroup || !!qualitativeFeedback || selectedCategories.length > 0 || checkedHabits.length > 0;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges || createObservationMutation.isPending) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [teacherId, lessonTopic, classGroup, qualitativeFeedback, selectedCategories.length, checkedHabits.length, createObservationMutation.isPending]);

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

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <p>Before saving: select a teacher, choose at least one category, and ensure a rubric is available.</p>
              <p className="mt-1">Drafts are auto-saved on this device.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={clearDraft} disabled={createObservationMutation.isPending}>
                Clear Draft
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || createObservationMutation.isPending}
                data-testid="button-save-observation"
              >
                <Save className="h-4 w-4 mr-2" />
                {createObservationMutation.isPending ? "Saving..." : "Save Observation"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
