import { useLocation, Link } from "wouter";
import { ClipboardCheck, CalendarOff, Phone, Eye, User, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import { useQuery } from "@tanstack/react-query";
import type { SchoolMembership } from "@shared/schema";

interface NavItem {
  icon: typeof ClipboardCheck;
  label: string;
  href: string;
  testId: string;
  featureFlag?: string;
}

const allNavItems: NavItem[] = [
  {
    icon: ClipboardCheck,
    label: "Create",
    href: "/observe",
    testId: "nav-create-observation",
    featureFlag: "observations",
  },
  {
    icon: CalendarOff,
    label: "Leave",
    href: "/leave-requests",
    testId: "nav-request-leave",
    featureFlag: "absence_management",
  },
  {
    icon: Phone,
    label: "On Call",
    href: "/on-call",
    testId: "nav-on-call",
    featureFlag: "behaviour",
  },
  {
    icon: Eye,
    label: "View",
    href: "/history",
    testId: "nav-view-observations",
    featureFlag: "observations",
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
  const { user } = useAuth();
  const { currentSchool } = useSchool();

  const { data: userMemberships = [] } = useQuery<Array<SchoolMembership & { school?: any }>>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user,
  });

  const enabledFeatures = currentSchool?.enabled_features || [];

  const visibleNavItems = allNavItems.filter(item => {
    if (!item.featureFlag) return true;
    if (!currentSchool) return false;
    return enabledFeatures.includes(item.featureFlag);
  });

  const displayItems = visibleNavItems.length < 3 
    ? [{ icon: LayoutDashboard, label: "Home", href: "/", testId: "nav-dashboard" }, ...visibleNavItems]
    : visibleNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg">
      <div className="flex items-center justify-around h-16 px-2">
        {displayItems.map((item) => {
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
                  : "text-gray-500 dark:text-gray-400"
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
