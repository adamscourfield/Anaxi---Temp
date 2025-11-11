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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useSchool } from "@/hooks/use-school";
import { useQuery } from "@tanstack/react-query";
import type { SchoolMembership } from "@shared/schema";
import anaxiLogo from "@assets/7_1760131494886.png";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    color: "primary",
  },
  {
    title: "Observe",
    url: "/observe",
    icon: Eye,
    color: "info",
  },
  {
    title: "View Observations",
    url: "/history",
    icon: History,
    color: "teal",
  },
  {
    title: "Meetings",
    url: "/meetings",
    icon: MessageSquare,
    color: "info",
  },
  {
    title: "Request Leave",
    url: "/leave-requests",
    icon: Calendar,
    color: "teal",
  },
  {
    title: "Approve Leave",
    url: "/approve-leave",
    icon: CheckSquare,
    color: "info",
  },
  {
    title: "On-Call",
    url: "/on-call",
    icon: AlertCircle,
    color: "info",
  },
  {
    title: "Behaviour Management",
    url: "/behaviour-management",
    icon: ShieldAlert,
    color: "teal",
  },
  {
    title: "App Management",
    url: "/management",
    icon: Settings,
    color: "amber",
  },
];

const iconColorClasses: Record<string, string> = {
  primary: "text-sidebar-foreground",
  info: "text-sidebar-foreground",
  teal: "text-sidebar-foreground",
  amber: "text-sidebar-foreground",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isCreator, isAdminOrCreator } = useAuth();
  const { currentSchool, currentSchoolId } = useSchool();

  // Get user's memberships to determine permissions for current school
  const { data: userMemberships = [] } = useQuery<Array<SchoolMembership & { school?: any }>>({
    queryKey: ["/api/my-memberships"],
    enabled: !!user && !isCreator,
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
      if (item.title === "Meetings" || item.title === "Request Leave" || item.title === "Approve Leave" || item.title === "On-Call" || item.title === "Behaviour Management") {
        return false;
      }
      return true;
    }

    const enabledFeatures = currentSchool.enabled_features || [];

    // Meetings requires "meetings" feature
    if (item.title === "Meetings") {
      return enabledFeatures.includes("meetings");
    }

    // Request Leave requires "absence_management" feature
    if (item.title === "Request Leave") {
      return enabledFeatures.includes("absence_management");
    }

    // Approve Leave requires "absence_management" feature
    // Creators see it if feature is enabled, regular users need the permission too
    if (item.title === "Approve Leave") {
      return enabledFeatures.includes("absence_management") && (isCreator || currentMembership?.canApproveLeaveRequests || false);
    }

    // On-Call is always visible (all users can raise on-calls)
    if (item.title === "On-Call") {
      return true;
    }

    // Behaviour Management requires behaviour management permission
    if (item.title === "Behaviour Management") {
      return isCreator || currentMembership?.canManageBehaviour || false;
    }

    // All other items are visible
    return true;
  });

  return (
    <Sidebar>
      <SidebarHeader className="flex flex-col gap-2 p-4 pt-[32px] pb-[32px]">
        <div className="flex items-center gap-3">
          <img src={anaxiLogo} alt="Anaxi Logo" className="h-10 w-10" />
          <div>
            <h2 className="font-semibold text-base text-[#363b49]">Anaxi</h2>
            <p className="text-xs text-muted-foreground">
              {currentSchool?.name || "Loading..."}
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-4">
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <item.icon className={iconColorClasses[item.color]} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <Link href="/profile" data-testid="link-profile">
          <div className="flex items-center gap-3 hover-elevate rounded-md p-2 cursor-pointer">
            <Avatar className="h-8 w-8">
              {user?.profile_image_url && (
                <AvatarImage src={user.profile_image_url} />
              )}
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-[#363b49]" data-testid="text-current-user-name">
                {userName}
              </p>
              <p className="text-xs text-muted-foreground truncate" data-testid="text-current-user-email">
                {user?.email || ""}
              </p>
            </div>
          </div>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
