import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Pencil, Trash2 } from "lucide-react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";

const initialCategories = [
  {
    id: "1",
    name: "Entrance and Do Now",
    habitCount: 7,
    habits: [
      "Do Now on board or distributed.",
      "Uniforms checked and corrected silently.",
      "Teacher positioned at threshold, greeting each pupil.",
      "Countdown used.",
      "Students working within 20 seconds.",
      "Exercise books handed out by designated students.",
      "All students seated silently within 5 seconds.",
    ],
  },
  {
    id: "2",
    name: "Direct Instruction",
    habitCount: 4,
    habits: [
      "One clear strategy of instruction is being used.",
      "Pupils are actively participating (jotting, repeating, constructing).",
      "Modelling is visible and structured.",
      "Teacher checks for accuracy and understanding throughout.",
    ],
  },
  {
    id: "3",
    name: "Checking for Understanding",
    habitCount: 4,
    habits: [
      "At least one strategy in use.",
      "Follow-up questions deepen thinking.",
      "Misconceptions are addressed instantly.",
      "Every pupil is participating (no opt out).",
    ],
  },
  {
    id: "4",
    name: "Application",
    habitCount: 4,
    habits: [
      "Pupils are completing core, stretch and twist tasks.",
      "Pupils are resilient and focused on task.",
      "Silent Solo is observed with no help offered.",
      "Timings are visible and enforced.",
    ],
  },
];

const habitFormSchema = z.object({
  description: z.string().min(1, "Habit description is required").min(5, "Habit description must be at least 5 characters"),
});

type HabitFormValues = z.infer<typeof habitFormSchema>;

export default function ManageRubrics({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const [categories, setCategories] = useState(initialCategories);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<{
    categoryId: string;
    habitIndex: number;
  } | null>(null);
  const [addingToCategoryId, setAddingToCategoryId] = useState<string | null>(null);

  const form = useForm<HabitFormValues>({
    resolver: zodResolver(habitFormSchema),
    defaultValues: {
      description: "",
    },
  });

  const handleEditHabit = (categoryId: string, habitIndex: number, currentDescription: string) => {
    setEditingHabit({ categoryId, habitIndex });
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

  const handleDeleteHabit = (categoryId: string, habitIndex: number) => {
    setCategories(categories.map(cat => 
      cat.id === categoryId
        ? {
            ...cat,
            habits: cat.habits.filter((_, idx) => idx !== habitIndex),
            habitCount: cat.habits.length - 1,
          }
        : cat
    ));
  };

  const onSubmit = (data: HabitFormValues) => {
    if (editingHabit) {
      // Update existing habit
      setCategories(categories.map(cat => 
        cat.id === editingHabit.categoryId
          ? {
              ...cat,
              habits: cat.habits.map((habit, idx) => 
                idx === editingHabit.habitIndex ? data.description : habit
              ),
            }
          : cat
      ));
    } else if (addingToCategoryId) {
      // Add new habit
      setCategories(categories.map(cat => 
        cat.id === addingToCategoryId
          ? {
              ...cat,
              habits: [...cat.habits, data.description],
              habitCount: cat.habits.length + 1,
            }
          : cat
      ));
    }

    handleDialogClose();
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingHabit(null);
    setAddingToCategoryId(null);
    form.reset();
  };
  return (
    <div className={isEmbedded ? "space-y-6" : "p-6 space-y-8"}>
      <div className="flex items-center justify-between">
        {!isEmbedded && (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Rubrics</h1>
            <p className="text-muted-foreground mt-1">
              Configure observation criteria for your school
            </p>
          </div>
        )}
        <div className={`flex gap-2 ${isEmbedded ? "ml-auto" : ""}`}>
          <Button variant="outline" data-testid="button-import-rubric">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button data-testid="button-add-category">
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
                      {category.habitCount} habits
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    {category.habits.map((habit, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-3 rounded-md bg-muted/50 hover-elevate group"
                      >
                        <span className="text-sm text-muted-foreground min-w-[2rem]">
                          {idx + 1}.
                        </span>
                        <span className="text-sm flex-1">{habit}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditHabit(category.id, idx, habit)}
                            data-testid={`button-edit-habit-${category.id}-${idx}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleDeleteHabit(category.id, idx)}
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
        </CardContent>
      </Card>

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
                <Button type="button" variant="ghost" onClick={handleDialogClose} data-testid="button-cancel-habit">
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-submit-habit">
                  {editingHabit ? "Update Habit" : "Add Habit"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
