import { UserRole } from "@/lib/schemas/users.schema";
import { FileCheck, Home, Plus, Users } from "lucide-react";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  badge?: string;
  description?: string;
}

export const sidebarItems: SidebarItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
    description: "Overview and statistics",
  },
  {
    title: "New Task",
    href: "/dashboard/tasks/new",
    icon: Plus,
    description: "Create evaluation task",
  },
  {
    title: "Your Tasks",
    href: "/dashboard/tasks/submitted",
    icon: FileCheck,
    description: "Manage submitted tasks",
  },
  {
    title: "User Management",
    href: "/dashboard/admin/users",
    icon: Users,
    roles: ["admin"],
    badge: "Admin",
    description: "Manage platform users",
  },
];

export const getFilteredSidebarItems = (
  userRole: UserRole | undefined
): SidebarItem[] => {
  return sidebarItems.filter((item) => {
    if (!item.roles) return true;

    return userRole && item.roles.includes(userRole);
  });
};

export const sidebarConfig = {
  defaultWidth: "w-64",
  collapsedWidth: "w-16",
  mobileBreakpoint: "lg:ml-64",
  collapsedMobileBreakpoint: "lg:ml-16",
  zIndex: "z-50",
  backdropZIndex: "z-40",
};

export const getRoleBadgeStyling = (role: string) => {
  switch (role.toLowerCase()) {
    case "admin":
      return {
        variant: "destructive" as const,
        className:
          "bg-gradient-to-r from-purple-500 to-purple-600 text-white border-purple-600",
      };
    case "leads":
      return {
        variant: "default" as const,
        className:
          "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-600",
      };
    default:
      return {
        variant: "secondary" as const,
        className: "bg-muted text-muted-foreground",
      };
  }
};
