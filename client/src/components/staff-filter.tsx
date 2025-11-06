import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, X } from "lucide-react";
import { useState } from "react";
import type { User } from "@shared/schema";

interface StaffFilterProps {
  users: User[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function StaffFilter({ users, selectedIds, onSelectionChange }: StaffFilterProps) {
  const [open, setOpen] = useState(false);

  const toggleUser = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onSelectionChange(selectedIds.filter(id => id !== userId));
    } else {
      onSelectionChange([...selectedIds, userId]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectedUsers = users.filter(u => selectedIds.includes(u.id));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" data-testid="button-staff-filter">
            Filter by Staff
            {selectedIds.length > 0 && (
              <Badge variant="secondary" className="ml-2 px-1.5">
                {selectedIds.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search staff..." data-testid="input-search-staff" />
            <CommandList>
              <CommandEmpty>No staff found.</CommandEmpty>
              <CommandGroup>
                {users.map((user) => {
                  const isSelected = selectedIds.includes(user.id);
                  const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
                  
                  return (
                    <CommandItem
                      key={user.id}
                      onSelect={() => toggleUser(user.id)}
                      data-testid={`staff-option-${user.id}`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-input'}`}>
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm">{userName}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedUsers.length > 0 && (
        <>
          {selectedUsers.map((user) => {
            const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
            return (
              <Badge key={user.id} variant="secondary" className="gap-1" data-testid={`selected-staff-${user.id}`}>
                {userName}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => toggleUser(user.id)}
                />
              </Badge>
            );
          })}
          <Button variant="ghost" size="sm" onClick={clearAll} data-testid="button-clear-staff-filter">
            Clear all
          </Button>
        </>
      )}
    </div>
  );
}
