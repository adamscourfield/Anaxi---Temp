import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import type { LeaveRequest, SchoolMembership, User, School } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, DollarSign, FileText, ExternalLink, Eye, Search } from "lucide-react";
import { format } from "date-fns";

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

type StatusFilter = "all" | "pending" | "approved_with_pay" | "approved_without_pay" | "denied";

interface ApprovalAction {
  requestId: string;
  status: "approved_with_pay" | "approved_without_pay" | "denied";
}

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

export default function ApproveLeave() {
  const { toast } = useToast();
  const { user, isCreator } = useAuth();
  const { currentSchoolId } = useSchool();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EnrichedLeaveRequest | null>(null);
  const [currentAction, setCurrentAction] = useState<ApprovalAction | null>(null);
  const [responseNotes, setResponseNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch user's memberships to find schools where they can approve leave requests
  const { data: leaderMemberships = [] } = useQuery<Array<SchoolMembership & { school?: School }>>({
    queryKey: ["/api/my-approver-memberships"],
    enabled: !!user && !isCreator,
    queryFn: async () => {
      const response = await fetch("/api/my-memberships");
      if (!response.ok) throw new Error("Failed to fetch memberships");
      const memberships = await response.json();
      return memberships.filter((m: any) => m.canApproveLeaveRequests === true);
    },
  });

  // Fetch leave requests for current school
  const { data: leaveRequests = [], isLoading } = useQuery<EnrichedLeaveRequest[]>({
    queryKey: ["/api/leave-requests", currentSchoolId],
    enabled: !!currentSchoolId,
  });

  // Get current user's membership in current school from already-fetched memberships
  const currentMembership = leaderMemberships.find(m => m.schoolId === currentSchoolId);

  // Approve/deny mutation
  const approveMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; responseNotes: string; approvedBy?: string }) => {
      return apiRequest("PATCH", `/api/leave-requests/${data.id}`, {
        status: data.status,
        responseNotes: data.responseNotes,
        approvedBy: data.approvedBy,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests", currentSchoolId] });
      toast({
        title: "Success",
        description: "Leave request updated successfully",
      });
      setApprovalDialogOpen(false);
      setCurrentAction(null);
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

  const handleApprovalAction = (request: EnrichedLeaveRequest, status: "approved_with_pay" | "approved_without_pay" | "denied") => {
    setSelectedRequest(request);
    setCurrentAction({ requestId: request.id, status });
    setApprovalDialogOpen(true);
  };

  const confirmApproval = () => {
    if (!currentAction) return;
    
    // For denial, require response notes
    if (currentAction.status === "denied" && !responseNotes.trim()) {
      toast({
        title: "Error",
        description: "Response notes are required when denying a request",
        variant: "destructive",
      });
      return;
    }
    
    // For creators, use a special membership ID (or handle differently on backend)
    // For regular users with approval permission, use their membership ID
    if (!currentMembership && !isCreator) {
      toast({
        title: "Error",
        description: "Unable to determine approval authority",
        variant: "destructive",
      });
      return;
    }
    
    const payload: any = {
      status: currentAction.status,
      responseNotes,
    };
    
    // Only include approvedBy if we have a membership (regular users)
    // Creators will have approvedBy set by the backend
    if (currentMembership) {
      payload.approvedBy = currentMembership.id;
    }
    
    approveMutation.mutate({
      id: currentAction.requestId,
      ...payload,
    });
  };

  const getActionLabel = (status: string) => {
    switch (status) {
      case "approved_with_pay":
        return "Approve with Pay";
      case "approved_without_pay":
        return "Approve without Pay";
      case "denied":
        return "Deny Request";
      default:
        return "";
    }
  };

  // Filter and search requests
  const filteredRequests = leaveRequests.filter(request => {
    // Filter by status
    const statusMatch = statusFilter === "all" || request.status === statusFilter;
    
    // Filter by search query (search in teacher name)
    const teacherName = request.requester 
      ? `${request.requester.firstName} ${request.requester.lastName}`.toLowerCase()
      : "";
    const searchMatch = !searchQuery || teacherName.includes(searchQuery.toLowerCase());
    
    return statusMatch && searchMatch;
  });

  // Check authorization - user must have approval permission in current school or be creator
  const isAuthorized = isCreator || (currentMembership && currentMembership.canApproveLeaveRequests);

  if (!currentSchoolId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground py-12">
          Please select a school from the dropdown above to view leave requests.
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground py-12">
          Access denied. You do not have permission to approve leave requests for this school.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Leave Request Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve leave requests for your school
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList data-testid="tabs-status-filter">
              <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
              <TabsTrigger value="approved_with_pay" data-testid="tab-approved-with-pay">Approved (with pay)</TabsTrigger>
              <TabsTrigger value="approved_without_pay" data-testid="tab-approved-without-pay">Approved (without pay)</TabsTrigger>
              <TabsTrigger value="denied" data-testid="tab-denied">Denied</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
          Loading leave requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
          {searchQuery ? "No leave requests found matching your search." : "No leave requests found for the selected filter."}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead data-testid="header-teacher">Teacher</TableHead>
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
                  : "Unknown Teacher";

                return (
                  <TableRow key={request.id} data-testid={`row-leave-request-${request.id}`}>
                    <TableCell data-testid={`cell-teacher-${request.id}`} className="font-medium">
                      {teacherName}
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
                      <div className="flex items-center justify-end gap-2">
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
                        {request.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprovalAction(request, "approved_with_pay")}
                              data-testid={`button-approve-with-pay-${request.id}`}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              With Pay
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleApprovalAction(request, "approved_without_pay")}
                              data-testid={`button-approve-without-pay-${request.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Without Pay
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApprovalAction(request, "denied")}
                              data-testid={`button-deny-${request.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
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
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-details">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Teacher</Label>
                  <p className="text-sm font-medium" data-testid="text-details-teacher">
                    {selectedRequest.requester 
                      ? `${selectedRequest.requester.firstName} ${selectedRequest.requester.lastName}`.trim() || selectedRequest.requester.email
                      : "Unknown Teacher"}
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent data-testid="dialog-approval">
          <DialogHeader>
            <DialogTitle>
              {currentAction ? getActionLabel(currentAction.status) : "Confirm Action"}
            </DialogTitle>
            <DialogDescription>
              {currentAction?.status === "denied" 
                ? "Please provide notes explaining your decision. This is required when denying a request."
                : "Please provide notes for your decision. This will be visible to the teacher."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="response-notes">
                Response Notes {currentAction?.status === "denied" && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="response-notes"
                placeholder="Enter your notes here..."
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
                setCurrentAction(null);
                setResponseNotes("");
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApproval}
              disabled={approveMutation.isPending}
              data-testid="button-confirm"
            >
              {approveMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
