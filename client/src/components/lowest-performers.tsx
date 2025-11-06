import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataPoint {
  label: string;
  value: number;
  maxValue?: number;
  count?: number;
}

interface LowestPerformersProps {
  data: DataPoint[];
  timePeriod: "week" | "month" | "year" | "all";
  onTimePeriodChange: (period: "week" | "month" | "year" | "all") => void;
  onDataPointClick?: (label: string) => void;
}

export function LowestPerformers({
  data,
  timePeriod,
  onTimePeriodChange,
  onDataPointClick,
}: LowestPerformersProps) {
  const maxValue = 5;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Teachers Needing Support</CardTitle>
          <Select value={timePeriod} onValueChange={onTimePeriodChange}>
            <SelectTrigger className="w-[120px]" data-testid="select-performers-timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No data available for this period
            </div>
          ) : (
            data.map((item, idx) => (
              <div 
                key={idx} 
                className={`space-y-2 ${onDataPointClick ? 'cursor-pointer hover-elevate active-elevate-2 p-2 -m-2 rounded-lg' : ''}`}
                onClick={() => onDataPointClick?.(item.label)}
                data-testid={`lowest-performer-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {item.value.toFixed(1)}/{maxValue}
                    </span>
                    {item.count && (
                      <span className="text-xs text-muted-foreground">
                        ({item.count} obs)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-visible">
                  <div
                    className="h-full bg-destructive rounded-full transition-all"
                    style={{
                      width: `${(item.value / maxValue) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
