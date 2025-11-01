import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertLeaveRequestSchema } from "@shared/schema";
import type { LeaveRequest, School, SchoolMembership } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, FileText, Upload, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const leaveTypeLabels = {
  medical: "Medical",
  professional_development: "Professional Development",
  annual_leave: "Annual Leave",
  interview: "Interview",
  other: "Other",
};

const statusLabels = {
  pending: "Pending",
  approved_with_pay: "Approved (With Pay)",
  approved_without_pay: "Approved (Without Pay)",
  denied: "Denied",
};

const statusColors = {
  pending: "bg-amber/10 text-amber border-amber/20",
  approved_with_pay: "bg-success/10 text-success border-success/20",
  approved_without_pay: "bg-info/10 text-info border-info/20",
  denied: "bg-destructive/10 text-destructive border-destructive/20",
};

const formSchema = insertLeaveRequestSchema.extend({
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  type: z.enum(["medical", "professional_development", "annual_leave", "interview", "other"]),
  coverDetails: z.string().min(1, "Cover arrangements are required"),
  additionalDetails: z.string().optional(),
  attachmentUrl: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === "medical" || data.type === "professional_development" || data.type === "interview" || data.type === "other") {
      return !!data.additionalDetails && data.additionalDetails.trim().length > 0;
    }
    return true;
  },
  {
    message: "Additional details are required for this leave type",
    path: ["additionalDetails"],
  }
).refine(
  (data) => {
    if (data.type === "medical") {
      return !!data.attachmentUrl && data.attachmentUrl.trim().length > 0;
    }
    return true;
  },
  {
    message: "Medical documentation is required for medical leave",
    path: ["attachmentUrl"],
  }
);

type FormValues = z.infer<typeof formSchema>;

