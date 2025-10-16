import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import type { Teacher } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const SCHOOL_ID = "3d629223-97f8-4d33-8e7e-974bbbf156b8";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserSwitcher() {
  const { currentUser, setCurrentUserId } = useAuth();

  const { data: teachers = [] } = useQuery<Teacher[]>({
    queryKey: ["/api/teachers", SCHOOL_ID],
    queryFn: async () => {
      const response = await fetch(`/api/teachers?schoolId=${SCHOOL_ID}`);
      if (!response.ok) throw new Error("Failed to fetch teachers");
      return response.json();
    },
  });

  if (!currentUser) return null;

  return (
    <Select value={currentUser.id} onValueChange={setCurrentUserId}>
      <SelectTrigger className="w-[250px]" data-testid="select-current-user">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">{getInitials(currentUser.name)}</AvatarFallback>
          </Avatar>
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {teachers.map((teacher) => (
          <SelectItem key={teacher.id} value={teacher.id}>
            <div className="flex items-center gap-3 py-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{getInitials(teacher.name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{teacher.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{teacher.email}</span>
                  <Badge variant={teacher.role === "Admin" ? "default" : teacher.role === "Leader" ? "secondary" : "outline"} className="text-xs">
                    {teacher.role || "Teacher"}
                  </Badge>
                </div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
