import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Habit {
  id: string;
  text: string;
  description: string;
}

interface Category {
  id: string;
  name: string;
  habits: Habit[];
}

interface HabitChecklistProps {
  category: Category;
  checkedHabits: string[];
  onToggleHabit: (habitId: string) => void;
}

export function HabitChecklist({
  category,
  checkedHabits,
  onToggleHabit,
}: HabitChecklistProps) {
  const checkedCount = category.habits.filter((h) =>
    checkedHabits.includes(h.id)
  ).length;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">{category.name}</CardTitle>
          <Badge variant="secondary" data-testid={`badge-score-${category.id}`}>
            {checkedCount}/{category.habits.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {category.habits.map((habit) => (
          <div
            key={habit.id}
            className="flex items-start gap-3 p-3 rounded-md hover-elevate"
            data-testid={`habit-item-${habit.id}`}
          >
            <Checkbox
              id={habit.id}
              checked={checkedHabits.includes(habit.id)}
              onCheckedChange={() => onToggleHabit(habit.id)}
              data-testid={`checkbox-habit-${habit.id}`}
              className="mt-0.5"
            />
            <label
              htmlFor={habit.id}
              className="flex-1 text-sm cursor-pointer"
            >
              <div className="font-medium">{habit.text}</div>
              {!checkedHabits.includes(habit.id) && (
                <div className="text-xs text-muted-foreground mt-1">
                  {habit.description}
                </div>
              )}
            </label>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
