import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useSchool } from "@/hooks/use-school";
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
import { AlertCircle } from "lucide-react";

const oncallFormSchema = z.object({
  studentId: z.string().min(1, "Please select a student"),
  location: z.string().min(1, "Location is required"),
  description: z.string().min(1, "Description is required"),
});

type OncallFormValues = z.infer<typeof oncallFormSchema>;

export default function OnCallPage() {
  const { school } = useSchool();
  const { toast } = useToast();

  const form = useForm<OncallFormValues>({
    resolver: zodResolver(oncallFormSchema),
    defaultValues: {
      studentId: "",
      location: "",
      description: "",
    },
  });

  // Fetch students for this school (non-archived only)
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["/api/schools", school?.id, "students"],
    enabled: !!school?.id,
  });

  const createOncallMutation = useMutation({
    mutationFn: async (data: OncallFormValues) => {
      return apiRequest(`/api/schools/${school?.id}/oncalls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
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

  if (!school) {
    return <div className="p-8">Loading school data...</div>;
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
                    <FormItem>
                      <FormLabel>Student</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoadingStudents}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-student">
                            <SelectValue placeholder="Select a student..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {students.map((student: any) => (
                            <SelectItem
                              key={student.id}
                              value={student.id}
                              data-testid={`student-option-${student.id}`}
                            >
                              {student.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                  <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
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
