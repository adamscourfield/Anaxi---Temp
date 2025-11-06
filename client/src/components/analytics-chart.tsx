import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

interface DataPoint {
  label: string;
  value: number;
  maxValue?: number;
}

interface AnalyticsChartProps {
  title: string;
  data: DataPoint[];
  type?: "bar" | "progress";
  showFilter?: boolean;
  timePeriod?: "week" | "month" | "year" | "all";
  onTimePeriodChange?: (period: "week" | "month" | "year" | "all") => void;
  onDataPointClick?: (label: string) => void;
}

export function AnalyticsChart({
  title,
  data,
  type = "bar",
  showFilter = false,
  timePeriod = "all",
  onTimePeriodChange,
  onDataPointClick,
}: AnalyticsChartProps) {

  const maxValue = Math.max(...data.map((d) => d.maxValue || d.value));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {showFilter && onTimePeriodChange && (
            <Select value={timePeriod} onValueChange={onTimePeriodChange}>
              <SelectTrigger className="w-[120px]" data-testid="select-timeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="year">Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, idx) => (
            <div 
              key={idx} 
              className={`space-y-2 ${onDataPointClick ? 'cursor-pointer hover-elevate active-elevate-2 p-2 -m-2 rounded-lg' : ''}`}
              onClick={() => onDataPointClick?.(item.label)}
              data-testid={`chart-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.maxValue !== undefined ? (
                    <span className="text-muted-foreground">
                      {item.value}/{item.maxValue}
                    </span>
                  ) : (
                    <span className="font-semibold">{item.value}</span>
                  )}
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-visible">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${((item.maxValue ? item.value / item.maxValue : item.value / maxValue) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
