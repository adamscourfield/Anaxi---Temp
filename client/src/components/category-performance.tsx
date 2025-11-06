import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CategoryData {
  name: string;
  avgScore: number;
  maxScore: number;
  trend: "up" | "down" | "stable";
  trendValue: number;
}

interface CategoryPerformanceProps {
  categories: CategoryData[];
  onCategoryClick?: (categoryName: string) => void;
}

export function CategoryPerformance({ categories, onCategoryClick }: CategoryPerformanceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Performance by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {categories.map((category, idx) => {
            const percentage = (category.avgScore / category.maxScore) * 100;
            const TrendIcon =
              category.trend === "up"
                ? TrendingUp
                : category.trend === "down"
                  ? TrendingDown
                  : Minus;
            const trendColor =
              category.trend === "up"
                ? "text-chart-1"
                : category.trend === "down"
                  ? "text-chart-2"
                  : "text-muted-foreground";

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 ${onCategoryClick ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                onClick={() => onCategoryClick?.(category.name)}
                data-testid={`category-item-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{category.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {category.avgScore.toFixed(1)}/{category.maxScore}
                      </span>
                      <span className="text-sm font-medium">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-visible">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
