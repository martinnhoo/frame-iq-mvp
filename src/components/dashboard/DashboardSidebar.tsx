import {
  BarChart3,
  LayoutGrid,
  Video,
  Settings,
  Home,
  Plus,
  Globe,
  Brain,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const mainItems = [
  { title: "Overview", url: "/dashboard", icon: Home },
  { title: "Analyses", url: "/dashboard/analyses", icon: BarChart3 },
  { title: "Boards", url: "/dashboard/boards", icon: LayoutGrid },
  { title: "Videos", url: "/dashboard/videos", icon: Video },
];

const toolItems = [
  { title: "New Analysis", url: "/dashboard/analyses/new", icon: Plus },
  { title: "Create Board", url: "/dashboard/boards/new", icon: Plus },
  { title: "Translate", url: "/dashboard/translate", icon: Globe },
  { title: "Intelligence", url: "/dashboard/intelligence", icon: Brain },
];

interface DashboardSidebarProps {
  profile: {
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    plan: string;
  } | null;
  usageDetails?: {
    analyses: { used: number; limit: number; remaining: number };
    boards: { used: number; limit: number; remaining: number };
    videos: { used: number; limit: number; remaining: number };
    translations: { used: number; limit: number; remaining: number };
  } | null;
}

export function DashboardSidebar({ profile, usageDetails }: DashboardSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-sidebar-border">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="text-lg font-medium text-sidebar-foreground">Frame</span>
            {!collapsed && <span className="text-lg font-black gradient-text">IQ</span>}
          </NavLink>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {profile?.name?.charAt(0) || profile?.email?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.name || "User"}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.plan} plan</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
        {!collapsed && (
          <NavLink to="/dashboard/settings">
            <Button variant="ghost" size="sm" className="w-full justify-start mt-2 text-muted-foreground">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </NavLink>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
