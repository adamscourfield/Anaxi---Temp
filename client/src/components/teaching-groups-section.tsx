import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useLocation } from "wouter";

interface TeachingGroup {
  id: string;
  name: string;
  groupLead: {
    name: string;
    initials: string;
  };
  memberCount: number;
  avgScore: number;
  maxScore: number;
  totalObservations: number;
  weeklyObservations: number;
}

interface TeachingGroupsSectionProps {
  groups: TeachingGroup[];
}

export function TeachingGroupsSection({ groups }: TeachingGroupsSectionProps) {
  const [, setLocation] = useLocation();

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Teaching Groups</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => {
          const percentage = group.maxScore > 0 
            ? Math.round((group.avgScore / group.maxScore) * 100) 
            : 0;
          
          return (
            <Card 
              key={group.id} 
              className="hover-elevate active-elevate-2 cursor-pointer" 
              data-testid={`card-teaching-group-${group.id}`}
              onClick={() => setLocation(`/teaching-groups/${group.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-[hsl(var(--teal)_/_0.1)] flex items-center justify-center">
                    <Users className="h-5 w-5 text-[hsl(var(--teal))]" />
                  </div>
                  <h3 className="font-semibold">{group.name}</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">Group Lead</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{group.groupLead.initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{group.groupLead.name}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Avg. Performance</span>
                  <Badge 
                    variant="secondary"
                    className={`text-xs ${percentage >= 80 ? 'bg-[hsl(var(--success)_/_0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)_/_0.2)]' : ''}`}
                  >
                    {percentage}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Total Observations</span>
                  <span className="text-sm font-medium" data-testid={`text-total-observations-${group.id}`}>
                    {group.totalObservations}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
