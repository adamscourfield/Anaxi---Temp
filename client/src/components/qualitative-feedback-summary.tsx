import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface QualitativeFeedbackItem {
  teacherName: string;
  observerName: string;
  date: string;
  feedback: string;
}

interface QualitativeFeedbackSummaryProps {
  data: QualitativeFeedbackItem[];
}

export function QualitativeFeedbackSummary({
  data,
}: QualitativeFeedbackSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Qualitative Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No qualitative feedback available
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {data.map((item, idx) => (
                <div key={idx}>
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{item.teacherName}</p>
                        <p className="text-xs text-muted-foreground">
                          Observed by {item.observerName} • {format(new Date(item.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.feedback}
                    </p>
                  </div>
                  {idx < data.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
