import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Teacher {
  id: string;
  name: string;
  initials: string;
  email: string | null;
  role?: string;
  groupId?: string | null;
  groupName?: string;
  observationCount: number;
}

interface TeachingGroup {
  id: string;
  name: string;
}

interface TeacherTableProps {
  teachers: Teacher[];
  teachingGroups: TeachingGroup[];
  onEdit?: (teacher: Teacher) => void;
  onDelete?: (teacher: Teacher) => void;
  onAssignGroup?: (teacherId: string, groupId: string | null) => void;
}

export function TeacherTable({ teachers, teachingGroups, onEdit, onDelete, onAssignGroup }: TeacherTableProps) {
  const hasActions = !!onEdit || !!onDelete;
  
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Teacher</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Teaching Group</TableHead>
            <TableHead>Observations</TableHead>
            {hasActions && <TableHead className="w-[50px]"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => (
            <TableRow key={teacher.id} data-testid={`row-teacher-${teacher.id}`}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{teacher.initials}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{teacher.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{teacher.email || "—"}</TableCell>
              <TableCell>
                <Badge 
                  variant={
                    teacher.role === "Admin" ? "default" : 
                    teacher.role === "Leader" ? "secondary" : 
                    "outline"
                  }
                  data-testid={`badge-role-${teacher.id}`}
                >
                  {teacher.role || "Teacher"}
                </Badge>
              </TableCell>
              <TableCell>
                <Select
                  value={teacher.groupId || "none"}
                  onValueChange={(value) => {
                    const groupId = value === "none" ? null : value;
                    onAssignGroup?.(teacher.id, groupId);
                  }}
                >
                  <SelectTrigger 
                    className="w-[200px]" 
                    data-testid={`select-group-${teacher.id}`}
                  >
                    <SelectValue placeholder="No group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No group</SelectItem>
                    {teachingGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell data-testid={`text-observation-count-${teacher.id}`}>
                {teacher.observationCount}
              </TableCell>
              {hasActions && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`button-actions-${teacher.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onEdit && (
                        <DropdownMenuItem
                          onClick={() => onEdit(teacher)}
                          data-testid="button-edit-teacher"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(teacher)}
                          className="text-destructive"
                          data-testid="button-delete-teacher"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
