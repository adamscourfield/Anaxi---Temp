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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, FileText, Upload, Plus, Eye, Check, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ObjectUploader } from "@/components/object-uploader";

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

interface EnrichedLeaveRequest extends LeaveRequest {
  requester?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  approver?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export default function LeaveRequests() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentSchoolId } = useSchool();
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EnrichedLeaveRequest | null>(null);
  const [responseNotes, setResponseNotes] = useState("");

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
  });

  // Get current membership for selected school
  const currentMembership = memberships.find(m => m.schoolId === currentSchoolId);
  const canApprove = currentMembership?.canApproveLeaveRequests || false;

  // Fetch leave requests for the current school
  const { data: leaveRequests = [], isLoading: requestsLoading } = useQuery<EnrichedLeaveRequest[]>({
    queryKey: ["/api/leave-requests", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/leave-requests?schoolId=${currentSchoolId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch leave requests");
      }
      return response.json();
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests", currentSchoolId] });
      toast({
        title: "Success",
        description: "Leave request submitted successfully",
      });
      form.reset();
      setShowNewRequestForm(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit leave request",
        variant: "destructive",
      });
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const response = await apiRequest("PATCH", `/api/leave-requests/${id}`, {
        status,
        responseNotes: notes || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests", currentSchoolId] });
      toast({
        title: "Success",
        description: "Leave request updated successfully",
      });
      setSelectedRequest(null);
      setResponseNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update leave request",
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
      schoolId: currentSchoolId || "",
      membershipId: currentMembership.id,
    };

    createRequestMutation.mutate(submitData);
  };

  const handleApprove = (request: EnrichedLeaveRequest, withPay: boolean) => {
    setSelectedRequest(request);
    const status = withPay ? "approved_with_pay" : "approved_without_pay";
    updateRequestMutation.mutate({
      id: request.id,
      status,
      notes: responseNotes,
    });
  };

  const handleDeny = (request: EnrichedLeaveRequest) => {
    if (!responseNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for denial",
        variant: "destructive",
      });
      return;
    }
    updateRequestMutation.mutate({
      id: request.id,
      status: "denied",
      notes: responseNotes,
    });
  };

  const requiresAdditionalDetails = watchedType === "medical" || 
    watchedType === "professional_development" || 
    watchedType === "interview" || 
    watchedType === "other";

  const requiresAttachment = watchedType === "medical";

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave Requests</h1>
          <p className="text-muted-foreground mt-1">
            {canApprove ? "Manage leave requests for your team" : "View and submit your leave requests"}
          </p>
        </div>
        {!showNewRequestForm && (
          <Button onClick={() => setShowNewRequestForm(true)} data-testid="button-new-leave-request">
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        )}
      </div>

      {/* Leave Request Form */}
      {showNewRequestForm && (
        <Card data-testid="card-leave-request-form">
          <CardHeader>
            <CardTitle>Submit Leave Request</CardTitle>
            <CardDescription>Fill in the details for your leave request</CardDescription>
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
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="professional_development">Professional Development</SelectItem>
                          <SelectItem value="annual_leave">Annual Leave</SelectItem>
                          <SelectItem value="interview">Interview</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Start Date & End Date */}
                <div className="grid grid-cols-2 gap-4">
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
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Medical Documentation Upload */}
                {requiresAttachment && (
                  <FormField
                    control={form.control}
                    name="attachmentUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medical Documentation (Required)</FormLabel>
                        <FormControl>
                          <ObjectUploader
                            value={field.value || ""}
                            onChange={field.onChange}
                            accept="application/pdf,image/*"
                            label="Upload medical documentation"
                            data-testid="uploader-medical-doc"
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground">
                          Upload medical documentation (PDF or image)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Additional Details */}
                {requiresAdditionalDetails && (
                  <FormField
                    control={form.control}
                    name="additionalDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {watchedType === "professional_development" && "Professional Development Details"}
                          {watchedType === "interview" && "Interview Details"}
                          {watchedType === "medical" && "Medical Details"}
                          {watchedType === "other" && "Additional Details"}
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

                {/* Form Actions */}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewRequestForm(false);
                      form.reset();
                    }}
                    data-testid="button-cancel-leave-request"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRequestMutation.isPending}
                    data-testid="button-submit-leave-request"
                  >
                    {createRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Leave Requests Table */}
      <Card data-testid="card-leave-requests-table">
        <CardHeader>
          <CardTitle>
            {canApprove ? "All Leave Requests" : "My Leave Requests"}
          </CardTitle>
          <CardDescription>
            {canApprove 
              ? "Review and approve leave requests from your team" 
              : "Track the status of your leave requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : leaveRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leave requests found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((request) => (
                  <TableRow key={request.id} data-testid={`row-leave-request-${request.id}`}>
                    <TableCell className="font-medium">
                      {request.requester 
                        ? `${request.requester.firstName} ${request.requester.lastName}`
                        : "Unknown Teacher"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {leaveTypeLabels[request.type as keyof typeof leaveTypeLabels]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.startDate), "MMM d")} - {format(new Date(request.endDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                        {statusLabels[request.status as keyof typeof statusLabels]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(request.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRequest(request)}
                          data-testid={`button-view-request-${request.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        {canApprove && request.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setResponseNotes("");
                              }}
                              data-testid={`button-approve-request-${request.id}`}
                              className="text-success hover:text-success"
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request);
                                setResponseNotes("");
                              }}
                              data-testid={`button-deny-request-${request.id}`}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Deny
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Leave Request Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
            <DialogDescription>
              Review the complete information for this leave request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              {/* Requester Info */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Requested By</h3>
                <p className="text-base">
                  {selectedRequest.requester 
                    ? `${selectedRequest.requester.firstName} ${selectedRequest.requester.lastName}`
                    : "Unknown Teacher"}
                </p>
                {selectedRequest.requester && (
                  <p className="text-sm text-muted-foreground">{selectedRequest.requester.email}</p>
                )}
              </div>

              {/* Leave Type & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Leave Type</h3>
                  <Badge variant="outline">
                    {leaveTypeLabels[selectedRequest.type as keyof typeof leaveTypeLabels]}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Status</h3>
                  <Badge className={statusColors[selectedRequest.status as keyof typeof statusColors]}>
                    {statusLabels[selectedRequest.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
              </div>

              {/* Dates */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Leave Period</h3>
                <p className="text-base">
                  {format(new Date(selectedRequest.startDate), "MMMM d, yyyy")} - {format(new Date(selectedRequest.endDate), "MMMM d, yyyy")}
                </p>
              </div>

              {/* Cover Details */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Cover Arrangements</h3>
                <p className="text-base whitespace-pre-wrap">{selectedRequest.coverDetails}</p>
              </div>

              {/* Additional Details */}
              {selectedRequest.additionalDetails && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Additional Details</h3>
                  <p className="text-base whitespace-pre-wrap">{selectedRequest.additionalDetails}</p>
                </div>
              )}

              {/* Medical Documentation */}
              {selectedRequest.attachmentUrl && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Medical Documentation</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(selectedRequest.attachmentUrl!, '_blank')}
                    data-testid="button-view-attachment"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Document
                  </Button>
                </div>
              )}

              {/* Approver Info */}
              {selectedRequest.approver && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    {selectedRequest.status === "denied" ? "Denied By" : "Approved By"}
                  </h3>
                  <p className="text-base">
                    {`${selectedRequest.approver.firstName} ${selectedRequest.approver.lastName}`}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.approver.email}</p>
                </div>
              )}

              {/* Response Notes */}
              {selectedRequest.responseNotes && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Response Notes</h3>
                  <p className="text-base whitespace-pre-wrap">{selectedRequest.responseNotes}</p>
                </div>
              )}

              {/* Approval Actions */}
              {canApprove && selectedRequest.status === "pending" && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label htmlFor="response-notes">Response Notes (Optional for approval, required for denial)</Label>
                    <Textarea
                      id="response-notes"
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                      placeholder="Add any notes about this decision..."
                      className="mt-2"
                      data-testid="textarea-response-notes"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleDeny(selectedRequest)}
                      disabled={updateRequestMutation.isPending}
                      data-testid="button-deny-with-notes"
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Deny
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApprove(selectedRequest, false)}
                      disabled={updateRequestMutation.isPending}
                      data-testid="button-approve-without-pay"
                    >
                      Approve Without Pay
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedRequest, true)}
                      disabled={updateRequestMutation.isPending}
                      data-testid="button-approve-with-pay"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve With Pay
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
