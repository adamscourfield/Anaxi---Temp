import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AuthForm } from "@/components/auth-form";
import { useAuth } from "@/hooks/use-auth";
import { Eye, Users, MessageSquare, TrendingUp } from "lucide-react";

export default function Landing() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Anaxi</h1>
          <Button onClick={() => setShowAuthDialog(true)} data-testid="button-login">
            Log In
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-6">
              Professional Teacher Observation Platform
            </h2>
            <p className="text-xl text-muted-foreground mb-12">
              Conduct peer observations, provide structured feedback, and track professional development with Anaxi.
            </p>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="p-6 border rounded-lg hover-elevate">
                <Eye className="w-12 h-12 mb-4 mx-auto text-primary" />
                <h3 className="text-xl font-semibold mb-2">Peer Observations</h3>
                <p className="text-muted-foreground">
                  Use custom rubrics to conduct meaningful classroom observations
                </p>
              </div>

              <div className="p-6 border rounded-lg hover-elevate">
                <Users className="w-12 h-12 mb-4 mx-auto text-primary" />
                <h3 className="text-xl font-semibold mb-2">Teacher Groups</h3>
                <p className="text-muted-foreground">
                  Organize teachers by department or specialty for targeted support
                </p>
              </div>

              <div className="p-6 border rounded-lg hover-elevate">
                <MessageSquare className="w-12 h-12 mb-4 mx-auto text-primary" />
                <h3 className="text-xl font-semibold mb-2">Structured Feedback</h3>
                <p className="text-muted-foreground">
                  Provide habit-based feedback that drives professional growth
                </p>
              </div>

              <div className="p-6 border rounded-lg hover-elevate">
                <TrendingUp className="w-12 h-12 mb-4 mx-auto text-primary" />
                <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
                <p className="text-muted-foreground">
                  Monitor development trends and celebrate teaching excellence
                </p>
              </div>
            </div>

            <Button size="lg" onClick={() => setShowAuthDialog(true)} data-testid="button-login-cta">
              Get Started
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md" aria-describedby="auth-dialog-description">
          <span id="auth-dialog-description" className="sr-only">
            Login to access the Anaxi platform
          </span>
          <AuthForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}
