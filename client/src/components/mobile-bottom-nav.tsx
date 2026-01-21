import { useLocation, Link } from "wouter";
import { ClipboardCheck, CalendarOff, Phone, Eye, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    icon: ClipboardCheck,
    label: "Create",
    href: "/observe",
    testId: "nav-create-observation",
  },
  {
    icon: CalendarOff,
    label: "Leave",
    href: "/leave-requests",
    testId: "nav-request-leave",
  },
  {
    icon: Phone,
    label: "On Call",
    href: "/on-call",
    testId: "nav-on-call",
  },
  {
    icon: Eye,
    label: "View",
    href: "/history",
    testId: "nav-view-observations",
  },
  {
    icon: User,
    label: "Profile",
    href: "/profile",
    testId: "nav-profile",
  },
];

export function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-gray-500 dark:text-gray-400 hover:text-primary"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
