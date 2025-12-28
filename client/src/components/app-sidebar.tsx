import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Eye,
  History,
  MessageSquare,
  Settings,
  Calendar,
  CheckSquare,
  AlertCircle,
  ShieldAlert,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import { useQuery } from "@tanstack/react-query";
import type { SchoolMembership } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Observe",
    url: "/observe",
    icon: Eye,
  },
  {
    title: "View Observations",
    url: "/history",
    icon: History,
  },
  {
    title: "Meetings",
    url: "/meetings",
    icon: MessageSquare,
  },
  {
    title: "Request Leave",
    url: "/leave-requests",
    icon: Calendar,
  },
  {
    title: "Approve Leave",
    url: "/approve-leave",
    icon: CheckSquare,
  },
  {
    title: "On-Call",
    url: "/on-call",
    icon: AlertCircle,
  },
  {
    title: "Behaviour Management",
    url: "/behaviour-management",
    icon: ShieldAlert,
  },
  {
    title: "App Management",
    url: "/management",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isCreator, isAdminOrCreator } = useAuth();
  const { currentSchool, currentSchoolId } = useSchool();

  // Get user's memberships to determine permissions for current school (even for Creators)
  const { data: userMemberships = [] } = useQuery<Array<SchoolMembership & { school?: any }>>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user,
  });

  // Find membership for current school
  const currentMembership = userMemberships.find(m => m.schoolId === currentSchoolId);

  const isAdmin = isCreator || currentMembership?.role === "Admin";
  const isLeaderOrAdmin = isCreator || currentMembership?.role === "Leader" || currentMembership?.role === "Admin";

  const userName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.email || "User";

  const userInitials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?";

  // Filter menu items based on user permissions and enabled features
  const visibleMenuItems = menuItems.filter(item => {
    // App Management requires Admin or Creator role
    if (item.title === "App Management") {
      return isAdminOrCreator;
    }

    // Check feature flags for specific menu items
    // When currentSchool is null/loading, hide feature-gated items
    if (!currentSchool) {
      // Hide feature-specific items when loading
      if (item.title === "Observe" || item.title === "View Observations" || item.title === "Meetings" || item.title === "Request Leave" || item.title === "Approve Leave" || item.title === "On-Call" || item.title === "Behaviour Management") {
        return false;
      }
      return true;
    }

    const enabledFeatures = currentSchool.enabled_features || [];

    // Observe and View Observations require "observations" feature
    if (item.title === "Observe" || item.title === "View Observations") {
      return enabledFeatures.includes("observations");
    }

    // Meetings requires "meetings" feature
    if (item.title === "Meetings") {
      return enabledFeatures.includes("meetings");
    }

    // Request Leave requires "absence_management" feature
    if (item.title === "Request Leave") {
      return enabledFeatures.includes("absence_management");
    }

    // Approve Leave requires "absence_management" feature and canApproveLeaveRequests permission (even for Creators)
    if (item.title === "Approve Leave") {
      return enabledFeatures.includes("absence_management") && (currentMembership?.canApproveLeaveRequests || false);
    }

    // On-Call requires "behaviour" feature to be enabled
    if (item.title === "On-Call") {
      return enabledFeatures.includes("behaviour");
    }

    // Behaviour Management requires "behaviour" feature and canManageBehaviour permission (even for Creators)
    if (item.title === "Behaviour Management") {
      return enabledFeatures.includes("behaviour") && (currentMembership?.canManageBehaviour || false);
    }

    // All other items are visible
    return true;
  });

  return (
    <Sidebar collapsible="none">
      <SidebarContent className="py-4 px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-5">
              {visibleMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link 
                          href={item.url} 
                          data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                          className={cn(
                            "flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                            "bg-white/60 dark:bg-black/40 backdrop-blur-sm",
                            "border border-white/50 dark:border-white/20",
                            "shadow-sm hover:shadow-md",
                            "hover:bg-white/80 dark:hover:bg-black/60",
                            isActive && "bg-foreground/90 dark:bg-foreground/80 text-background shadow-md",
                            !isActive && "text-foreground/70 dark:text-foreground/60 hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-5 w-5" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={12}>
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 pb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              href="/profile" 
              data-testid="link-profile"
              className={cn(
                "flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                "bg-white/60 dark:bg-black/40 backdrop-blur-sm",
                "border border-white/50 dark:border-white/20",
                "shadow-sm hover:shadow-md",
                "hover:bg-white/80 dark:hover:bg-black/60",
                location === "/profile" && "bg-foreground/90 dark:bg-foreground/80 text-background shadow-md",
                location !== "/profile" && "text-foreground/70 dark:text-foreground/60 hover:text-foreground"
              )}
            >
              <User className="h-5 w-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {userName}
          </TooltipContent>
        </Tooltip>
      </SidebarFooter>
    </Sidebar>
  );
}
