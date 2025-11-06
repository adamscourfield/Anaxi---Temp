import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  timePeriod: "week" | "month" | "year";
  onTimePeriodChange: (period: "week" | "month" | "year") => void;
}

export function CategoryPerformance({ categories, onCategoryClick, timePeriod, onTimePeriodChange }: CategoryPerformanceProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Performance by Category</CardTitle>
          <Select value={timePeriod} onValueChange={onTimePeriodChange}>
            <SelectTrigger className="w-32" data-testid="select-category-time-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
