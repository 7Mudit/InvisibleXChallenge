import { UserRole } from "@/lib/schemas/users.schema";
import { FileCheck, Home, Plus, Users } from "lucide-react";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
  badge?: string;
}

export const sidebarItems: SidebarItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "New Task",
    href: "/dashboard/tasks/new",
    icon: Plus,
  },
  {
    title: "Submitted Tasks",
    href: "/dashboard/tasks/submitted",
    icon: FileCheck,
  },
  {
    title: "User Management",
    href: "/admin/users",
    icon: Users,
    roles: ["admin"],
    badge: "Admin",
  },
];
