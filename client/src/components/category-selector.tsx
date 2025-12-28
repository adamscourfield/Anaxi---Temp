import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface Category {
  id: string;
  name: string;
  habitCount: number;
}

interface CategorySelectorProps {
  categories: Category[];
  selectedCategories: string[];
  onToggleCategory: (categoryId: string) => void;
}

export function CategorySelector({
  categories,
  selectedCategories,
  onToggleCategory,
}: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((category) => {
        const isSelected = selectedCategories.includes(category.id);
        return (
          <Card
            key={category.id}
            className={`cursor-pointer transition-colors hover-elevate ${
              isSelected ? "border-primary" : ""
            }`}
            onClick={() => onToggleCategory(category.id)}
            data-testid={`card-category-${category.id}`}
          >
            <CardHeader className="space-y-0 pb-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleCategory(category.id)}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`checkbox-category-${category.id}`}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{category.name}</h3>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-xs">
                {category.habitCount} habits
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
