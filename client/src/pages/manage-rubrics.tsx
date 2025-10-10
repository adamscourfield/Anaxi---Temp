import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const rubricCategories = [
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

export default function ManageRubrics() {
  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Rubrics</h1>
          <p className="text-muted-foreground mt-1">
            Configure observation criteria for your school
          </p>
        </div>
        <div className="flex gap-2">
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
              {rubricCategories.length} categories
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {rubricCategories.map((category) => (
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
                        className="flex items-start gap-2 p-3 rounded-md bg-muted/50"
                      >
                        <span className="text-sm text-muted-foreground min-w-[2rem]">
                          {idx + 1}.
                        </span>
                        <span className="text-sm">{habit}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
