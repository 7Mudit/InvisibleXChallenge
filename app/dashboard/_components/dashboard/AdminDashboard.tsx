import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { api } from "@/lib/trpc/client";
import {
  Badge,
  Crown,
  FileText,
  CheckCircle,
  Clock,
  Users,
  ArrowRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { AdminStatsCard } from "../card/AdminStatsCard";
import { useMemo } from "react";

export function AdminDashboard() {
  // For now, we'll use the current user's tasks as a base
  // In a real implementation, you'd want a separate admin endpoint that fetches ALL tasks
  const { data: allTasks, isLoading, error } = api.tasks.getMyTasks.useQuery();

  // Calculate platform-wide statistics
  const platformStats = useMemo(() => {
    if (!allTasks) {
      return { total: 0, completed: 0, incomplete: 0, completionRate: 0 };
    }

    const total = allTasks.length;
    const completed = allTasks.filter(
      (task) => task.Status === "Completed"
    ).length;
    const incomplete = total - completed; // Everything that's not completed
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, incomplete, completionRate };
  }, [allTasks]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Loading Admin Dashboard...
            </h1>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20"
            >
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-8 bg-muted rounded w-16"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Admin Dashboard
            </h1>
            <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <Crown className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg">
            Unable to load platform statistics at the moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <Crown className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        </div>
        <p className="text-muted-foreground text-lg">
          Platform overview and management tools.
        </p>
      </div>

      {/* Platform-wide Statistics - 3 cards focused on completion status */}
      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatsCard
          title="Total Tasks"
          value={platformStats.total.toString()}
          subtitle="Across all users"
          icon={FileText}
          colorClass="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <AdminStatsCard
          title="Completed Tasks"
          value={platformStats.completed.toString()}
          subtitle={`${platformStats.completionRate}% of all tasks`}
          icon={CheckCircle}
          colorClass="bg-gradient-to-br from-green-500 to-green-600"
        />
        <AdminStatsCard
          title="Pending Tasks"
          value={platformStats.incomplete.toString()}
          subtitle="Requiring attention"
          icon={Clock}
          colorClass="bg-gradient-to-br from-amber-500 to-amber-600"
        />
      </div>

      {/* Admin Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 hover:shadow-lg transition-all duration-200 group">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Manage Users</span>
            </CardTitle>
            <CardDescription>View and manage user accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="outline"
              className="w-full group-hover:shadow-md transition-all duration-200"
            >
              <Link
                href="/admin/users"
                className="flex items-center justify-center"
              >
                Manage Users
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:shadow-lg transition-all duration-200 group">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Create New Task</span>
            </CardTitle>
            <CardDescription>Start a new evaluation task</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              className="w-full group-hover:shadow-md transition-all duration-200"
            >
              <Link
                href="/dashboard/tasks/new"
                className="flex items-center justify-center"
              >
                Create Task
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:shadow-lg transition-all duration-200 group">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>View All Tasks</span>
            </CardTitle>
            <CardDescription>Browse all platform tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              variant="outline"
              className="w-full group-hover:shadow-md transition-all duration-200"
            >
              <Link
                href="/dashboard/tasks/submitted"
                className="flex items-center justify-center"
              >
                View Tasks
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Platform Health Overview */}
      {platformStats.total > 0 && (
        <Card className="bg-gradient-to-br from-muted/30 to-muted/10 border-border/50">
          <CardHeader>
            <CardTitle>Platform Health</CardTitle>
            <CardDescription>
              Overall completion status across all evaluation tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Task Completion Rate</span>
              <span className="text-2xl font-bold text-primary">
                {platformStats.completionRate}%
              </span>
            </div>
            <div className="w-full bg-muted/50 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${platformStats.completionRate}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed:</span>
                <span className="font-medium text-green-600">
                  {platformStats.completed}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending:</span>
                <span className="font-medium text-amber-600">
                  {platformStats.incomplete}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
