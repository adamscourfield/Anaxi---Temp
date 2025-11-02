import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import type { LeaveRequest, SchoolMembership, User, School } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, DollarSign, FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface LeaveRequestWithDetails extends LeaveRequest {
  membership?: SchoolMembership & { user?: User };
  approver?: SchoolMembership & { user?: User };
}

type StatusFilter = "all" | "pending" | "approved_with_pay" | "approved_without_pay" | "denied";

interface ApprovalAction {
  requestId: string;
  status: "approved_with_pay" | "approved_without_pay" | "denied";
}

export default function ApproveLeave() {
  const { toast } = useToast();
  const { user, isCreator } = useAuth();
  const { currentSchoolId } = useSchool();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<ApprovalAction | null>(null);
  const [responseNotes, setResponseNotes] = useState("");

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
  const { data: leaveRequests = [], isLoading } = useQuery<LeaveRequestWithDetails[]>({
    queryKey: ["/api/leave-requests", currentSchoolId],
    enabled: !!currentSchoolId,
    queryFn: async () => {
      const response = await fetch(`/api/leave-requests?schoolId=${currentSchoolId}`);
      if (!response.ok) throw new Error("Failed to fetch leave requests");
      return response.json();
    },
  });

  // Get current user's membership in current school from already-fetched memberships
  const currentMembership = leaderMemberships.find(m => m.schoolId === currentSchoolId);

  // Approve/deny mutation
  const approveMutation = useMutation({
    mutationFn: async (data: { id: string; status: string; responseNotes: string; approvedBy: string }) => {
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

  const handleApprovalAction = (requestId: string, status: "approved_with_pay" | "approved_without_pay" | "denied") => {
    setCurrentAction({ requestId, status });
    setApprovalDialogOpen(true);
  };

  const confirmApproval = () => {
    if (!currentAction) return;
    
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

  // Filter requests by status
  const filteredRequests = leaveRequests.filter(request => {
    if (statusFilter === "all") return true;
    return request.status === statusFilter;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "pending":
        return "default";
      case "approved_with_pay":
        return "default";
      case "approved_without_pay":
        return "secondary";
      case "denied":
        return "destructive";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "approved_with_pay":
        return "Approved (with pay)";
      case "approved_without_pay":
        return "Approved (without pay)";
      case "denied":
        return "Denied";
      default:
        return status;
    }
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
    <div className="p-6 space-y-8">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Leave Request Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve leave requests for your school
          </p>
        </div>

        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList data-testid="tabs-status-filter">
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
            <TabsTrigger value="approved_with_pay" data-testid="tab-approved-with-pay">Approved (with pay)</TabsTrigger>
            <TabsTrigger value="approved_without_pay" data-testid="tab-approved-without-pay">Approved (without pay)</TabsTrigger>
            <TabsTrigger value="denied" data-testid="tab-denied">Denied</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-loading">
          Loading leave requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
          No leave requests found for the selected filter.
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => {
            const teacherName = request.membership?.user
              ? `${request.membership.user.first_name || ""} ${request.membership.user.last_name || ""}`.trim() || request.membership.user.email
              : "Unknown Teacher";

            const approverName = request.approver?.user
              ? `${request.approver.user.first_name || ""} ${request.approver.user.last_name || ""}`.trim() || request.approver.user.email
              : null;

            return (
              <Card key={request.id} data-testid={`card-leave-request-${request.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <span data-testid={`text-teacher-name-${request.id}`}>{teacherName}</span>
                        <Badge variant={getStatusBadgeVariant(request.status)} data-testid={`badge-status-${request.id}`}>
                          {getStatusLabel(request.status)}
                        </Badge>
                      </CardTitle>
                    </div>
                    <Badge variant="outline" data-testid={`badge-type-${request.id}`}>
                      {request.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Date Range</Label>
                      <p className="text-sm" data-testid={`text-dates-${request.id}`}>
                        {format(new Date(request.startDate), "PPP")} - {format(new Date(request.endDate), "PPP")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Cover Arrangements</Label>
                      <p className="text-sm" data-testid={`text-cover-${request.id}`}>
                        {request.coverDetails}
                      </p>
                    </div>
                  </div>

                  {request.additionalDetails && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Additional Details</Label>
                      <p className="text-sm" data-testid={`text-additional-${request.id}`}>
                        {request.additionalDetails}
                      </p>
                    </div>
                  )}

                  {request.attachmentUrl && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Attachment</Label>
                      <a
                        href={request.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                        data-testid={`link-attachment-${request.id}`}
                      >
                        <FileText className="h-4 w-4" />
                        View medical documentation
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {request.responseNotes && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Response Notes</Label>
                      <p className="text-sm" data-testid={`text-response-notes-${request.id}`}>
                        {request.responseNotes}
                      </p>
                      {approverName && (
                        <p className="text-xs text-muted-foreground mt-1" data-testid={`text-approver-${request.id}`}>
                          By {approverName}
                        </p>
                      )}
                    </div>
                  )}

                  {request.status === "pending" && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApprovalAction(request.id, "approved_with_pay")}
                        data-testid={`button-approve-with-pay-${request.id}`}
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Approve with Pay
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleApprovalAction(request.id, "approved_without_pay")}
                        data-testid={`button-approve-without-pay-${request.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve without Pay
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleApprovalAction(request.id, "denied")}
                        data-testid={`button-deny-${request.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Deny
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent data-testid="dialog-approval">
          <DialogHeader>
            <DialogTitle>
              {currentAction ? getActionLabel(currentAction.status) : "Confirm Action"}
            </DialogTitle>
            <DialogDescription>
              Please provide notes for your decision. This will be visible to the teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="response-notes">Response Notes</Label>
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
