import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { useSchool } from "@/hooks/use-school";

export function SchoolSelector() {
  const { currentSchoolId, schools, isLoading, hasNoSchools, setCurrentSchoolId } = useSchool();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Loading schools...</span>
      </div>
    );
  }

  if (hasNoSchools) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>No schools assigned</span>
      </div>
    );
  }

  return (
    <Select 
      value={currentSchoolId || undefined} 
      onValueChange={setCurrentSchoolId}
    >
      <SelectTrigger className="w-[200px]" data-testid="select-school">
        <Building2 className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Select school" />
      </SelectTrigger>
      <SelectContent>
        {schools.map((school) => (
          <SelectItem key={school.id} value={school.id} data-testid={`school-option-${school.id}`}>
            {school.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
