"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
    [
      "Task_Creation",
      "Rubric_V1",
      "Rubric_V2",
      "Human_Eval_Gemini",
      "Human_Eval_GPT",
    ].includes(t.Status)
  );
  const tasksInEvaluation = inProgressTasks.filter((t) =>
    ["Model_Eval_Gemini", "Model_Eval_GPT"].includes(t.Status)
  );

  // Get next action for a task
  const getNextAction = (status: TaskStatus) => {
    switch (status) {
      case "Task_Creation":
        return { label: "Start Rubric", step: "Create V1 Rubric" };
      case "Rubric_V1":
        return { label: "Enhance Rubric", step: "Create V2 Rubric" };
      case "Rubric_V2":
        return { label: "Evaluate Gemini", step: "Human Evaluation" };
      case "Human_Eval_Gemini":
        return { label: "Model Eval", step: "Model Evaluation" };
      case "Model_Eval_Gemini":
        return { label: "Evaluate GPT", step: "Human Evaluation" };
      case "Human_Eval_GPT":
        return { label: "Final Model Eval", step: "Model Evaluation" };
      case "Model_Eval_GPT":
        return { label: "Review Results", step: "Almost Complete" };
      case "Completed":
        return { label: "View Results", step: "Completed" };
      default:
        return { label: "Continue", step: "Next Step" };
    }
  };

  return (
    <div className="space-y-6">
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
        <Button asChild>
          <Link href="/dashboard/tasks/new">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Link>
        </Button>
      </div>

      {/* Summary Stats */}
      {tasks && tasks.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {tasks.length}
                  </p>
                  <p className="text-sm text-blue-600/80">Total Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">
                    {tasksNeedingAttention.length}
                  </p>
                  <p className="text-sm text-amber-600/80">Need Attention</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold text-purple-600">
                    {tasksInEvaluation.length}
                  </p>
                  <p className="text-sm text-purple-600/80">In Evaluation</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {completedTasks.length}
                  </p>
                  <p className="text-sm text-green-600/80">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!tasks || tasks.length === 0 ? (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted/50 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">
                  No tasks created yet
                </h3>
                <p className="text-muted-foreground mt-1">
                  Create your first evaluation task to get started.
                </p>
              </div>
              <Button asChild className="mt-4">
                <Link href="/dashboard/tasks/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Task
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Tasks Needing Attention */}
          {tasksNeedingAttention.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-semibold text-foreground">
                  Tasks Needing Your Attention
                </h2>
                <Badge
                  variant="outline"
                  className="text-amber-600 border-amber-600"
                >
                  {tasksNeedingAttention.length} task
                  {tasksNeedingAttention.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="grid gap-4">
                {tasksNeedingAttention.map((task) => {
                  const statusInfo = getStatusDisplayInfo(task.Status);
                  const sectorIcon = getSectorIcon(task.ProfessionalSector);
                  const nextAction = getNextAction(task.Status);

                  return (
                    <Card
                      key={task.id}
                      className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800 hover:bg-gradient-to-r hover:from-amber-50/80 hover:to-orange-50/80 transition-all duration-200 cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/tasks/${task.TaskID}`)
                      }
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-semibold text-foreground text-lg">
                                    {task.TaskID}
                                  </h3>
                                  <Badge className={statusInfo.color}>
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
                                    <span>
                                      {task.TrainerEmail.split("@")[0]}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Button */}
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    `/dashboard/tasks/${task.TaskID}`
                                  );
                                }}
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                              >
                                {nextAction.label}
                                <ArrowRight className="w-4 h-4 ml-2" />
                              </Button>
                            </div>

                            {/* Task Description */}
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                {truncateText(task.Prompt, 150)}
                              </p>
                            </div>

                            {/* Progress */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Progress: {nextAction.step}
                                </span>
                                <span className="font-medium">
                                  {task.Progress}%
                                </span>
                              </div>
                              <Progress value={task.Progress} className="h-2" />
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

          {/* Tasks In Evaluation */}
          {tasksInEvaluation.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                <h2 className="text-xl font-semibold text-foreground">
                  Tasks In Model Evaluation
                </h2>
                <Badge
                  variant="outline"
                  className="text-purple-600 border-purple-600"
                >
                  {tasksInEvaluation.length} task
                  {tasksInEvaluation.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="grid gap-4">
                {tasksInEvaluation.map((task) => {
                  const statusInfo = getStatusDisplayInfo(task.Status);
                  const sectorIcon = getSectorIcon(task.ProfessionalSector);
                  const nextAction = getNextAction(task.Status);

                  return (
                    <Card
                      key={task.id}
                      className="bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800 hover:bg-gradient-to-r hover:from-purple-50/80 hover:to-indigo-50/80 transition-all duration-200 cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/tasks/${task.TaskID}`)
                      }
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-semibold text-foreground text-lg">
                                    {task.TaskID}
                                  </h3>
                                  <Badge className={statusInfo.color}>
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
                                    <span>
                                      {task.TrainerEmail.split("@")[0]}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    `/dashboard/tasks/${task.TaskID}`
                                  );
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Progress
                              </Button>
                            </div>

                            {/* Task Description */}
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                {truncateText(task.Prompt, 150)}
                              </p>
                            </div>

                            {/* Progress */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Progress: {nextAction.step}
                                </span>
                                <span className="font-medium">
                                  {task.Progress}%
                                </span>
                              </div>
                              <Progress value={task.Progress} className="h-2" />
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

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-semibold text-foreground">
                  Completed Evaluations
                </h2>
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600"
                >
                  {completedTasks.length} completed
                </Badge>
              </div>
              <div className="grid gap-4">
                {completedTasks.map((task) => {
                  const statusInfo = getStatusDisplayInfo(task.Status);
                  const sectorIcon = getSectorIcon(task.ProfessionalSector);

                  return (
                    <Card
                      key={task.id}
                      className="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800 hover:bg-gradient-to-r hover:from-green-50/80 hover:to-emerald-50/80 transition-all duration-200 cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/tasks/${task.TaskID}`)
                      }
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-semibold text-foreground text-lg">
                                    {task.TaskID}
                                  </h3>
                                  <Badge className={statusInfo.color}>
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
                                    <span>
                                      {task.TrainerEmail.split("@")[0]}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    `/dashboard/tasks/${task.TaskID}`
                                  );
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Results
                              </Button>
                            </div>

                            {/* Task Description */}
                            <div className="space-y-2">
                              <p className="text-sm text-muted-foreground">
                                {truncateText(task.Prompt, 150)}
                              </p>
                            </div>

                            {/* Progress */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  Evaluation Complete
                                </span>
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="font-medium text-green-600">
                                    {task.Progress}%
                                  </span>
                                </div>
                              </div>
                              <Progress value={task.Progress} className="h-2" />
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
