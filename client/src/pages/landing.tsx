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
      {/* Decorative pale blue and pink waved gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[400px] bg-blue-100/50 dark:bg-blue-900/20 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-[350px] h-[300px] bg-pink-100/40 dark:bg-pink-900/15 rounded-[60%_40%_30%_70%/60%_30%_70%_40%] blur-3xl" />
        <div className="absolute bottom-1/3 right-1/5 w-[400px] h-[350px] bg-blue-50/60 dark:bg-blue-800/15 rounded-[30%_70%_40%_60%/50%_60%_40%_50%] blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 w-[300px] h-[250px] bg-pink-50/50 dark:bg-pink-800/10 rounded-[50%_50%_60%_40%/40%_60%_50%_50%] blur-3xl" />
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
