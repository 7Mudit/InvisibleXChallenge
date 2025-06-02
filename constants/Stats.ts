import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  Plus,
  Users,
} from "lucide-react";

export const stats = [
  {
    title: "Total Tasks",
    value: "24",
    change: "+2 from last week",
    icon: FileText,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  {
    title: "Completed",
    value: "18",
    change: "75% completion rate",
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  {
    title: "In Progress",
    value: "4",
    change: "Currently active",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  {
    title: "Pending",
    value: "2",
    change: "Awaiting review",
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
];

export const recentTasks = [
  {
    id: 1,
    title: "Data Science Evaluation",
    description: "Building complex graphs & infographics",
    status: "completed",
    sector: "Data Science",
    progress: 100,
    dueDate: "2 days ago",
  },
  {
    id: 2,
    title: "Web Development Task",
    description: "Three.js interactive visualization",
    status: "in-progress",
    sector: "Web Development",
    progress: 65,
    dueDate: "in 3 days",
  },
  {
    id: 3,
    title: "STEM Research Analysis",
    description: "Literature review & experiment design",
    status: "pending",
    sector: "STEM Research",
    progress: 30,
    dueDate: "in 1 week",
  },
];

export const quickActions = [
  {
    title: "Create New Task",
    description: "Start a new evaluation task",
    icon: Plus,
    href: "/tasks/create",
    variant: "default" as const,
    color: "from-primary/10 to-primary/5",
  },
  {
    title: "View Analytics",
    description: "See performance insights",
    icon: BarChart3,
    href: "/analytics",
    variant: "outline" as const,
    color: "from-blue-500/10 to-blue-500/5",
  },
  {
    title: "Manage Users",
    description: "Admin user management",
    icon: Users,
    href: "/admin/users",
    variant: "outline" as const,
    color: "from-purple-500/10 to-purple-500/5",
    adminOnly: true,
  },
];
