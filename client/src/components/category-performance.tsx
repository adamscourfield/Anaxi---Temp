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
}

export function CategoryPerformance({ categories }: CategoryPerformanceProps) {
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
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{category.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {category.avgScore.toFixed(1)}/{category.maxScore}
                      </span>
                      <div className={`flex items-center gap-1 ${trendColor}`}>
                        <TrendIcon className="h-3 w-3" />
                        <span className="text-xs font-medium">
                          {category.trendValue}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-background rounded-full overflow-hidden">
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
