import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AuthForm } from "@/components/auth-form";
import anaxiLogo from "@assets/7_1760131494886.png";

export default function Landing() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (user) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="w-full max-w-md px-4">
        {/* Logo and Name */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img src={anaxiLogo} alt="Anaxi" className="h-20 w-20" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Anaxi</h1>
          <p className="text-muted-foreground">Future Education</p>
        </div>

        {/* Login Form */}
        <div className="bg-card border rounded-lg p-8 shadow-lg">
          <AuthForm />
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Anaxi. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
