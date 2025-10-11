import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Eye,
  History,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import anaxiLogo from "@assets/7_1760131494886.png";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    color: "primary",
  },
  {
    title: "Conduct Observation",
    url: "/observe",
    icon: Eye,
    color: "info",
  },
  {
    title: "Observation History",
    url: "/history",
    icon: History,
    color: "teal",
  },
  {
    title: "Manage Rubrics",
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
            <SidebarMenu className="gap-2">
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
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>RJ</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Rachel Johnson</p>
            <p className="text-xs text-muted-foreground truncate">Admin</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
