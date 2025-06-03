import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { api } from "@/lib/trpc/client";
import { FileText, CheckCircle, Clock, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { OperatorStatsCard } from "../card/OperatorStatsCard";
import { useMemo } from "react";

export function OperatorDashboard() {
  // Fetch the user's own tasks using the existing tRPC endpoint
  const { data: userTasks, isLoading, error } = api.tasks.getMyTasks.useQuery();

  // Calculate statistics from the user's actual task data
  const taskStats = useMemo(() => {
    if (!userTasks) {
      return { total: 0, completed: 0, inProgress: 0, completionRate: 0 };
    }

    const total = userTasks.length;
    const completed = userTasks.filter(
      (task) => task.Status === "Completed"
    ).length;
    const inProgress = userTasks.filter(
      (task) => task.Status === "Task_Creation"
    ).length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, completionRate };
  }, [userTasks]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Loading your dashboard... ⏳
          </h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="bg-card/50 backdrop-blur-sm border-border/50"
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back! 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            Unable to load your task statistics at the moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome back! 👋
        </h1>
        <p className="text-muted-foreground text-lg">
          Here&apos;s an overview of your evaluation tasks.
        </p>
      </div>

      {/* Operator's Personal Task Statistics - Only 3 cards now */}
      <div className="grid gap-4 md:grid-cols-3">
        <OperatorStatsCard
          title="Total Tasks"
          value={taskStats.total.toString()}
          change="Your created tasks"
          icon={FileText}
          colorClass="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <OperatorStatsCard
          title="Completed"
          value={taskStats.completed.toString()}
          change={`${taskStats.completionRate}% completion rate`}
          icon={CheckCircle}
          colorClass="bg-gradient-to-br from-green-500 to-green-600"
        />
        <OperatorStatsCard
          title="In Progress"
          value={taskStats.inProgress.toString()}
          change="Awaiting rubric creation"
          icon={Clock}
          colorClass="bg-gradient-to-br from-amber-500 to-amber-600"
        />
      </div>

      {/* Quick Actions for Operators */}
      <div className="grid gap-6 md:grid-cols-2">
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
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:shadow-lg transition-all duration-200 group">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Manage Your Tasks</span>
            </CardTitle>
            <CardDescription>
              View and continue your evaluation tasks
            </CardDescription>
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

      {/* Show a helpful message if user has no tasks yet */}
      {taskStats.total === 0 && (
        <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-border/50">
          <CardContent className="py-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">
                Ready to get started?
              </h3>
              <p className="text-muted-foreground mt-1">
                Create your first evaluation task to begin contributing to the
                platform.
              </p>
            </div>
            <Button asChild className="mt-4">
              <Link href="/dashboard/tasks/new">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Task
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
