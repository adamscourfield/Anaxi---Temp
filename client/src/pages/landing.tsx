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
    <div className="relative min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Decorative color swirls */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200/40 dark:bg-blue-800/20 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-sky-200/50 dark:bg-sky-800/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-200/40 dark:bg-indigo-800/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-64 h-64 bg-blue-100/60 dark:bg-blue-900/20 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md px-4 z-10">
        {/* Logo and Name */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <img src={anaxiLogo} alt="Anaxi" className="h-20 w-20 dark:invert dark:brightness-200" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Anaxi</h1>
          <p className="text-muted-foreground">Future Education</p>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-lg p-8">
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
