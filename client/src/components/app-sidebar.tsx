import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Eye,
  History,
  MessageSquare,
  Settings,
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
  const { user, isCreator } = useAuth();
  const { schools, currentSchoolId } = useSchool();

  const currentSchool = schools?.find(s => s.id === currentSchoolId);

  // Check if user is Admin in current school
  const { data: currentMembership } = useQuery<SchoolMembership>({
    queryKey: ["/api/my-membership-role", currentSchoolId],
    enabled: !!user && !!currentSchoolId && !isCreator,
    queryFn: async () => {
      try {
        const response = await fetch(`/api/schools/${currentSchoolId}/memberships`);
        if (!response.ok) return null;
        const memberships = await response.json();
        return memberships.find((m: any) => m.userId === user?.id) || null;
      } catch {
        return null;
      }
    },
  });

  const isAdmin = isCreator || currentMembership?.role === "Admin";

  const userName = user?.first_name && user?.last_name 
    ? `${user.first_name} ${user.last_name}` 
    : user?.email || "User";

  const userInitials = user?.first_name && user?.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
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
              {menuItems.map((item) => (
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
              <p className="text-sm font-medium truncate" data-testid="text-current-user-name">
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
