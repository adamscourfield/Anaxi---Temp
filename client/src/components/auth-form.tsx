import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { toast } = useToast();

  const isLogin = mode === "login";
  const schema = isLogin ? loginSchema : registerSchema;

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(schema),
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      return await apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      return await apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Account created!",
        description: "Your account has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: any) => {
    if (isLogin) {
      await loginMutation.mutateAsync(data);
    } else {
      await registerMutation.mutateAsync(data);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    reset();
  };

  const isPending = loginMutation.isPending || registerMutation.isPending;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle data-testid="text-auth-title">
          {isLogin ? "Log In" : "Create Account"}
        </CardTitle>
        <CardDescription>
          {isLogin 
            ? "Enter your credentials to access your account" 
            : "Fill in your details to create a new account"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  type="text"
                  {...register("first_name")}
                  disabled={isPending}
                  data-testid="input-first-name"
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name.message as string}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  type="text"
                  {...register("last_name")}
                  disabled={isPending}
                  data-testid="input-last-name"
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name.message as string}</p>
                )}
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              disabled={isPending}
              data-testid="input-email"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message as string}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              disabled={isPending}
              data-testid="input-password"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message as string}</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
            data-testid="button-submit"
          >
            {isPending ? "Please wait..." : isLogin ? "Log In" : "Create Account"}
          </Button>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={toggleMode}
              disabled={isPending}
              data-testid="button-toggle-mode"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Log in"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
