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
  DialogFooter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Eye, Check, X, FileText, ExternalLink, Search } from "lucide-react";
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
type StatusFilter = "all" | "pending" | "approved_with_pay" | "approved_without_pay" | "denied";

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
  const { user, isCreator } = useAuth();
  const { currentSchoolId } = useSchool();
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EnrichedLeaveRequest | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalMode, setApprovalMode] = useState<"approve" | "deny">("approve");
  const [approvalPayType, setApprovalPayType] = useState<"approved_with_pay" | "approved_without_pay">("approved_with_pay");
  const [responseNotes, setResponseNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: !!user,
  });

  const { data: memberships = [] } = useQuery<SchoolMembership[]>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user,
  });

  const currentMembership = memberships.find(m => m.schoolId === currentSchoolId);
  const canApprove = isCreator || currentMembership?.canApproveAllLeave || (currentMembership?.leaveApprovalTargets && currentMembership.leaveApprovalTargets.length > 0) || false;

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
    mutationFn: async ({ id, status, notes, approvedBy }: { id: string; status: string; notes: string; approvedBy?: string }) => {
      const response = await apiRequest("PATCH", `/api/leave-requests/${id}`, {
        status,
        responseNotes: notes || null,
        ...(approvedBy && { approvedBy }),
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
      setDetailsDialogOpen(false);
      setApprovalDialogOpen(false);
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

  const openApproveDialog = (request: EnrichedLeaveRequest) => {
    setSelectedRequest(request);
    setApprovalMode("approve");
    setApprovalPayType("approved_with_pay");
    setResponseNotes("");
    setApprovalDialogOpen(true);
  };

  const openDenyDialog = (request: EnrichedLeaveRequest) => {
    setSelectedRequest(request);
    setApprovalMode("deny");
    setResponseNotes("");
    setApprovalDialogOpen(true);
  };

  const confirmApproval = () => {
    if (!selectedRequest) return;

    if (approvalMode === "deny" && !responseNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for denying this request",
        variant: "destructive",
      });
      return;
    }

    const status = approvalMode === "deny" ? "denied" : approvalPayType;

    updateRequestMutation.mutate({
      id: selectedRequest.id,
      status,
      notes: responseNotes,
      approvedBy: currentMembership?.id,
    });
  };

  const requiresAdditionalDetails = watchedType === "medical" ||
    watchedType === "professional_development" ||
    watchedType === "interview" ||
    watchedType === "other";

  const requiresAttachment = watchedType === "medical";

  const filteredRequests = leaveRequests.filter(request => {
    const statusMatch = statusFilter === "all" || request.status === statusFilter;
    const teacherName = request.requester
      ? `${request.requester.firstName} ${request.requester.lastName}`.toLowerCase()
      : "";
    const searchMatch = !searchQuery || teacherName.includes(searchQuery.toLowerCase());
    return statusMatch && searchMatch;
  });

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Leave of Absence</h1>
            <p className="text-muted-foreground mt-1">
              {canApprove ? "Manage and review leave requests" : "View and submit your leave requests"}
            </p>
          </div>
          {!showNewRequestForm && (
            <Button onClick={() => setShowNewRequestForm(true)} data-testid="button-new-leave-request">
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          )}
        </div>

        {showNewRequestForm && (
          <Card data-testid="card-leave-request-form">
            <CardHeader>
              <CardTitle>Submit Leave Request</CardTitle>
              <CardDescription>Fill in the details for your leave request</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList data-testid="tabs-status-filter">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
              <TabsTrigger value="approved_with_pay" data-testid="tab-approved-with-pay">With Pay</TabsTrigger>
              <TabsTrigger value="approved_without_pay" data-testid="tab-approved-without-pay">Without Pay</TabsTrigger>
              <TabsTrigger value="denied" data-testid="tab-denied">Denied</TabsTrigger>
            </TabsList>
          </Tabs>

          {canApprove && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by staff member..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-staff"
              />
            </div>
          )}
        </div>

        {requestsLoading ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
            Loading leave requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
            {searchQuery ? "No leave requests found matching your search." : statusFilter !== "all" ? "No leave requests found for this status." : "No leave requests found."}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="header-teacher">Staff Member</TableHead>
                  <TableHead data-testid="header-type">Type</TableHead>
                  <TableHead data-testid="header-dates">Dates</TableHead>
                  <TableHead data-testid="header-status">Status</TableHead>
                  <TableHead data-testid="header-submitted">Submitted</TableHead>
                  <TableHead data-testid="header-actions" className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => {
                  const teacherName = request.requester
                    ? `${request.requester.firstName} ${request.requester.lastName}`.trim() || request.requester.email
                    : "Unknown";
                  const isOwnRequest = currentMembership && request.membershipId === currentMembership.id;

                  return (
                    <TableRow key={request.id} data-testid={`row-leave-request-${request.id}`}>
                      <TableCell data-testid={`cell-teacher-${request.id}`} className="font-medium">
                        {teacherName}
                        {isOwnRequest && <Badge variant="secondary" className="ml-2">You</Badge>}
                      </TableCell>
                      <TableCell data-testid={`cell-type-${request.id}`}>
                        <Badge variant="outline">
                          {leaveTypeLabels[request.type as keyof typeof leaveTypeLabels] || request.type}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-dates-${request.id}`} className="text-sm">
                        {format(new Date(request.startDate), "MMM d")} - {format(new Date(request.endDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell data-testid={`cell-status-${request.id}`}>
                        <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                          {statusLabels[request.status as keyof typeof statusLabels]}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-submitted-${request.id}`} className="text-sm text-muted-foreground">
                        {request.createdAt ? format(new Date(request.createdAt), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell data-testid={`cell-actions-${request.id}`} className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setDetailsDialogOpen(true);
                                }}
                                data-testid={`button-view-${request.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>
                          {canApprove && request.status === "pending" && !isOwnRequest && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openApproveDialog(request)}
                                data-testid={`button-approve-${request.id}`}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => openDenyDialog(request)}
                                data-testid={`button-deny-${request.id}`}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Deny
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-details">
            <DialogHeader>
              <DialogTitle>Leave Request Details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Staff Member</Label>
                    <p className="text-sm font-medium" data-testid="text-details-teacher">
                      {selectedRequest.requester
                        ? `${selectedRequest.requester.firstName} ${selectedRequest.requester.lastName}`.trim() || selectedRequest.requester.email
                        : "Unknown"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Leave Type</Label>
                    <p className="text-sm" data-testid="text-details-type">
                      {leaveTypeLabels[selectedRequest.type as keyof typeof leaveTypeLabels] || selectedRequest.type}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Start Date</Label>
                    <p className="text-sm" data-testid="text-details-start-date">
                      {format(new Date(selectedRequest.startDate), "PPP")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">End Date</Label>
                    <p className="text-sm" data-testid="text-details-end-date">
                      {format(new Date(selectedRequest.endDate), "PPP")}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge className={statusColors[selectedRequest.status as keyof typeof statusColors]} data-testid="badge-details-status">
                      {statusLabels[selectedRequest.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Cover Arrangements</Label>
                  <p className="text-sm" data-testid="text-details-cover">
                    {selectedRequest.coverDetails}
                  </p>
                </div>

                {selectedRequest.additionalDetails && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Additional Details</Label>
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-details-additional">
                      {selectedRequest.additionalDetails}
                    </p>
                  </div>
                )}

                {selectedRequest.attachmentUrl && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Medical Documentation</Label>
                    <a
                      href={selectedRequest.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                      data-testid="link-details-attachment"
                    >
                      <FileText className="h-4 w-4" />
                      View document
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {selectedRequest.responseNotes && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Response Notes</Label>
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-details-response-notes">
                      {selectedRequest.responseNotes}
                    </p>
                    {selectedRequest.approver && (
                      <p className="text-xs text-muted-foreground mt-1" data-testid="text-details-approver">
                        By {selectedRequest.approver.firstName} {selectedRequest.approver.lastName}
                      </p>
                    )}
                  </div>
                )}

                {canApprove && selectedRequest.status === "pending" && (!currentMembership || selectedRequest.membershipId !== currentMembership.id) && (
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      onClick={() => { setDetailsDialogOpen(false); openDenyDialog(selectedRequest); }}
                      data-testid="button-details-deny"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Deny
                    </Button>
                    <Button
                      onClick={() => { setDetailsDialogOpen(false); openApproveDialog(selectedRequest); }}
                      data-testid="button-details-approve"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Approval / Deny Dialog */}
        <Dialog open={approvalDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setApprovalDialogOpen(false);
            setResponseNotes("");
          }
        }}>
          <DialogContent data-testid="dialog-approval">
            <DialogHeader>
              <DialogTitle>
                {approvalMode === "approve" ? "Approve Leave Request" : "Deny Leave Request"}
              </DialogTitle>
              <DialogDescription>
                {approvalMode === "approve"
                  ? "Choose the approval type and add any comments for the staff member."
                  : "Please provide a reason for denying this request. This is required."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {approvalMode === "approve" && (
                <div className="space-y-2">
                  <Label>Approval Type</Label>
                  <Select
                    value={approvalPayType}
                    onValueChange={(v) => setApprovalPayType(v as "approved_with_pay" | "approved_without_pay")}
                  >
                    <SelectTrigger data-testid="select-approval-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved_with_pay">Approved with Pay</SelectItem>
                      <SelectItem value="approved_without_pay">Approved without Pay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="response-notes">
                  Comments {approvalMode === "deny" && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  id="response-notes"
                  placeholder={approvalMode === "deny" ? "Reason for denial..." : "Any notes for the staff member (optional)..."}
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  rows={4}
                  data-testid="textarea-response-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setApprovalDialogOpen(false);
                  setResponseNotes("");
                }}
                data-testid="button-cancel-approval"
              >
                Cancel
              </Button>
              {approvalMode === "deny" ? (
                <Button
                  variant="destructive"
                  onClick={confirmApproval}
                  disabled={updateRequestMutation.isPending}
                  data-testid="button-confirm-deny"
                >
                  {updateRequestMutation.isPending ? "Processing..." : "Deny Request"}
                </Button>
              ) : (
                <Button
                  onClick={confirmApproval}
                  disabled={updateRequestMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  {updateRequestMutation.isPending ? "Processing..." : "Approve"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
