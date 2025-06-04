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
  FileText,
  CheckCircle,
  Plus,
  ArrowRight,
  Target,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { OperatorStatsCard } from "../card/OperatorStatsCard";
import { useMemo } from "react";

export function OperatorDashboard() {
  const { data: userTasks, isLoading, error } = api.tasks.getMyTasks.useQuery();

  // Calculate statistics from the user's actual task data with new workflow statuses
  const taskStats = useMemo(() => {
    if (!userTasks) {
      return {
        total: 0,
        completed: 0,
        needingAttention: 0,
        inEvaluation: 0,
        completionRate: 0,
      };
    }

    const total = userTasks.length;
    const completed = userTasks.filter(
      (task) => task.Status === "Completed"
    ).length;

    // Tasks that need active user work
    const needingAttention = userTasks.filter((task) =>
      [
        "Task_Creation",
        "Rubric_V1",
        "Rubric_V2",
        "Human_Eval_Gemini",
        "Human_Eval_GPT",
      ].includes(task.Status)
    ).length;

    // Tasks currently in model evaluation phase
    const inEvaluation = userTasks.filter((task) =>
      ["Model_Eval_Gemini", "Model_Eval_GPT"].includes(task.Status)
    ).length;

    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      needingAttention,
      inEvaluation,
      completionRate,
    };
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
          Here&apos;s an overview of your evaluation tasks and workflow
          progress.
        </p>
      </div>

      {/* Updated Task Statistics - 4 cards reflecting new workflow */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          title="Need Attention"
          value={taskStats.needingAttention.toString()}
          change="Require your input"
          icon={Target}
          colorClass="bg-gradient-to-br from-amber-500 to-amber-600"
        />
        <OperatorStatsCard
          title="In Evaluation"
          value={taskStats.inEvaluation.toString()}
          change="Model evaluation phase"
          icon={BarChart3}
          colorClass="bg-gradient-to-br from-purple-500 to-purple-600"
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
            <CardDescription>
              Start a new evaluation task with step-by-step workflow
            </CardDescription>
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
              View and continue your evaluation workflow
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

      {/* Workflow Progress Summary */}
      {taskStats.total > 0 && (
        <Card className="bg-gradient-to-br from-muted/30 to-muted/10 border-border/50">
          <CardHeader>
            <CardTitle>Your Workflow Progress</CardTitle>
            <CardDescription>
              Overview of your evaluation tasks across the step-by-step workflow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex flex-col items-center space-y-1 p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg">
                <span className="text-2xl font-bold text-blue-600">
                  {taskStats.total}
                </span>
                <span className="text-blue-600 font-medium">Total</span>
                <span className="text-xs text-muted-foreground">All tasks</span>
              </div>
              <div className="flex flex-col items-center space-y-1 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
                <span className="text-2xl font-bold text-amber-600">
                  {taskStats.needingAttention}
                </span>
                <span className="text-amber-600 font-medium">Active</span>
                <span className="text-xs text-muted-foreground">
                  Need your work
                </span>
              </div>
              <div className="flex flex-col items-center space-y-1 p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg">
                <span className="text-2xl font-bold text-purple-600">
                  {taskStats.inEvaluation}
                </span>
                <span className="text-purple-600 font-medium">Evaluating</span>
                <span className="text-xs text-muted-foreground">
                  Model phase
                </span>
              </div>
              <div className="flex flex-col items-center space-y-1 p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg">
                <span className="text-2xl font-bold text-green-600">
                  {taskStats.completed}
                </span>
                <span className="text-green-600 font-medium">Complete</span>
                <span className="text-xs text-muted-foreground">
                  {taskStats.completionRate}% done
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Overall Completion
                </span>
                <span className="font-medium text-primary">
                  {taskStats.completionRate}%
                </span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${taskStats.completionRate}%` }}
                />
              </div>
            </div>

            {/* Next Steps Hint */}
            {taskStats.needingAttention > 0 && (
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-400">
                    {taskStats.needingAttention} task
                    {taskStats.needingAttention !== 1 ? "s" : ""} need your
                    attention
                  </span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Continue working on rubric creation, human evaluations, or
                  other active steps.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                Create your first evaluation task to begin the step-by-step
                rubric workflow.
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
