import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Pencil, Trash2, Calendar, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { CsvColumnMapper } from "@/components/csv-column-mapper";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSchool } from "@/hooks/use-school";
import type { Rubric, Category, Habit, CategoryWithHabits } from "@shared/schema";

const habitFormSchema = z.object({
  description: z.string().min(1, "Habit description is required").min(5, "Habit description must be at least 5 characters"),
});

type HabitFormValues = z.infer<typeof habitFormSchema>;

const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required").min(3, "Category name must be at least 3 characters"),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const rollForwardFormSchema = z.object({
  academicYear: z.string().min(1, "Academic year is required"),
  activationDate: z.string().optional(),
});

type RollForwardFormValues = z.infer<typeof rollForwardFormSchema>;

export default function ManageRubrics({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [rollForwardDialogOpen, setRollForwardDialogOpen] = useState(false);
  const [selectedRubricId, setSelectedRubricId] = useState<string | null>(null);
  const [editingHabit, setEditingHabit] = useState<{
    habitId: string;
    categoryId: string;
    currentDescription: string;
  } | null>(null);
  const [addingToCategoryId, setAddingToCategoryId] = useState<string | null>(null);
  
  // CSV import state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][]; mappings: Record<string, string> } | null>(null);
  const [isImportValid, setIsImportValid] = useState(false);
  const { toast } = useToast();
  const { currentSchool } = useSchool();

  // Fetch rubrics for the current school
  const { data: rubrics, isLoading: rubricsLoading } = useQuery<Rubric[]>({
    queryKey: ['/api/schools', currentSchool?.id, 'rubrics'],
    enabled: !!currentSchool?.id,
  });

  // Create default rubric mutation
  const createDefaultRubricMutation = useMutation({
    mutationFn: async () => {
      if (!currentSchool?.id) throw new Error("No school selected");
      const response = await apiRequest('POST', `/api/schools/${currentSchool.id}/rubrics`, { 
        name: 'Default Rubric' 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schools', currentSchool?.id, 'rubrics'] });
    },
  });

  // Get the selected rubric or the first active rubric
  const currentRubric = selectedRubricId 
    ? rubrics?.find(r => r.id === selectedRubricId)
    : rubrics?.find(r => r.status === "active") || rubrics?.[0];
  
  // Auto-select rubric when rubrics load
  useEffect(() => {
    if (rubrics && rubrics.length > 0 && !selectedRubricId) {
      const activeRubric = rubrics.find(r => r.status === "active");
      setSelectedRubricId(activeRubric?.id || rubrics[0].id);
    }
  }, [rubrics, selectedRubricId]);
  
  // Auto-create default rubric if none exists
  useEffect(() => {
    if (!rubricsLoading && currentSchool?.id && rubrics?.length === 0 && !createDefaultRubricMutation.isPending) {
      createDefaultRubricMutation.mutate();
    }
  }, [rubricsLoading, currentSchool?.id, rubrics?.length, createDefaultRubricMutation]);

  // Fetch categories with habits for the current rubric
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<CategoryWithHabits[]>({
    queryKey: ['/api/rubrics', currentRubric?.id, 'categories'],
    enabled: !!currentRubric?.id,
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      if (!currentRubric?.id) throw new Error("No rubric selected");
      const response = await apiRequest('POST', `/api/rubrics/${currentRubric.id}/categories`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rubrics', currentRubric?.id, 'categories'] });
      toast({
        title: "Category added",
        description: "Category has been added to the rubric",
      });
      setCategoryDialogOpen(false);
      categoryForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    },
  });

  // Create habit mutation
  const createHabitMutation = useMutation({
    mutationFn: async ({ categoryId, description }: { categoryId: string; description: string }) => {
      const response = await apiRequest('POST', `/api/categories/${categoryId}/habits`, { description });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rubrics', currentRubric?.id, 'categories'] });
      toast({
        title: "Habit added",
        description: "Habit has been added successfully",
      });
      handleDialogClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create habit",
        variant: "destructive",
      });
    },
  });

  // Update habit mutation
  const updateHabitMutation = useMutation({
    mutationFn: async ({ habitId, description }: { habitId: string; description: string }) => {
      const response = await apiRequest('PUT', `/api/habits/${habitId}`, { description });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rubrics', currentRubric?.id, 'categories'] });
      toast({
        title: "Habit updated",
        description: "Habit has been updated successfully",
      });
      handleDialogClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update habit",
        variant: "destructive",
      });
    },
  });

  // Delete habit mutation
  const deleteHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      await apiRequest('DELETE', `/api/habits/${habitId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rubrics', currentRubric?.id, 'categories'] });
      toast({
        title: "Habit deleted",
        description: "Habit has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete habit",
        variant: "destructive",
      });
    },
  });

  // Roll forward rubric mutation
  const rollForwardMutation = useMutation({
    mutationFn: async (data: RollForwardFormValues) => {
      if (!currentSchool?.id || !currentRubric?.id) throw new Error("No school or rubric selected");
      const response = await apiRequest('POST', `/api/schools/${currentSchool.id}/rubrics/roll-forward`, {
        sourceRubricId: currentRubric.id,
        academicYear: data.academicYear,
        activationDate: data.activationDate || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schools', currentSchool?.id, 'rubrics'] });
      toast({
        title: "Rubric rolled forward",
        description: "New rubric created for the academic year",
      });
      setRollForwardDialogOpen(false);
      rollForwardForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to roll forward rubric",
        variant: "destructive",
      });
    },
  });

  const form = useForm<HabitFormValues>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: {
      description: "",
    },
  });

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const rollForwardForm = useForm<RollForwardFormValues>({
    resolver: zodResolver(rollForwardFormSchema),
    defaultValues: {
      academicYear: "",
      activationDate: "",
    },
  });

  const handleEditHabit = (habitId: string, categoryId: string, currentDescription: string) => {
    setEditingHabit({ habitId, categoryId, currentDescription });
    setAddingToCategoryId(null);
    form.setValue("description", currentDescription);
    setDialogOpen(true);
  };

  const handleAddHabit = (categoryId: string) => {
    setAddingToCategoryId(categoryId);
    setEditingHabit(null);
    form.setValue("description", "");
    setDialogOpen(true);
  };

  const handleDeleteHabit = (habitId: string) => {
    deleteHabitMutation.mutate(habitId);
  };

  const onSubmit = (data: HabitFormValues) => {
    if (editingHabit) {
      // Update existing habit
      updateHabitMutation.mutate({
        habitId: editingHabit.habitId,
        description: data.description,
      });
    } else if (addingToCategoryId) {
      // Add new habit
      createHabitMutation.mutate({
        categoryId: addingToCategoryId,
        description: data.description,
      });
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingHabit(null);
    setAddingToCategoryId(null);
    form.reset();
  };

  const handleAddCategory = () => {
    categoryForm.reset();
    setCategoryDialogOpen(true);
  };

  const onCategorySubmit = (data: CategoryFormValues) => {
    createCategoryMutation.mutate(data);
  };

  const handleImportCsv = async () => {
    if (!csvData || !currentRubric?.id) {
      toast({
        title: "Error",
        description: "No CSV data loaded or no rubric available",
        variant: "destructive",
      });
      return;
    }

    try {
      const { rows, mappings } = csvData;
      const importedCategories: Map<string, string[]> = new Map();

      // Group habits by category
      for (const row of rows) {
        const categoryName = row[csvData.headers.indexOf(mappings.categoryName)]?.trim();
        const habitDescription = row[csvData.headers.indexOf(mappings.habitDescription)]?.trim();

        if (!categoryName || !habitDescription) continue;

        if (!importedCategories.has(categoryName)) {
          importedCategories.set(categoryName, []);
        }
        importedCategories.get(categoryName)!.push(habitDescription);
      }

      // Create categories and habits via API
      let categoriesCreated = 0;
      let habitsCreated = 0;

      for (const [categoryName, habits] of Array.from(importedCategories.entries())) {
        const response = await apiRequest('POST', `/api/rubrics/${currentRubric.id}/categories`, { name: categoryName });
        const category = await response.json() as Category;

        categoriesCreated++;

        // Create all habits for this category
        for (const habitDescription of habits) {
          await apiRequest('POST', `/api/categories/${category.id}/habits`, { description: habitDescription });
          habitsCreated++;
        }
      }

      // Invalidate categories query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/rubrics', currentRubric.id, 'categories'] });

      toast({
        title: "Success",
        description: `Imported ${categoriesCreated} categories with ${habitsCreated} total habits`,
      });

      setIsImportOpen(false);
      setCsvData(null);
      setIsImportValid(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process CSV data",
        variant: "destructive",
      });
    }
  };

  const isLoading = rubricsLoading || categoriesLoading;

  const isArchived = currentRubric?.status === "archived";

  return (
    <div className={isEmbedded ? "space-y-6" : "p-6 space-y-8"}>
      <div className="flex items-center justify-between gap-4">
        {!isEmbedded && (
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Manage Rubrics</h1>
            <p className="text-muted-foreground mt-1">
              Configure observation criteria for your school
            </p>
          </div>
        )}
        
        {/* Rubric Switcher */}
        {rubrics && rubrics.length > 1 && (
          <div className="flex items-center gap-2">
            <Select value={selectedRubricId || ""} onValueChange={setSelectedRubricId}>
              <SelectTrigger className="w-[280px]" data-testid="select-rubric">
                <SelectValue placeholder="Select academic year" />
              </SelectTrigger>
              <SelectContent>
                {rubrics.map((rubric) => (
                  <SelectItem key={rubric.id} value={rubric.id} data-testid={`select-rubric-${rubric.id}`}>
                    <div className="flex items-center gap-2">
                      <span>{rubric.academicYear || rubric.name}</span>
                      {rubric.status === "active" && <Badge variant="default" className="text-xs">Active</Badge>}
                      {rubric.status === "scheduled" && <Badge variant="secondary" className="text-xs">Scheduled</Badge>}
                      {rubric.status === "archived" && <Badge variant="outline" className="text-xs">Archived</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={`flex gap-2 ${isEmbedded && !rubrics ? "ml-auto" : ""}`}>
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-import-rubric">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Import Rubrics from CSV</DialogTitle>
                <DialogDescription>
                  Upload a CSV file and map columns to rubric fields
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <CsvColumnMapper
                  onFileLoad={setCsvData}
                  onValidationChange={setIsImportValid}
                  requiredFields={[
                    { key: "categoryName", label: "Category Name", required: true },
                    { key: "habitDescription", label: "Habit Description", required: true },
                  ]}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsImportOpen(false);
                    setCsvData(null);
                    setIsImportValid(false);
                  }}
                  data-testid="button-cancel-import"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportCsv}
                  disabled={!isImportValid}
                  data-testid="button-submit-import"
                >
                  Import Rubrics
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {!isArchived && (
            <Button 
              variant="outline" 
              onClick={() => setRollForwardDialogOpen(true)} 
              data-testid="button-roll-forward"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Roll Forward
            </Button>
          )}
          <Button onClick={handleAddCategory} disabled={isArchived} data-testid="button-add-category">
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Current Rubric</CardTitle>
            <Badge variant="secondary">
              {categories.length} categories
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading rubric...
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No categories yet. Click "Add Category" to get started.
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {categories.map((category) => (
                <AccordionItem
                  key={category.id}
                  value={category.id}
                  data-testid={`accordion-category-${category.id}`}
                >
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{category.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {category.habits.length} habits
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {category.habits.map((habit, idx) => (
                        <div
                          key={habit.id}
                          className="flex items-start gap-2 p-3 rounded-md bg-muted/50 hover-elevate group"
                        >
                          <span className="text-sm text-muted-foreground min-w-[2rem]">
                            {idx + 1}.
                          </span>
                          <span className="text-sm flex-1">{habit.description}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleEditHabit(habit.id, category.id, habit.description)}
                              disabled={isArchived}
                              data-testid={`button-edit-habit-${category.id}-${idx}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleDeleteHabit(habit.id)}
                              disabled={isArchived}
                              data-testid={`button-delete-habit-${category.id}-${idx}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => handleAddHabit(category.id)}
                        disabled={isArchived}
                        data-testid={`button-add-habit-${category.id}`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Habit
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Enter a name for the new category. You can add habits to it afterwards.
            </DialogDescription>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Classroom Management"
                        data-testid="input-category-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setCategoryDialogOpen(false)} 
                  data-testid="button-cancel-category"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  data-testid="button-submit-category"
                  disabled={createCategoryMutation.isPending}
                >
                  {createCategoryMutation.isPending ? "Adding..." : "Add Category"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHabit ? "Edit Habit" : "Add New Habit"}
            </DialogTitle>
            <DialogDescription>
              {editingHabit 
                ? "Update the habit description below" 
                : "Enter the description for the new habit"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Habit Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Teacher positioned at threshold, greeting each pupil."
                        className="resize-none"
                        rows={3}
                        data-testid="input-habit-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={handleDialogClose} 
                  data-testid="button-cancel-habit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  data-testid="button-submit-habit"
                  disabled={createHabitMutation.isPending || updateHabitMutation.isPending}
                >
                  {createHabitMutation.isPending || updateHabitMutation.isPending 
                    ? (editingHabit ? "Updating..." : "Adding...")
                    : (editingHabit ? "Update Habit" : "Add Habit")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={rollForwardDialogOpen} onOpenChange={setRollForwardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roll Forward Rubric</DialogTitle>
            <DialogDescription>
              Create a new rubric for the next academic year based on the current one
            </DialogDescription>
          </DialogHeader>
          <Form {...rollForwardForm}>
            <form onSubmit={rollForwardForm.handleSubmit((data) => rollForwardMutation.mutate(data))} className="space-y-4">
              <FormField
                control={rollForwardForm.control}
                name="academicYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Academic Year</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 2025-2026"
                        data-testid="input-academic-year"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={rollForwardForm.control}
                name="activationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activation Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-activation-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground">
                      If set, the rubric will be scheduled for activation on this date. Leave empty to activate immediately.
                    </p>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setRollForwardDialogOpen(false)} 
                  data-testid="button-cancel-roll-forward"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  data-testid="button-submit-roll-forward"
                  disabled={rollForwardMutation.isPending}
                >
                  {rollForwardMutation.isPending ? "Creating..." : "Roll Forward"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
