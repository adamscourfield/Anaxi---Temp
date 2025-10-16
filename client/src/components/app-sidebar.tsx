import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Eye,
  History,
  MessageSquare,
  Building2,
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
    title: "Conversations",
    url: "/conversations",
    icon: MessageSquare,
    color: "info",
  },
  {
    title: "Manage Rubric",
    url: "/rubrics",
    icon: ClipboardList,
    color: "amber",
  },
  {
    title: "Manage Teachers",
    url: "/teachers",
    icon: Users,
    color: "pink",
  },
];

const iconColorClasses: Record<string, string> = {
  primary: "text-sidebar-foreground",
  info: "text-sidebar-foreground",
  teal: "text-sidebar-foreground",
  amber: "text-sidebar-foreground",
  pink: "text-sidebar-foreground",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isCreator } = useAuth();

  const userName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.email || "User";

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "?";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={anaxiLogo} alt="Anaxi Logo" className="h-10 w-10" />
          <div>
            <h2 className="font-semibold text-base">Anaxi</h2>
            <p className="text-xs text-muted-foreground">Springdale Academy</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-4">
              {isCreator && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location === "/schools"}>
                    <Link href="/schools" data-testid="link-manage-schools">
                      <Building2 className="text-sidebar-foreground" />
                      <span>Manage Schools</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
              {user?.profileImageUrl && (
                <AvatarImage src={user.profileImageUrl} />
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
