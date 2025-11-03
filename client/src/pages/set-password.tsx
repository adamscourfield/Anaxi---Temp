import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

export default function SetPassword() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setToken(urlParams.get("token"));
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
  });

  // Verify token validity
  const { data: tokenData, isLoading: isVerifying } = useQuery({
    queryKey: ['/api/auth/verify-setup-token', token],
    enabled: !!token,
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/auth/verify-setup-token", { token });
      return await response.json();
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async (data: SetPasswordFormData) => {
      if (!token) {
        throw new Error("Invalid setup token");
      }
      const response = await apiRequest("POST", "/api/auth/setup-password", {
        token,
        password: data.password,
      });
      return await response.json();
    },
    onSuccess: () => {
      // Clear authentication state to ensure clean login
      queryClient.setQueryData(['/api/auth/user'], null);
      queryClient.clear();
      
      toast({
        title: "Password set successfully",
        description: "You can now log in with your new password.",
      });
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to set password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: SetPasswordFormData) => {
    await setPasswordMutation.mutateAsync(data);
  };

  // Loading state while verifying token
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or expired token
  if (!token || !tokenData?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Invalid Setup Link</CardTitle>
            <CardDescription>
              This password setup link is invalid or has expired. Please contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Anaxi!</CardTitle>
          <CardDescription>
            {tokenData.name && `Hi ${tokenData.name}, `}Set your password to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={tokenData.email}
                disabled
                className="bg-muted"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password (min 8 characters)"
                  className="pl-10"
                  {...register("password")}
                  disabled={setPasswordMutation.isPending}
                  data-testid="input-password"
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  className="pl-10"
                  {...register("confirmPassword")}
                  disabled={setPasswordMutation.isPending}
                  data-testid="input-confirm-password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={setPasswordMutation.isPending}
              data-testid="button-set-password"
            >
              {setPasswordMutation.isPending ? (
                "Setting password..."
              ) : (
                <>
                  Set password & Continue
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
