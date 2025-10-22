import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";

const magicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

export function AuthForm() {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
  });

  const magicLinkMutation = useMutation({
    mutationFn: async (data: MagicLinkFormData) => {
      const response = await apiRequest("POST", "/api/auth/magic-link", data);
      return await response.json();
    },
    onSuccess: (_, variables) => {
      setEmailSent(true);
      setSentEmail(variables.email);
      toast({
        title: "Magic link sent!",
        description: "Check your email to log in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send magic link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: MagicLinkFormData) => {
    await magicLinkMutation.mutateAsync(data);
  };

  if (emailSent) {
    return (
      <div className="space-y-4 text-center py-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground">
            We've sent a magic link to <span className="font-medium text-foreground">{sentEmail}</span>
          </p>
          <p className="text-sm text-muted-foreground pt-2">
            Click the link in the email to log in. The link will expire in 15 minutes.
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
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-base">Email address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="teacher@school.edu"
            className="pl-10"
            {...register("email")}
            disabled={magicLinkMutation.isPending}
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
        disabled={magicLinkMutation.isPending}
        data-testid="button-submit"
      >
        {magicLinkMutation.isPending ? (
          "Sending..."
        ) : (
          <>
            Send magic link
            <ArrowRight className="ml-2 w-4 h-4" />
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground pt-2">
        We'll email you a secure link to log in without a password
      </p>
    </form>
  );
}
