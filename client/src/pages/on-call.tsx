import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSchool } from "@/hooks/use-school";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ShieldX, ChevronsUpDown, Check } from "lucide-react";
import type { Student } from "@shared/schema";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const oncallFormSchema = z.object({
  studentId: z.string().min(1, "Please select a student"),
  location: z.string().min(1, "Location is required"),
  description: z.string().min(1, "Description is required"),
});

type OncallFormValues = z.infer<typeof oncallFormSchema>;

export default function OnCallPage() {
  const { currentSchool: school } = useSchool();
  const { user } = useAuth();
  const { toast } = useToast();
  const [studentSearchOpen, setStudentSearchOpen] = useState(false);

  const form = useForm<OncallFormValues>({
    resolver: zodResolver(oncallFormSchema),
    defaultValues: {
      studentId: "",
      location: "",
      description: "",
    },
  });

  // Fetch students for this school (non-archived only)
  const { data: students = [], isLoading: isLoadingStudents } = useQuery<Student[]>({
    queryKey: ["/api/schools", school?.id, "students"],
    enabled: !!school?.id,
  });

  const createOncallMutation = useMutation({
    mutationFn: async (data: OncallFormValues) => {
      return apiRequest("POST", `/api/schools/${school?.id}/oncalls`, data);
    },
    onSuccess: () => {
      toast({
        title: "On-Call raised successfully",
        description: "Behaviour management staff have been notified via email.",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/schools", school?.id, "oncalls"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to raise On-Call",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OncallFormValues) => {
    createOncallMutation.mutate(data);
  };

  if (!school || !user) {
    return <div className="p-8">Loading...</div>;
  }

  // Check if school has behaviour feature enabled
  const hasBehaviourFeature = school.enabled_features?.includes("behaviour");

  if (!hasBehaviourFeature) {
    return (
      <div className="h-full overflow-auto p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <ShieldX className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">
                Behaviour management is not enabled for this school.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Raise On-Call</h1>
          <p className="text-muted-foreground mt-2">
            Report a behaviour incident that requires immediate attention.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>On-Call Incident Details</CardTitle>
            <CardDescription>
              Fill in the details below. Behaviour management staff will be notified immediately via email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="studentId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Student</FormLabel>
                      <Popover open={studentSearchOpen} onOpenChange={setStudentSearchOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              disabled={isLoadingStudents}
                              className={cn(
                                "justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="select-student"
                            >
                              {field.value
                                ? students.find((student) => student.id === field.value)?.name
                                : "Select a student..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command>
                            <CommandInput placeholder="Search students..." />
                            <CommandList>
                              <CommandEmpty>No student found.</CommandEmpty>
                              <CommandGroup>
                                {students.map((student) => (
                                  <CommandItem
                                    key={student.id}
                                    value={student.name}
                                    onSelect={() => {
                                      form.setValue("studentId", student.id);
                                      setStudentSearchOpen(false);
                                    }}
                                    data-testid={`student-option-${student.id}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        student.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {student.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Room 205, Canteen, Sports Hall..."
                          {...field}
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Briefly describe the incident..."
                          className="min-h-[120px]"
                          {...field}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted p-4 rounded-md flex gap-3">
                  <AlertCircle className="h-5 w-5 accent-icon flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium mb-1">What happens next?</p>
                    <p>
                      All staff with behaviour management permissions will receive an email notification
                      with the incident details and will be able to respond appropriately.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={createOncallMutation.isPending}
                    data-testid="button-submit-oncall"
                  >
                    {createOncallMutation.isPending ? "Raising On-Call..." : "Raise On-Call"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => form.reset()}
                    disabled={createOncallMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Clear Form
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
