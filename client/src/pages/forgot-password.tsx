import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return await response.json();
    },
    onSuccess: (_, variables) => {
      setEmailSent(true);
      setSentEmail(variables.email);
      toast({
        title: "Reset link sent",
        description: "Check your email for password reset instructions.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send reset link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    await forgotPasswordMutation.mutateAsync(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            {emailSent
              ? "Check your email for further instructions"
              : "Enter your email address and we'll send you a password reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailSent ? (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  If an account exists with <span className="font-medium text-foreground">{sentEmail}</span>, you will receive a password reset link.
                </p>
                <p className="text-sm text-muted-foreground pt-2">
                  The link will expire in 1 hour.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setEmailSent(false);
                  setSentEmail("");
                }}
                className="mt-6"
                data-testid="button-try-another-email"
              >
                Try another email
              </Button>
              <div className="pt-4">
                <a 
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to login
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="teacher@school.edu"
                    className="pl-10"
                    {...register("email")}
                    disabled={forgotPasswordMutation.isPending}
                    data-testid="input-email"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={forgotPasswordMutation.isPending}
                data-testid="button-send-reset-link"
              >
                {forgotPasswordMutation.isPending ? (
                  "Sending..."
                ) : (
                  <>
                    Send reset link
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>

              <div className="text-center pt-2">
                <a 
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center"
                  data-testid="link-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to login
                </a>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
