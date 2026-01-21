import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Decorative pale blue and pink waved gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[500px] h-[400px] bg-blue-100/50 dark:bg-blue-900/20 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-[350px] h-[300px] bg-pink-100/40 dark:bg-pink-900/15 rounded-[60%_40%_30%_70%/60%_30%_70%_40%] blur-3xl" />
        <div className="absolute bottom-1/3 right-1/5 w-[400px] h-[350px] bg-blue-50/60 dark:bg-blue-800/15 rounded-[30%_70%_40%_60%/50%_60%_40%_50%] blur-3xl" />
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
