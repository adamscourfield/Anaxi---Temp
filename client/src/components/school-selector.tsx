import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface School {
  id: string;
  name: string;
}

interface SchoolSelectorProps {
  schools: School[];
  selectedSchool: string;
  onSelectSchool: (schoolId: string) => void;
}

export function SchoolSelector({
  schools,
  selectedSchool,
  onSelectSchool,
}: SchoolSelectorProps) {
  return (
    <Select value={selectedSchool} onValueChange={onSelectSchool}>
      <SelectTrigger className="w-[200px]" data-testid="select-school">
        <Building2 className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Select school" />
      </SelectTrigger>
      <SelectContent>
        {schools.map((school) => (
          <SelectItem key={school.id} value={school.id}>
            {school.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
