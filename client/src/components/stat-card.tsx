import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  color?: "primary" | "success" | "info" | "warning" | "teal" | "amber" | "pink";
}

const colorClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-[hsl(var(--success)_/_0.1)] text-[hsl(var(--success))]",
  info: "bg-[hsl(var(--info)_/_0.1)] text-[hsl(var(--info))]",
  warning: "bg-[hsl(var(--warning)_/_0.1)] text-[hsl(var(--warning))]",
  teal: "bg-[hsl(var(--teal)_/_0.1)] text-[hsl(var(--teal))]",
  amber: "bg-[hsl(var(--amber)_/_0.1)] text-[hsl(var(--amber))]",
  pink: "bg-[hsl(var(--pink)_/_0.1)] text-[hsl(var(--pink))]",
};

export function StatCard({ title, value, icon: Icon, description, color = "primary" }: StatCardProps) {
  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold" data-testid={`text-stat-value-${title.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
