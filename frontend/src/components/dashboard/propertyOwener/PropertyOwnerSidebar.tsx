import { Link, useLocation, useNavigate } from "react-router";
import {
  Building2,
  Home,
  Plus,
  User,
  UserPlus,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMutation } from "@tanstack/react-query";
import { logoutUser } from "@/http/api";
import { useEffect, useState } from "react";

// Navigation items
const navigation = [
  {
    title: "Dashboard",
    url: "/propertyOwner/dashboard",
    icon: Home,
  },
  {
    title: "Properties",
    url: "/propertyOwner/properties",
    icon: Building2,
  },
  {
    title: "Create Property",
    url: "/propertyOwner/createProperty",
    icon: Plus,
  },
  {
    title: "Create Sale Employee",
    url: "/propertyOwner/createSaleEmployee",
    icon: UserPlus,
  },
  {
    title: "Profile",
    url: "/propertyOwner/userProfile",
    icon: User,
  },
];

// Mock user data - replace with real user data from your auth context
const user = {
  name: "Property Owner",
  email: "owner@example.com",
  avatar: null,
};

export function PropertyOwnerSidebar() {
  const [sessionId, setSessionId] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem("user") || "{}");
    console.log("Retrieve user data from sessionStorage:", userData);
    console.log(
      "Retrieve user data from sessionStorage: sessionId",
      userData.sessionId
    );
    setSessionId(userData.sessionId);
    if (!userData.sessionId) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const mutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: (response) => {
      console.log("Logout successful:", response);
      // Clear session storage
      sessionStorage.removeItem("user");
      // Navigate to home page
      navigate("/", { replace: true });
    },
    onError: (error) => {
      console.error("Logout error:", error);
      // You might want to show an error message to the user
    },
  });

  const handleLogout = () => {
    if (sessionId) {
      mutation.mutate(sessionId);
    } else {
      console.error("No session ID found for logout");
      // Still clear session storage and navigate in case of missing sessionId
      sessionStorage.removeItem("user");
      navigate("/", { replace: true });
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/propertyOwner/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">PropertyHub</span>
                  <span className="truncate text-xs">Property Management</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link to={item.url}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={user.avatar || undefined}
                      alt={user.name}
                    />
                    <AvatarFallback className="rounded-lg">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                  <ChevronDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link to="/propertyOwner/userProfile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50"
                  onClick={handleLogout}
                  disabled={mutation.isPending}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {mutation.isPending ? "Logging out..." : "Log out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}