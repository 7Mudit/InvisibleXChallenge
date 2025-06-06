"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle,
  Lock,
  Play,
  AlertTriangle,
  Edit,
  Clock,
  BarChart3,
  FileText,
  Bot,
  User,
  Loader2,
  AlertCircle,
  ExternalLink,
  Target,
  TrendingUp,
  Zap,
  History,
  RefreshCw,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  getStatusDisplayInfo,
  TaskStatus,
  calculateTaskProgress,
  getWorkflowSteps,
  getNextStatus,
  needsRubricIteration,
  getCurrentRubricVersionName,
  AlignmentHistoryEntry,
  AirtableTaskRecord,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { cn } from "@/lib/utils";

type StepCardState = "locked" | "current" | "completed" | "needs_revision";

interface StepCard {
  id: string;
  status: TaskStatus;
  title: string;
  description: string;
  route: string;
  state: StepCardState;
  icon: React.ComponentType<{ className?: string }>;
  estimatedTime: string;
  category: "setup" | "rubric" | "evaluation" | "completion";
  isIterative?: boolean;
  iterationInfo?: {
    currentVersion: number;
    targetVersion: number;
    reason: string;
  };
}

interface WorkflowCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGradient: string;
  steps: StepCard[];
}

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const {
    data: task,
    isLoading,
    error,
    refetch,
  } = api.tasks.getTaskById.useQuery(
    { taskId },
    {
      enabled: !!taskId,
    }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Loading Task...
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading task details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Task Not Found
            </h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Task</AlertTitle>
          <AlertDescription>
            {error?.message || "Task not found or access denied."}
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

  // Get task metadata
  const statusInfo = getStatusDisplayInfo(task.Status);
  const sectorInfo = professionalSectors.find(
    (s) => s.value === task.ProfessionalSector
  );
  const progress = calculateTaskProgress(
    task.Status,
    task.Current_Rubric_Version
  );
  const currentVersion = task.Current_Rubric_Version || 1;
  const versionName = getCurrentRubricVersionName(task as AirtableTaskRecord);

  // Check for alignment issues that require revision
  const hasGeminiAlignment = task.Alignment_Gemini !== undefined;
  const geminiAlignmentLow =
    hasGeminiAlignment && (task.Alignment_Gemini as number) < 80;
  const needsRevision = needsRubricIteration(task as AirtableTaskRecord);
  const nextStatus = getNextStatus(
    task.Status,
    task.Alignment_Gemini as number,
    currentVersion
  );

  // Parse alignment history
  let alignmentHistory: AlignmentHistoryEntry[] = [];
  try {
    if (task.Alignment_History && typeof task.Alignment_History === "string") {
      alignmentHistory = JSON.parse(task.Alignment_History);
    }
  } catch (error) {
    console.error("Error parsing alignment history:", error);
  }

  // Generate workflow steps with dynamic iterations
  const workflowSteps = getWorkflowSteps(task as AirtableTaskRecord);
  const completedStepNumber = statusInfo.step;

  // Route generation function
  const getRouteForStep = (status: TaskStatus): string => {
    switch (status) {
      case "Task_Creation":
        return `/dashboard/tasks/${taskId}`;
      case "Rubric_V1":
        return `/dashboard/tasks/${taskId}/rubric/v1`;
      case "Rubric_V2":
      case "Rubric_Enhancing":
        return `/dashboard/tasks/${taskId}/rubric/enhance`;
      case "Human_Eval_Gemini":
        return `/dashboard/tasks/${taskId}/evaluation/human-gemini`;
      case "Model_Eval_Gemini":
        return `/dashboard/tasks/${taskId}/evaluation/model-gemini`;
      case "Human_Eval_GPT":
        return `/dashboard/tasks/${taskId}/evaluation/human-gpt`;
      case "Model_Eval_GPT":
        return `/dashboard/tasks/${taskId}/evaluation/model-gpt`;
      case "Completed":
        return `/dashboard/tasks/${taskId}/results`;
      default:
        return `/dashboard/tasks/${taskId}`;
    }
  };

  // Icon mapping for each step
  const getIconForStep = (
    status: TaskStatus
  ): React.ComponentType<{ className?: string }> => {
    switch (status) {
      case "Task_Creation":
        return FileText;
      case "Rubric_V1":
      case "Rubric_V2":
      case "Rubric_Enhancing":
        return Edit;
      case "Human_Eval_Gemini":
      case "Human_Eval_GPT":
        return User;
      case "Model_Eval_Gemini":
      case "Model_Eval_GPT":
        return Bot;
      case "Completed":
        return CheckCircle;
      default:
        return FileText;
    }
  };

  // Generate step cards
  const stepCards: StepCard[] = workflowSteps.map((step, index) => {
    const stepNumber = index + 1;
    let state: StepCardState = "locked";

    if (stepNumber <= completedStepNumber) {
      state = "completed";
    } else if (stepNumber === completedStepNumber + 1) {
      if (
        (step.status === "Rubric_V2" || step.status === "Rubric_Enhancing") &&
        needsRevision
      ) {
        state = "needs_revision";
      } else if (nextStatus && step.status === nextStatus) {
        state = "current";
      }
    }

    // Special handling for rubric enhancement iterations
    if (step.status === "Rubric_Enhancing" && needsRevision) {
      state = "needs_revision";
    }

    // Determine category
    let category: StepCard["category"] = "setup";
    if (["Rubric_V1", "Rubric_V2", "Rubric_Enhancing"].includes(step.status)) {
      category = "rubric";
    } else if (
      [
        "Human_Eval_Gemini",
        "Model_Eval_Gemini",
        "Human_Eval_GPT",
        "Model_Eval_GPT",
      ].includes(step.status)
    ) {
      category = "evaluation";
    } else if (step.status === "Completed") {
      category = "completion";
    }

    return {
      id: step.status.toLowerCase(),
      status: step.status,
      title: step.label,
      description: step.description,
      route: getRouteForStep(step.status),
      state,
      icon: getIconForStep(step.status),
      estimatedTime: step.estimatedTime,
      category,
      isIterative: step.isIterative,
      iterationInfo: step.iterationInfo,
    };
  });

  // Group steps by category
  const categories: WorkflowCategory[] = [
    {
      id: "setup",
      title: "Project Setup",
      description: "Initial task creation and preparation",
      icon: FileText,
      color: "text-slate-600 dark:text-slate-400",
      bgGradient:
        "from-slate-50/50 to-slate-100/50 dark:from-slate-900/20 dark:to-slate-800/20",
      steps: stepCards.filter((step) => step.category === "setup"),
    },
    {
      id: "rubric",
      title: "Rubric Development",
      description: "Create and enhance evaluation criteria",
      icon: Edit,
      color: "text-teal-600 dark:text-teal-400",
      bgGradient:
        "from-teal-50/50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-800/20",
      steps: stepCards.filter((step) => step.category === "rubric"),
    },
    {
      id: "evaluation",
      title: "Response Evaluation",
      description: "Evaluate AI responses using the rubric",
      icon: BarChart3,
      color: "text-sky-600 dark:text-sky-400",
      bgGradient:
        "from-sky-50/50 to-sky-100/50 dark:from-sky-900/20 dark:to-sky-800/20",
      steps: stepCards.filter((step) => step.category === "evaluation"),
    },
    {
      id: "completion",
      title: "Task Completion",
      description: "Review results and export data",
      icon: CheckCircle,
      color: "text-green-600 dark:text-green-400",
      bgGradient:
        "from-green-50/50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/20",
      steps: stepCards.filter((step) => step.category === "completion"),
    },
  ];

  const currentStepCard = stepCards.find(
    (step) => step.state === "current" || step.state === "needs_revision"
  );
  const completedSteps = stepCards.filter(
    (step) => step.state === "completed"
  ).length;

  // Step card styling functions
  const getStepCardStyle = (state: StepCardState, isIterative?: boolean) => {
    const baseStyles =
      "transition-all duration-300 rounded-lg border hover:shadow-lg"; // Added rounded-lg, border (color will be specific to state), hover:shadow-lg

    switch (state) {
      case "completed":
        return `${baseStyles} border-green-500/70 dark:border-green-600/70 bg-green-50/40 dark:bg-green-900/30 text-green-700 dark:text-green-300`;
      case "current":
        return `${baseStyles} border-teal-500/70 dark:border-teal-600/70 bg-teal-50/40 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 shadow-md dark:shadow-teal-950/30`;
      case "needs_revision":
        const revisionPulse = isIterative ? "animate-pulse" : "";
        return `${baseStyles} border-amber-500/70 dark:border-amber-600/70 bg-amber-50/40 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ${revisionPulse}`;
      case "locked":
      default:
        return `${baseStyles} border-slate-300 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20 text-slate-500 dark:text-slate-400 opacity-70 hover:shadow-none`;
    }
  };

  const getStepIcon = (
    state: StepCardState,
    IconComponent: React.ComponentType<{ className?: string }>,
    isIterative?: boolean
  ) => {
    switch (state) {
      case "completed":
        return (
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />
        );
      case "current":
        return <Play className="h-5 w-5 text-teal-600 dark:text-teal-500" />;
      case "needs_revision":
        return isIterative ? (
          <RefreshCw className="h-5 w-5 text-amber-600 dark:text-amber-500 animate-spin" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
        );
      case "locked":
      default:
        return <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" />;
    }
  };

  const getStepAction = (step: StepCard) => {
    if (step.state === "locked") return null;

    const buttonProps = {
      size: "sm" as const,
      onClick: () => router.push(step.route),
    };

    switch (step.state) {
      case "completed":
        return (
          <Button variant="outline" {...buttonProps}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        );
      case "current":
        return (
          <Button {...buttonProps}>
            <Play className="h-4 w-4 mr-2" />
            {step.isIterative
              ? `Create V${step.iterationInfo?.targetVersion}`
              : "Continue"}
          </Button>
        );
      case "needs_revision":
        return (
          <Button
            variant="outline"
            {...buttonProps}
            className="border-amber-500/80 hover:bg-amber-100/50 dark:border-amber-600/80 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200"
          >
            <AlertTriangle className="h-4 w-4 mr-2 text-amber-700 dark:text-amber-300" />{" "}
            {step.isIterative
              ? `Enhance to V${step.iterationInfo?.targetVersion}`
              : "Revise"}
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {task.TaskID}
              </h1>
              <Badge className={statusInfo.color} variant="outline">
                {statusInfo.label}
              </Badge>
              {sectorInfo && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>{sectorInfo.icon}</span>
                  <span>{sectorInfo.label}</span>
                </div>
              )}
              {currentVersion > 1 && (
                <Badge
                  variant="outline"
                  className="text-teal-600 dark:text-teal-400 border-teal-500 dark:border-teal-600"
                >
                  {versionName}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Step-by-step evaluation workflow</span>
              {alignmentHistory.length > 0 && (
                <div className="flex items-center space-x-1">
                  <History className="w-3 h-3" />
                  <span>
                    {alignmentHistory.length} iteration
                    {alignmentHistory.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={task.Sources} target="_blank">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Sources
            </Link>
          </Button>
          {task.Status === "Completed" && (
            <Button size="sm" asChild>
              <Link href={`/dashboard/tasks/${taskId}/results`}>
                <BarChart3 className="w-4 h-4 mr-2" />
                View Results
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Overall Progress */}
      <Card className="bg-gradient-to-br from-teal-50/30 to-teal-100/30 dark:from-teal-900/20 dark:to-teal-800/20 border-teal-500/30 dark:border-teal-700/30">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Overall Progress
                </h3>
                <p className="text-sm text-muted-foreground">
                  {completedSteps} of {stepCards.length} steps completed
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                  {Math.round(progress)}%
                </p>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
            <Progress value={progress} className="h-3" />

            {currentStepCard && (
              <div className="flex items-center space-x-2 text-sm">
                <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                <span className="text-muted-foreground">Current step:</span>
                <Badge
                  variant="outline"
                  className="text-teal-600 dark:text-teal-400 border-teal-500 dark:border-teal-600"
                >
                  {currentStepCard.title}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alignment Warning */}
      {geminiAlignmentLow && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Alignment Below Threshold</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {`Gemini evaluation alignment is ${task.Alignment_Gemini}% (minimum 80% required). 
              You need to enhance your rubric and re-evaluate before proceeding to GPT evaluation.`}
            </p>
            {alignmentHistory.length > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                <span>
                  Iteration {alignmentHistory.length}:{" "}
                  {alignmentHistory[alignmentHistory.length - 1]?.alignment}%
                </span>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                router.push(`/dashboard/tasks/${taskId}/rubric/enhance`)
              }
              className="mt-2 border-amber-500/80 hover:bg-amber-100/50 dark:border-amber-600/80 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200"
            >
              <Zap className="h-4 w-4 mr-2" />
              Enhance Rubric Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Alignment Progress (for iterations) */}
      {alignmentHistory.length > 0 && (
        <Card className="bg-gradient-to-br from-sky-50/40 to-sky-100/40 dark:from-sky-900/20 dark:to-sky-800/20 border-sky-500/30 dark:border-sky-700/30">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <History className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              <span>Rubric Iteration Progress</span>
            </CardTitle>
            <CardDescription>
              Alignment improvement across rubric versions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-6">
              {alignmentHistory.map((entry, index) => (
                <div
                  key={entry.version}
                  className="flex flex-col items-center p-3 bg-background/50 rounded-lg border border-border/30"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2",
                      entry.alignment >= 80
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    )}
                  >
                    V{entry.version}
                  </div>
                  <p className="text-lg font-bold text-center">
                    {entry.alignment}%
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    {entry.misalignedCount} issues
                  </p>
                  {index === alignmentHistory.length - 1 &&
                    entry.alignment < 80 && (
                      <Badge
                        variant="outline"
                        className="text-xs mt-1 text-amber-600 dark:text-amber-400 border-amber-500 dark:border-amber-600"
                      >
                        Current
                      </Badge>
                    )}
                </div>
              ))}

              {/* Target indicator */}
              <div className="flex flex-col items-center p-3 bg-green-50/30 dark:bg-green-950/10 rounded-lg border border-green-200 dark:border-green-800 border-dashed">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <Target className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-center text-green-600">
                  80%
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Target
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Categories */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Evaluation Workflow
          </h2>
        </div>

        <Tabs defaultValue="grid" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="grid">Category View</TabsTrigger>
            <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="space-y-6">
            {categories.map((category) => (
              <Card
                key={category.id}
                className={`bg-gradient-to-br ${category.bgGradient} border-opacity-50`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <category.icon className={`h-5 w-5 ${category.color}`} />
                    <span>{category.title}</span>
                    <Badge variant="outline" className="ml-auto">
                      {
                        category.steps.filter((s) => s.state === "completed")
                          .length
                      }
                      /{category.steps.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {/*  eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                    {category.steps.map((step, index) => {
                      const IconComponent = step.icon;

                      return (
                        <Card
                          key={step.id}
                          className={getStepCardStyle(
                            step.state,
                            step.isIterative
                          )}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background/50">
                                  {getStepIcon(
                                    step.state,
                                    IconComponent,
                                    step.isIterative
                                  )}
                                </div>
                                <div>
                                  <CardTitle className="text-sm font-medium">
                                    {step.title}
                                  </CardTitle>
                                  <Badge
                                    variant="outline"
                                    className="text-xs mt-1"
                                  >
                                    {step.estimatedTime}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <CardDescription className="text-sm mt-2">
                              {step.description}
                              {step.isIterative && step.iterationInfo && (
                                <span className="block text-amber-600 dark:text-amber-400 mt-1 font-medium">
                                  {step.iterationInfo.reason}
                                </span>
                              )}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex items-center justify-between">
                              <div className="text-xs text-muted-foreground">
                                {step.state === "completed" && "✓ Completed"}
                                {step.state === "current" && "→ Ready to start"}
                                {step.state === "needs_revision" &&
                                  "⚠ Needs attention"}
                                {step.state === "locked" && "🔒 Locked"}
                              </div>
                              {getStepAction(step)}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <div className="space-y-4">
              {stepCards.map((step, index) => {
                const IconComponent = step.icon;
                const isLast = index === stepCards.length - 1;

                return (
                  <div key={step.id} className="flex items-start space-x-4">
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border-2",
                          step.state === "completed" &&
                            "bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700",
                          step.state === "current" &&
                            "bg-primary/10 border-primary",
                          step.state === "needs_revision" &&
                            "bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700",
                          step.state === "locked" &&
                            "bg-muted border-muted-foreground"
                        )}
                      >
                        {getStepIcon(
                          step.state,
                          IconComponent,
                          step.isIterative
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className={cn(
                            "w-0.5 h-16 mt-2",
                            step.state === "completed"
                              ? "bg-green-300 dark:bg-green-700"
                              : "bg-muted"
                          )}
                        />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="flex-1 pb-8">
                      <Card
                        className={getStepCardStyle(
                          step.state,
                          step.isIterative
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <h3 className="font-medium">{step.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                {step.description}
                              </p>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {step.estimatedTime}
                                </Badge>
                                {step.isIterative && step.iterationInfo && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-amber-600 dark:text-amber-400 border-amber-500 dark:border-amber-600"
                                  >
                                    V{step.iterationInfo.targetVersion}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {getStepAction(step)}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Task Overview Card */}
      <Card className="bg-slate-25/50 dark:bg-slate-900/20 backdrop-blur-sm border-slate-200 dark:border-slate-800/30">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Task Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {task.Prompt}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4 pt-4 border-t border-border/30">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Professional Sector
              </p>
              <p className="text-sm font-medium">{task.ProfessionalSector}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm font-medium">
                {task.Created &&
                (typeof task.Created === "string" ||
                  typeof task.Created === "number" ||
                  task.Created instanceof Date)
                  ? new Date(task.Created).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Trainer</p>
              <p className="text-sm font-medium font-mono">
                {task.TrainerEmail.split("@")[0]}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Current Version</p>
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">{versionName}</p>
                {task.Alignment_Gemini && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      (task.Alignment_Gemini as number) >= 80
                        ? "text-green-600 dark:text-green-400 border-green-500 dark:border-green-600"
                        : "text-amber-600 dark:text-amber-400 border-amber-500 dark:border-amber-600"
                    )}
                  >
                    {`${task.Alignment_Gemini}% aligned`}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
