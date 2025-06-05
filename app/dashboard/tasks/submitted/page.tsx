"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Plus,
  Eye,
  ArrowRight,
  Loader2,
  Calendar,
  User,
  Clock,
  Target,
  BarChart3,
  Trophy,
  Activity,
  PlayCircle,
} from "lucide-react";
import { api } from "@/lib/trpc/client";
import { getStatusDisplayInfo, TaskStatus } from "@/lib/schemas/task";
import { truncateText } from "@/lib/utils/task-utils";
import { professionalSectors } from "@/constants/ProfessionalSectors";

export default function SubmittedTasksPage() {
  const router = useRouter();
  const {
    data: tasks,
    isLoading,
    error,
    refetch,
  } = api.tasks.getMyTasks.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Your Tasks
          </h1>
          <p className="text-muted-foreground">
            Manage your evaluation tasks and progress through the rubric
            workflow.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your tasks...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Your Tasks
          </h1>
          <p className="text-muted-foreground">
            Manage your evaluation tasks and progress through the rubric
            workflow.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Tasks</AlertTitle>
          <AlertDescription>
            {error.message}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getSectorIcon = (sector: string) => {
    const sectorData = professionalSectors.find((s) => s.value === sector);
    return sectorData?.icon || "📋";
  };

  // Group tasks by progress status
  const inProgressTasks = tasks?.filter((t) => t.Status !== "Completed") || [];
  const completedTasks = tasks?.filter((t) => t.Status === "Completed") || [];

  // Further categorize in-progress tasks
  const tasksNeedingAttention = inProgressTasks.filter((t) =>
    ["Task_Creation", "Rubric_V1", "Rubric_V2", "Rubric_Enhancing"].includes(
      t.Status
    )
  );
  const tasksInEvaluation = inProgressTasks.filter((t) =>
    [
      "Model_Eval_Gemini",
      "Human_Eval_Gemini",
      "Human_Eval_GPT",
      "Model_Eval_GPT",
    ].includes(t.Status)
  );

  // Get next action for a task
  const getNextAction = (status: TaskStatus) => {
    switch (status) {
      case "Task_Creation":
        return {
          label: "Start Rubric",
          step: "Create V1 Rubric",
          icon: PlayCircle,
        };
      case "Rubric_V1":
        return {
          label: "Enhance Rubric",
          step: "Create V2 Rubric",
          icon: Activity,
        };
      case "Rubric_V2":
        return {
          label: "Evaluate Gemini",
          step: "Human Evaluation",
          icon: User,
        };
      case "Human_Eval_Gemini":
        return {
          label: "Model Eval",
          step: "Model Evaluation",
          icon: BarChart3,
        };
      case "Model_Eval_Gemini":
        return { label: "Evaluate GPT", step: "Human Evaluation", icon: User };
      case "Human_Eval_GPT":
        return {
          label: "Final Model Eval",
          step: "Model Evaluation",
          icon: BarChart3,
        };
      case "Model_Eval_GPT":
        return {
          label: "Complete Task",
          step: "Almost Complete",
          icon: Trophy,
        };
      case "Completed":
        return {
          label: "View Results",
          step: "Completed",
          icon: Trophy,
        };
      default:
        return { label: "Continue", step: "Next Step", icon: ArrowRight };
    }
  };

  // Get action button for task card
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getActionButton = (task: any) => {
    const action = getNextAction(task.Status);
    const isCompleted = task.Status === "Completed";
    const resultsLink = `/dashboard/tasks/${task.TaskID}/results`;

    return (
      <Button
        size="sm"
        variant={isCompleted ? "outline" : "default"}
        onClick={(e) => {
          e.stopPropagation();
          router.push(
            isCompleted ? resultsLink : `/dashboard/tasks/${task.TaskID}`
          );
        }}
        className={
          isCompleted
            ? "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20"
            : ""
        }
      >
        <action.icon className="w-4 h-4 mr-2" />
        {action.label}
      </Button>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Your Tasks
          </h1>
          <p className="text-muted-foreground">
            Manage your evaluation tasks and progress through the rubric
            workflow.
          </p>
        </div>
        <Button asChild className="shadow-lg">
          <Link href="/dashboard/tasks/new">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Link>
        </Button>
      </div>

      {/* Summary Stats */}
      {tasks && tasks.length > 0 && (
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50/80 to-blue-100/40 dark:from-blue-950/40 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/50 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Total Tasks
                  </p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                    {tasks.length}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50/80 to-amber-100/40 dark:from-amber-950/40 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-800/50 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Need Attention
                  </p>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {tasksNeedingAttention.length}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50/80 to-purple-100/40 dark:from-purple-950/40 dark:to-purple-900/20 border-purple-200/50 dark:border-purple-800/50 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    In Evaluation
                  </p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    {tasksInEvaluation.length}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completed tasks card - subtle green styling */}
          <Card className="border-green-200 dark:border-green-800 hover:shadow-lg transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Completed
                  </p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {completedTasks.length}
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-full border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!tasks || tasks.length === 0 ? (
        <Card className="bg-gradient-to-br from-muted/30 to-muted/10 border-border/50">
          <CardContent className="py-16">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">
                  No tasks created yet
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Create your first evaluation task to get started with the
                  rubric evaluation workflow.
                </p>
              </div>
              <Button asChild size="lg" className="shadow-lg">
                <Link href="/dashboard/tasks/new">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Task
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Tasks Needing Attention */}
          {tasksNeedingAttention.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Tasks Needing Your Attention
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tasksNeedingAttention.length} task
                    {tasksNeedingAttention.length !== 1 ? "s" : ""} waiting for
                    action
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                {tasksNeedingAttention.map((task) => {
                  const statusInfo = getStatusDisplayInfo(task.Status);
                  const sectorIcon = getSectorIcon(task.ProfessionalSector);
                  const nextAction = getNextAction(task.Status);

                  return (
                    <Card
                      key={task.id}
                      className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/60 dark:border-amber-800/60 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer group"
                      onClick={() =>
                        router.push(`/dashboard/tasks/${task.TaskID}`)
                      }
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-semibold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                                {task.TaskID}
                              </h3>
                              <Badge
                                className={`${statusInfo.color} shadow-sm`}
                                variant="outline"
                              >
                                {nextAction.step}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <span>{sectorIcon}</span>
                                <span>{task.ProfessionalSector}</span>
                              </div>
                              {task.Created && (
                                <div className="flex items-center space-x-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    {new Date(
                                      task.Created
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{task.TrainerEmail.split("@")[0]}</span>
                              </div>
                            </div>
                          </div>
                          {getActionButton(task)}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {truncateText(task.Prompt, 150)}
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Progress: {nextAction.step}
                              </span>
                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                {task.Progress}%
                              </span>
                            </div>
                            <Progress
                              value={task.Progress}
                              className="h-2 bg-amber-100 dark:bg-amber-900/20"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks In Evaluation */}
          {tasksInEvaluation.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Tasks In Model Evaluation
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {tasksInEvaluation.length} task
                    {tasksInEvaluation.length !== 1 ? "s" : ""} being processed
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                {tasksInEvaluation.map((task) => {
                  const statusInfo = getStatusDisplayInfo(task.Status);
                  const sectorIcon = getSectorIcon(task.ProfessionalSector);
                  const nextAction = getNextAction(task.Status);

                  return (
                    <Card
                      key={task.id}
                      className="bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200/60 dark:border-purple-800/60 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 cursor-pointer group"
                      onClick={() =>
                        router.push(`/dashboard/tasks/${task.TaskID}`)
                      }
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-semibold text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                                {task.TaskID}
                              </h3>
                              <Badge
                                className={statusInfo.color}
                                variant="outline"
                              >
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <span>{sectorIcon}</span>
                                <span>{task.ProfessionalSector}</span>
                              </div>
                              {task.Created && (
                                <div className="flex items-center space-x-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    {new Date(
                                      task.Created
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{task.TrainerEmail.split("@")[0]}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/tasks/${task.TaskID}`);
                            }}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:hover:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Progress
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {truncateText(task.Prompt, 150)}
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Progress: {nextAction.step}
                              </span>
                              <span className="font-semibold text-purple-600 dark:text-purple-400">
                                {task.Progress}%
                              </span>
                            </div>
                            <Progress
                              value={task.Progress}
                              className="h-2 bg-purple-100 dark:bg-purple-900/20"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Tasks - Subtle Green Styling */}
          {completedTasks.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    Completed Evaluations
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {completedTasks.length} task
                    {completedTasks.length !== 1 ? "s" : ""} successfully
                    completed
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                {completedTasks.map((task) => {
                  const statusInfo = getStatusDisplayInfo(task.Status);
                  const sectorIcon = getSectorIcon(task.ProfessionalSector);

                  return (
                    <Card
                      key={task.id}
                      className="border-green-200 dark:border-green-800 hover:shadow-lg hover:shadow-green-500/5 transition-all duration-300 cursor-pointer group bg-card hover:bg-green-50/30 dark:hover:bg-green-950/10"
                      onClick={() =>
                        router.push(`/dashboard/tasks/${task.TaskID}`)
                      }
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <h3 className="text-lg font-semibold text-foreground group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                                  {task.TaskID}
                                </h3>
                              </div>
                              <Badge
                                variant="outline"
                                className="border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                              >
                                <Trophy className="w-3 h-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <div className="flex items-center space-x-1">
                                <span>{sectorIcon}</span>
                                <span>{task.ProfessionalSector}</span>
                              </div>
                              {task.Created && (
                                <div className="flex items-center space-x-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    {new Date(
                                      task.Created
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{task.TrainerEmail.split("@")[0]}</span>
                              </div>
                            </div>
                          </div>
                          {getActionButton(task)}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {truncateText(task.Prompt, 150)}
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-green-600 dark:text-green-400">
                                ✓ Evaluation Complete
                              </span>
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  {task.Progress}%
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-green-100 dark:bg-green-900/20 rounded-full h-2">
                              <div className="bg-green-500 h-2 rounded-full w-full"></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
