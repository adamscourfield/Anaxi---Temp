import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Decorative color swirls */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200/40 dark:bg-blue-800/20 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-sky-200/50 dark:bg-sky-800/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-200/40 dark:bg-indigo-800/15 rounded-full blur-3xl" />
      </div>
      <Card className="relative w-full max-w-md mx-4 z-10">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-foreground">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
