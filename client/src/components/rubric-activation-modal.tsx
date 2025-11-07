import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSchool } from "@/hooks/use-school";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Rubric } from "@shared/schema";
import { format } from "date-fns";

export function RubricActivationModal() {
  const [open, setOpen] = useState(false);
  const { currentSchool, currentMembership } = useSchool();
  const { user } = useAuth();
  const { toast } = useToast();

  // Only show for Admins and Creators
  const canActivateRubrics = user?.global_role === "Creator" || currentMembership?.role === "Admin";

  // Fetch pending activations
  const { data: pendingRubrics = [] } = useQuery<Rubric[]>({
    queryKey: ["/api/schools", currentSchool?.id, "rubrics/pending-activation"],
    enabled: !!(currentSchool?.id && canActivateRubrics),
    refetchInterval: false, // Only fetch once per page load
  });

  // Activate rubric mutation
  const activateMutation = useMutation({
    mutationFn: async (rubricId: string) => {
      const response = await apiRequest('PATCH', `/api/rubrics/${rubricId}/activate`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchool?.id, "rubrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schools", currentSchool?.id, "rubrics/pending-activation"] });
      toast({
        title: "Rubric activated",
        description: "The rubric has been activated successfully",
      });
      setOpen(false);
      // Mark as shown for today
      if (currentSchool?.id) {
        localStorage.setItem(
          `rubric-activation-shown-${currentSchool.id}`,
          new Date().toISOString().split('T')[0]
        );
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to activate rubric",
        variant: "destructive",
      });
    },
  });

  // Check if should show modal (once per day)
  useEffect(() => {
    if (!currentSchool?.id || !canActivateRubrics || pendingRubrics.length === 0) {
      return;
    }

    const lastShown = localStorage.getItem(`rubric-activation-shown-${currentSchool.id}`);
    const today = new Date().toISOString().split('T')[0];

    // Show if never shown before, or if last shown was a different day
    if (!lastShown || lastShown !== today) {
      setOpen(true);
    }
  }, [currentSchool?.id, canActivateRubrics, pendingRubrics.length]);

  const handleRemindTomorrow = () => {
    setOpen(false);
    // Mark as shown for today
    if (currentSchool?.id) {
      localStorage.setItem(
        `rubric-activation-shown-${currentSchool.id}`,
        new Date().toISOString().split('T')[0]
      );
    }
  };

  const handleActivateNow = () => {
    if (pendingRubrics.length > 0) {
      activateMutation.mutate(pendingRubrics[0].id);
    }
  };

  if (pendingRubrics.length === 0) {
    return null;
  }

  const rubric = pendingRubrics[0];

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent data-testid="dialog-rubric-activation">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            New Academic Year Rubric Ready
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="space-y-2">
              <p>
                The rubric for <strong>{rubric.academicYear}</strong> is scheduled to activate.
              </p>
              {rubric.activationDate && (
                <p className="text-sm text-muted-foreground">
                  Scheduled activation date: {format(new Date(rubric.activationDate), "MMMM d, yyyy")}
                </p>
              )}
            </div>
            
            <div className="p-4 rounded-md bg-muted">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{rubric.name}</p>
                  <p className="text-sm text-muted-foreground">{rubric.academicYear}</p>
                </div>
                <Badge variant="secondary">Scheduled</Badge>
              </div>
            </div>

            <p className="text-sm">
              Would you like to activate this rubric now? This will archive the current active rubric.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={handleRemindTomorrow}
            data-testid="button-remind-tomorrow"
          >
            Remind Me Tomorrow
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleActivateNow}
            disabled={activateMutation.isPending}
            data-testid="button-activate-now"
          >
            {activateMutation.isPending ? "Activating..." : "Activate Now"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
