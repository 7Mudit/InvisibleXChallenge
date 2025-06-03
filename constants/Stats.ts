/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Users,
  Crown,
} from "lucide-react";

export const getTaskStats = (tasks: any[]) => {
  const completed = tasks.filter((task) => task.status === "completed").length;
  const inProgress = tasks.filter(
    (task) => task.status === "in-progress"
  ).length;
  const pending = tasks.filter((task) => task.status === "pending").length;

  return {
    total: tasks.length,
    completed,
    inProgress,
    pending,
    completionRate:
      tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
  };
};

// Operator-specific quick actions
export const operatorQuickActions = [
  {
    title: "Create New Task",
    description: "Start a new evaluation task",
    icon: Plus,
    href: "/dashboard/tasks/new",
    variant: "default" as const,
    color: "from-primary/10 to-primary/5",
    borderColor: "border-primary/20",
  },
  {
    title: "View Your Tasks",
    description: "Manage and review your submitted tasks",
    icon: FileText,
    href: "/dashboard/tasks/submitted",
    variant: "outline" as const,
    color: "from-blue-500/10 to-blue-500/5",
    borderColor: "border-blue-500/20",
  },
];

// Admin-specific quick actions
export const adminQuickActions = [
  {
    title: "Manage Users",
    description: "View and manage user accounts",
    icon: Users,
    href: "/admin/users",
    variant: "outline" as const,
    color: "from-purple-500/10 to-purple-500/5",
    borderColor: "border-purple-500/20",
  },
  {
    title: "Create New Task",
    description: "Start a new evaluation task",
    icon: Plus,
    href: "/dashboard/tasks/new",
    variant: "default" as const,
    color: "from-primary/10 to-primary/5",
    borderColor: "border-primary/20",
  },
  {
    title: "View All Tasks",
    description: "Browse all platform tasks",
    icon: FileText,
    href: "/dashboard/tasks/submitted",
    variant: "outline" as const,
    color: "from-blue-500/10 to-blue-500/5",
    borderColor: "border-blue-500/20",
  },
];

// Professional sector data for category breakdown
export const professionalSectorStats = [
  {
    name: "Data Science & Analysis",
    icon: "📊",
    color: "bg-blue-500",
    lightColor: "bg-blue-100 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-400",
  },
  {
    name: "Web Development",
    icon: "💻",
    color: "bg-green-500",
    lightColor: "bg-green-100 dark:bg-green-950/30",
    textColor: "text-green-700 dark:text-green-400",
  },
  {
    name: "STEM Research",
    icon: "🔬",
    color: "bg-purple-500",
    lightColor: "bg-purple-100 dark:bg-purple-950/30",
    textColor: "text-purple-700 dark:text-purple-400",
  },
  {
    name: "Medicine",
    icon: "🏥",
    color: "bg-red-500",
    lightColor: "bg-red-100 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-400",
  },
  {
    name: "Law",
    icon: "⚖️",
    color: "bg-amber-500",
    lightColor: "bg-amber-100 dark:bg-amber-950/30",
    textColor: "text-amber-700 dark:text-amber-400",
  },
  {
    name: "Accounting",
    icon: "💼",
    color: "bg-indigo-500",
    lightColor: "bg-indigo-100 dark:bg-indigo-950/30",
    textColor: "text-indigo-700 dark:text-indigo-400",
  },
];

export const operatorStatCards = [
  {
    title: "Total Tasks",
    key: "total" as const,
    icon: FileText,
    color: "bg-gradient-to-br from-blue-500 to-blue-600",
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getChange: (stats: any) => "+2 from last week",
  },
  {
    title: "Completed",
    key: "completed" as const,
    icon: CheckCircle,
    color: "bg-gradient-to-br from-green-500 to-green-600",
    getChange: (stats: any) => `${stats.completionRate}% completion rate`,
  },
  {
    title: "In Progress",
    key: "inProgress" as const,
    icon: Clock,
    color: "bg-gradient-to-br from-amber-500 to-amber-600",
    getChange: () => "Currently active",
  },
  {
    title: "Pending",
    key: "pending" as const,
    icon: AlertCircle,
    color: "bg-gradient-to-br from-red-500 to-red-600",
    getChange: () => "Awaiting review",
  },
];

export const adminStatCards = [
  {
    title: "Total Tasks",
    key: "total" as const,
    icon: FileText,
    color: "bg-gradient-to-br from-blue-500 to-blue-600",
    getSubtitle: () => "Across all users",
  },
  {
    title: "Completed",
    key: "completed" as const,
    icon: CheckCircle,
    color: "bg-gradient-to-br from-green-500 to-green-600",
    getSubtitle: (stats: any) => `${stats.completionRate}% completion rate`,
  },
  {
    title: "In Progress",
    key: "inProgress" as const,
    icon: Clock,
    color: "bg-gradient-to-br from-amber-500 to-amber-600",
    getSubtitle: () => "Currently active",
  },
  {
    title: "Pending",
    key: "pending" as const,
    icon: AlertCircle,
    color: "bg-gradient-to-br from-red-500 to-red-600",
    getSubtitle: () => "Awaiting review",
  },
];

// Helper function to get top trainer rank styling
export const getTrainerRankStyling = (index: number) => {
  switch (index) {
    case 0:
      return {
        bgClass: "bg-gradient-to-br from-yellow-400 to-yellow-500",
        icon: "🥇",
        title: "Top Performer",
      };
    case 1:
      return {
        bgClass: "bg-gradient-to-br from-gray-400 to-gray-500",
        icon: "🥈",
        title: "Runner Up",
      };
    case 2:
      return {
        bgClass: "bg-gradient-to-br from-amber-600 to-amber-700",
        icon: "🥉",
        title: "Third Place",
      };
    default:
      return {
        bgClass: "bg-gradient-to-br from-blue-500 to-blue-600",
        icon: "👤",
        title: "Active Trainer",
      };
  }
};

// Default admin badge configuration
export const adminBadgeConfig = {
  className: "bg-gradient-to-r from-purple-500 to-purple-600 text-white",
  icon: Crown,
  text: "Admin",
};
