import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface Teacher {
  id: string;
  name: string;
  initials: string;
  totalObservations: number;
  avgScore: number;
  maxScore: number;
  weeklyObservations: number;
}

interface TeachingGroup {
  id: string;
  name: string;
  groupLead: {
    name: string;
    initials: string;
  };
  teachers: Teacher[];
}

interface TeachingGroupsSectionProps {
  groups: TeachingGroup[];
  onTeacherClick?: (teacherId: string, teacherName: string) => void;
}

export function TeachingGroupsSection({ groups, onTeacherClick }: TeachingGroupsSectionProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Teaching Groups</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => {
          return (
            <Card key={group.id} className="hover-elevate" data-testid={`card-teaching-group-${group.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-[hsl(var(--teal)_/_0.1)] flex items-center justify-center">
                      <Users className="h-5 w-5 text-[hsl(var(--teal))]" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{group.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {group.teachers.length} {group.teachers.length === 1 ? 'teacher' : 'teachers'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b">
                  <span className="text-sm text-muted-foreground">Group Lead</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{group.groupLead.initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{group.groupLead.name}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <span className="text-sm font-medium">Team Members</span>
                  {group.teachers.map((teacher) => {
                    const percentage = teacher.maxScore > 0 
                      ? Math.round((teacher.avgScore / teacher.maxScore) * 100) 
                      : 0;
                    
                    return (
                      <div 
                        key={teacher.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-md hover-elevate active-elevate-2 cursor-pointer"
                        onClick={() => onTeacherClick?.(teacher.id, teacher.name)}
                        data-testid={`teacher-item-${teacher.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 flex-shrink-0">
                            <AvatarFallback className="text-xs">{teacher.initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium truncate">{teacher.name}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Total</p>
                            <p className="text-sm font-medium">{teacher.totalObservations}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Avg</p>
                            <Badge 
                              variant="secondary"
                              className={`text-xs ${percentage >= 80 ? 'bg-[hsl(var(--success)_/_0.1)] text-[hsl(var(--success))] border-[hsl(var(--success)_/_0.2)]' : ''}`}
                            >
                              {percentage}%
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Week</p>
                            <p className="text-sm font-medium">{teacher.weeklyObservations}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
