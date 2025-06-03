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
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  getStatusDisplayInfo,
  TaskStatus,
  calculateTaskProgress,
  getWorkflowSteps,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";

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
  const progress = calculateTaskProgress(task.Status);

  // Check for alignment issues that require revision
  const hasGeminiAlignment = task.Alignment_Gemini !== undefined;
  const geminiAlignmentLow =
    hasGeminiAlignment && (task.Alignment_Gemini as number) < 80;
  const needsRevision = geminiAlignmentLow && task.Status === "Rubric_V2";

  // Get all workflow steps and determine their states
  const workflowSteps = getWorkflowSteps();
  const currentStep = statusInfo.step;

  const stepCards = workflowSteps.map((step, index) => {
    const stepNumber = index + 1;
    let state: StepCardState = "locked";

    if (stepNumber < currentStep) {
      state = "completed";
    } else if (stepNumber === currentStep) {
      // Check if this step needs revision (for V2 rubric with low alignment)
      if (step.status === "Rubric_V2" && needsRevision) {
        state = "needs_revision";
      } else {
        state = "current";
      }
    }

    // Define routes for each step
    const getRouteForStep = (status: TaskStatus): string => {
      switch (status) {
        case "Task_Creation":
          return `/dashboard/tasks/${taskId}`;
        case "Rubric_V1":
          return `/dashboard/tasks/${taskId}/rubric/v1`;
        case "Rubric_V2":
          return `/dashboard/tasks/${taskId}/rubric/v2`;
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

    // Define icons for each step
    const getIconForStep = (
      status: TaskStatus
    ): React.ComponentType<{ className?: string }> => {
      switch (status) {
        case "Task_Creation":
          return FileText;
        case "Rubric_V1":
          return Bot;
        case "Rubric_V2":
          return Edit;
        case "Human_Eval_Gemini":
        case "Human_Eval_GPT":
          return User;
        case "Model_Eval_Gemini":
        case "Model_Eval_GPT":
          return BarChart3;
        case "Completed":
          return CheckCircle;
        default:
          return FileText;
      }
    };

    return {
      id: step.status.toLowerCase(),
      status: step.status,
      title: step.label,
      description: step.description,
      route: getRouteForStep(step.status),
      state,
      icon: getIconForStep(step.status),
      estimatedTime: step.estimatedTime,
    };
  });
  const currentStepCard = stepCards.find(
    (step) => step.state === "current" || step.state === "needs_revision"
  );
  const completedSteps = stepCards.filter(
    (step) => step.state === "completed"
  ).length;

  const getStepCardStyle = (state: StepCardState) => {
    switch (state) {
      case "completed":
        return "bg-gradient-to-br from-green-50/50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800";
      case "current":
        return "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 ring-2 ring-primary/20";
      case "needs_revision":
        return "bg-gradient-to-br from-red-50/50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/20 border-red-200 dark:border-red-800 ring-2 ring-red/20";
      case "locked":
      default:
        return "bg-muted/30 border-muted opacity-60";
    }
  };

  const getStepIcon = (
    state: StepCardState,
    IconComponent: React.ComponentType<{ className?: string }>
  ) => {
    console.log(IconComponent);
    switch (state) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "current":
        return <Play className="h-5 w-5 text-primary" />;
      case "needs_revision":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case "locked":
      default:
        return <Lock className="h-5 w-5 text-muted-foreground" />;
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
            Continue
          </Button>
        );
      case "needs_revision":
        return (
          <Button variant="destructive" {...buttonProps}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Revise
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
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
            </div>
            <p className="text-muted-foreground">
              Step-by-step evaluation workflow
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={task.Sources} target="_blank">
              <ExternalLink className="w-4 h-4 mr-2" />
              View Sources
            </Link>
          </Button>
        </div>
      </div>

      {/* Overall Progress */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
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
                <p className="text-3xl font-bold text-primary">
                  {Math.round(progress)}%
                </p>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Alignment Warning */}
      {geminiAlignmentLow && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low Alignment Detected</AlertTitle>
          <AlertDescription>
            {`Gemini evaluation alignment is ${task.Alignment_Gemini}% (minimum
            80% required). Please revise your V2 rubric and re-evaluate before
            proceeding to GPT evaluation.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Step Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">
            Evaluation Steps
          </h2>
          {currentStepCard && (
            <Badge variant="outline" className="text-primary border-primary">
              Current: {currentStepCard.title}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {stepCards.map((step, index) => {
            const IconComponent = step.icon;

            return (
              <Card
                key={step.id}
                className={`transition-all duration-200 hover:shadow-md ${getStepCardStyle(
                  step.state
                )}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background/50">
                        {getStepIcon(step.state, IconComponent)}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium">
                          Step {index + 1}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs mt-1">
                          {step.estimatedTime}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-base">
                      {step.title}
                    </h3>
                    <CardDescription className="text-sm mt-1">
                      {step.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {step.state === "completed" && "✓ Completed"}
                      {step.state === "current" && "→ Ready to start"}
                      {step.state === "needs_revision" && "⚠ Needs revision"}
                      {step.state === "locked" && "🔒 Locked"}
                    </div>
                    {getStepAction(step)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Task Overview Card */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
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

          <div className="grid gap-4 md:grid-cols-3 pt-4 border-t border-border/30">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