export default function LeaveRequests() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentSchoolId } = useSchool();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schoolId: "",
      membershipId: "",
      type: "annual_leave",
      startDate: undefined,
      endDate: undefined,
      coverDetails: "",
      additionalDetails: "",
      attachmentUrl: "",
      status: "pending",
      approvedBy: null,
      responseNotes: null,
    },
  });

  const watchedType = form.watch("type");

  // Get user's schools and memberships
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: !!user,
  });

  const { data: memberships = [] } = useQuery<SchoolMembership[]>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch("/api/my-memberships");
      if (!response.ok) throw new Error("Failed to fetch memberships");
      return response.json();
    },
  });

  // Get current membership for selected school
  const currentMembership = memberships.find(m => m.schoolId === (selectedSchoolId || currentSchoolId));

  // Fetch leave requests for the selected school
  const { data: leaveRequests = [], isLoading: requestsLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests", selectedSchoolId || currentSchoolId],
    queryFn: async () => {
      const schoolId = selectedSchoolId || currentSchoolId;
      if (!schoolId) return [];
      const response = await fetch(`/api/leave-requests?schoolId=${schoolId}`);
      if (!response.ok) throw new Error("Failed to fetch leave requests");
      return response.json();
    },
    enabled: !!(selectedSchoolId || currentSchoolId),
  });

  // Filter requests for current user
  const myRequests = leaveRequests.filter(
    request => request.membershipId === currentMembership?.id
  );

  const createRequestMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        schoolId: data.schoolId,
        membershipId: data.membershipId,
        type: data.type,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        coverDetails: data.coverDetails,
        additionalDetails: data.additionalDetails || null,
        attachmentUrl: data.attachmentUrl || null,
        status: "pending",
        approvedBy: null,
        responseNotes: null,
      };
      const response = await apiRequest("POST", "/api/leave-requests", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests", selectedSchoolId || currentSchoolId] });
      toast({
        title: "Success",
        description: "Leave request submitted successfully",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit leave request",
        variant: "destructive",
      });
    },
  });


  const onSubmit = (data: FormValues) => {
    if (!currentMembership) {
      toast({
        title: "Error",
        description: "You must be a member of a school to submit leave requests",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...data,
      schoolId: selectedSchoolId || currentSchoolId || "",
      membershipId: currentMembership.id,
    };

    createRequestMutation.mutate(submitData);
  };

  // Set initial school ID when schools load
  if (schools.length > 0 && !selectedSchoolId && currentSchoolId) {
    setSelectedSchoolId(currentSchoolId);
  }

  const requiresAdditionalDetails = watchedType === "medical" || 
    watchedType === "professional_development" || 
    watchedType === "interview" || 
    watchedType === "other";

  const requiresAttachment = watchedType === "medical";

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
        <p className="text-muted-foreground mt-1">
          Submit and manage your leave requests
        </p>
      </div>

      {/* School Selector */}
      <div className="max-w-md">
        <Label htmlFor="school-selector">Select School</Label>
        <Select
          value={selectedSchoolId || currentSchoolId || ""}
          onValueChange={setSelectedSchoolId}
        >
          <SelectTrigger id="school-selector" data-testid="select-school">
            <SelectValue placeholder="Select a school" />
          </SelectTrigger>
          <SelectContent>
            {schools
              .filter(school => memberships.some(m => m.schoolId === school.id))
              .map(school => (
                <SelectItem key={school.id} value={school.id} data-testid={`school-option-${school.id}`}>
                  {school.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leave Request Form */}
      <Card data-testid="card-leave-request-form">
        <CardHeader>
          <CardTitle>Submit Leave Request</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Leave Type */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leave Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      data-testid="select-leave-type"
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="medical" data-testid="leave-type-medical">
                          Medical
                        </SelectItem>
                        <SelectItem value="professional_development" data-testid="leave-type-professional-development">
                          Professional Development
                        </SelectItem>
                        <SelectItem value="annual_leave" data-testid="leave-type-annual-leave">
                          Annual Leave
                        </SelectItem>
                        <SelectItem value="interview" data-testid="leave-type-interview">
                          Interview
                        </SelectItem>
                        <SelectItem value="other" data-testid="leave-type-other">
                          Other
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Start Date */}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-start-date"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-end-date"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conditional: Medical Attachment */}
              {requiresAttachment && (
                <FormField
                  control={form.control}
                  name="attachmentUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medical Documentation (Required)</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="Upload medical documentation or enter URL"
                            data-testid="input-attachment-url"
                            className="flex-1"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            toast({
                              title: "Upload Document",
                              description: "Document upload will be available after object storage is configured",
                            });
                          }}
                          data-testid="button-upload-medical-doc"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Upload medical documentation (PDF, image, etc.)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Conditional: Additional Details */}
              {requiresAdditionalDetails && (
                <FormField
                  control={form.control}
                  name="additionalDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchedType === "professional_development" && "Professional Development Details (Required)"}
                        {watchedType === "interview" && "Interview Details (Required)"}
                        {watchedType === "medical" && "Medical Details (Required)"}
                        {watchedType === "other" && "Additional Details (Required)"}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={
                            watchedType === "professional_development" 
                              ? "Describe the professional development activity..."
                              : watchedType === "interview"
                              ? "Provide interview details..."
                              : watchedType === "medical"
                              ? "Describe medical reason..."
                              : "Provide additional details..."
                          }
                          className="min-h-24"
                          data-testid="textarea-additional-details"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Cover Arrangements */}
              <FormField
                control={form.control}
                name="coverDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cover Arrangements</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe cover arrangements for your classes..."
                        className="min-h-24"
                        data-testid="textarea-cover-details"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={createRequestMutation.isPending}
                  data-testid="button-submit-leave-request"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* My Leave Requests */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My Leave Requests</h2>
        {requestsLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading leave requests...
            </CardContent>
          </Card>
        ) : myRequests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No leave requests found</p>
              <p className="text-sm mt-1">Submit your first leave request above</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {myRequests.map((request) => (
              <Card key={request.id} data-testid={`card-leave-request-${request.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {leaveTypeLabels[request.type as keyof typeof leaveTypeLabels]}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={statusColors[request.status as keyof typeof statusColors]}
                      data-testid={`badge-status-${request.id}`}
                    >
                      {statusLabels[request.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Dates</p>
                    <p className="text-sm" data-testid={`text-dates-${request.id}`}>
                      {format(new Date(request.startDate), "PPP")} - {format(new Date(request.endDate), "PPP")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Cover Arrangements</p>
                    <p className="text-sm" data-testid={`text-cover-${request.id}`}>
                      {request.coverDetails}
                    </p>
                  </div>
                  {request.additionalDetails && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Additional Details</p>
                      <p className="text-sm" data-testid={`text-details-${request.id}`}>
                        {request.additionalDetails}
                      </p>
                    </div>
                  )}
                  {request.responseNotes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Response Notes</p>
                      <p className="text-sm" data-testid={`text-response-${request.id}`}>
                        {request.responseNotes}
                      </p>
                    </div>
                  )}
                  {request.attachmentUrl && (
                    <div>
                      <a
                        href={request.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                        data-testid={`link-attachment-${request.id}`}
                      >
                        View Attachment
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
