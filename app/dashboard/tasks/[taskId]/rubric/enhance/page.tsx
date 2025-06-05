"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  AlertCircle,
  Edit,
  Loader2,
  ArrowRight,
  FileText,
  Lightbulb,
  Zap,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  History,
  Target,
  BarChart3,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  RubricEnhanceInputSchema,
  RubricEnhanceInput,
  validateRubricJSON,
  getStatusDisplayInfo,
  getCurrentRubricContent,
  // getCurrentRubricVersionName,
  needsRubricIteration,
  AlignmentHistoryEntry,
  AirtableTaskRecord,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { cn } from "@/lib/utils";

interface RubricQuestion {
  key: string;
  question: string;
  number: number;
}

interface MisalignedItem {
  id: string;
  question: string;
  human_score: string;
  model_score: string;
}

export default function RubricEnhancePage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch task data
  const {
    data: task,
    isLoading: taskLoading,
    error: taskError,
    refetch,
  } = api.tasks.getTaskById.useQuery(
    { taskId },
    {
      enabled: !!taskId,
    }
  );

  // Determine current operation context
  const currentVersion = task?.Current_Rubric_Version || 1;
  const isCreatingV2 = task?.Status === "Rubric_V1";
  const isIterating = task?.Status === "Rubric_Enhancing";
  const targetVersion = isCreatingV2 ? 2 : currentVersion + 1;
  // const versionName = getCurrentRubricVersionName(task || {} as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const needsIteration = needsRubricIteration(task || ({} as any));

  // Form setup with proper default version
  const form = useForm<RubricEnhanceInput>({
    resolver: zodResolver(RubricEnhanceInputSchema),
    defaultValues: {
      taskId,
      rubricContent: "",
      targetVersion,
    },
  });

  // Watch form content for real-time validation
  const formContent = form.watch("rubricContent");

  // Real-time validation
  useEffect(() => {
    if (formContent && formContent.trim().length > 0) {
      const validation = validateRubricJSON(formContent);
      setValidationErrors(validation.errors);
    } else {
      setValidationErrors([]);
    }
  }, [formContent]);

  // Update target version when task changes
  useEffect(() => {
    if (task) {
      const newTargetVersion = isCreatingV2 ? 2 : currentVersion + 1;
      form.setValue("targetVersion", newTargetVersion);
    }
  }, [task, isCreatingV2, currentVersion, form]);

  // Load existing content when task loads
  useEffect(() => {
    if (task) {
      // For V2: load V1 as starting point
      // For V3+: load current version as starting point
      const startingContent = isCreatingV2
        ? task.Rubric_V1
        : getCurrentRubricContent(task as AirtableTaskRecord);

      if (startingContent && typeof startingContent === "string") {
        form.setValue("rubricContent", startingContent);
      }
    }
  }, [task, form, isCreatingV2]);

  // Parse alignment history
  let alignmentHistory: AlignmentHistoryEntry[] = [];
  try {
    if (task?.Alignment_History && typeof task.Alignment_History === "string") {
      alignmentHistory = JSON.parse(task.Alignment_History);
    }
  } catch (error) {
    console.error("Error parsing alignment history:", error);
  }

  // Parse misaligned items for enhancement guidance
  let misalignedItems: MisalignedItem[] = [];
  if (
    task?.Misaligned_Gemini &&
    needsIteration &&
    typeof task.Misaligned_Gemini === "string"
  ) {
    try {
      misalignedItems = JSON.parse(task.Misaligned_Gemini);
    } catch (error) {
      console.error("Error parsing misaligned items:", error);
    }
  }

  // Parse previous version for reference
  const previousVersion = targetVersion - 1;
  const previousRubricContent = isCreatingV2
    ? task?.Rubric_V1
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getCurrentRubricContent(task || ({} as any));

  let previousRubricItems: RubricQuestion[] = [];

  try {
    if (previousRubricContent && typeof previousRubricContent === "string") {
      const previousRubric = JSON.parse(previousRubricContent);
      previousRubricItems = Object.entries(previousRubric)
        .filter(([key]) => key.startsWith("rubric_"))
        .map(([key, question]) => ({
          key,
          question: String(question),
          number: parseInt(key.replace("rubric_", "")),
        }))
        .sort((a, b) => a.number - b.number);
    }
  } catch (error) {
    console.error("Error parsing previous rubric:", error);
  }

  // Mutation
  const updateRubricEnhancedMutation =
    api.tasks.updateRubricEnhanced.useMutation({
      onSuccess: (data) => {
        toast.success(`V${data.version} Rubric created successfully!`, {
          description: data.message,
        });
        setIsSubmitting(false);
        router.push(`/dashboard/tasks/${taskId}/evaluation/human-gemini`);
      },
      onError: (error) => {
        setIsSubmitting(false);
        toast.error("Failed to save enhanced rubric", {
          description: error.message,
        });
      },
    });

  // Load previous version into editor
  const loadPreviousVersion = () => {
    if (
      task &&
      previousRubricContent &&
      typeof previousRubricContent === "string"
    ) {
      form.setValue("rubricContent", previousRubricContent);
      const versionLabel = isCreatingV2 ? "V1" : `V${currentVersion}`;
      toast.success(`${versionLabel} rubric loaded as starting point`);
    } else {
      toast.error("No previous version found to load");
    }
  };

  // Form submission
  const onSubmit = async (data: RubricEnhanceInput) => {
    setIsSubmitting(true);

    const validation = validateRubricJSON(data.rubricContent);
    if (!validation.isValid) {
      setIsSubmitting(false);
      toast.error("Invalid rubric format", {
        description: validation.errors.join(", "),
      });
      return;
    }

    try {
      await updateRubricEnhancedMutation.mutateAsync(data);
    } catch (error) {
      // Error handling is done in the mutation
      console.error("Enhancement submission error:", error);
    }
  };

  // Loading state
  if (taskLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Loading...
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

  // Error state
  if (taskError || !task) {
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
            {taskError?.message || "Task not found or access denied."}
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

  // Validation - check if we can enhance
  const canEnhance = isCreatingV2 || isIterating;
  if (!canEnhance) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Invalid Task State
            </h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Cannot Enhance Rubric</AlertTitle>
          <AlertDescription>
            This task is not in the correct state for rubric enhancement.
            Current status: {getStatusDisplayInfo(task.Status).label}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check for required previous version
  if (!previousRubricContent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Previous Rubric Required
            </h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing Previous Rubric</AlertTitle>
          <AlertDescription>
            You need to create V{previousVersion} rubric before enhancing to V
            {targetVersion}.
            <Button
              variant="outline"
              size="sm"
              className="mt-2 ml-2"
              onClick={() =>
                router.push(`/dashboard/tasks/${taskId}/rubric/v1`)
              }
            >
              Create V1 Rubric
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusInfo = getStatusDisplayInfo(task.Status);
  const sectorInfo = professionalSectors.find(
    (s) => s.value === task.ProfessionalSector
  );

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {isCreatingV2
                  ? "Create V2 Rubric"
                  : `Enhance to V${targetVersion} Rubric`}
              </h1>
              <Badge className={statusInfo.color} variant="outline">
                {statusInfo.label}
              </Badge>
              {isIterating && (
                <Badge
                  className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  variant="outline"
                >
                  Iteration Required
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{task.TaskID}</span>
              {sectorInfo && (
                <div className="flex items-center space-x-1">
                  <span>{sectorInfo.icon}</span>
                  <span>{sectorInfo.label}</span>
                </div>
              )}
              {isIterating && task.Alignment_Gemini && (
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>{`Previous: ${task.Alignment_Gemini}%`}</span>
                </div>
              )}
              <div className="flex items-center space-x-1">
                <Target className="w-3 h-3" />
                <span>Target: ≥80% alignment</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Iteration Context Alert - Only show for iterations, not V2 creation */}
      {isIterating && misalignedItems.length > 0 && (
        <Alert className="bg-gradient-to-r from-red-50/50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/20 border-red-200 dark:border-red-800">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 dark:text-red-400">
            Focus Areas for V{targetVersion}
          </AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            <div className="space-y-3">
              <p>
                {`These ${misalignedItems.length} items had different scores
                between human and model evaluation ({task.Alignment_Gemini}%
                alignment). Focus on improving these specific criteria to
                achieve ≥80% alignment.`}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {misalignedItems.slice(0, 4).map((item, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="p-2 bg-red-50/50 dark:bg-red-950/30 rounded text-xs border border-red-200 dark:border-red-800"
                  >
                    <div className="font-medium">{item.id}</div>
                    <div className="text-red-600 dark:text-red-400 mt-1">
                      Human: {item.human_score} | Model: {item.model_score}
                    </div>
                  </div>
                ))}
                {misalignedItems.length > 4 && (
                  <div className="p-2 bg-red-50/50 dark:bg-red-950/30 rounded text-xs border border-red-200 dark:border-red-800 flex items-center justify-center">
                    <span className="text-red-600 dark:text-red-400">
                      +{misalignedItems.length - 4} more items
                    </span>
                  </div>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Alignment History - Only show for iterations */}
      {isIterating && alignmentHistory.length > 0 && (
        <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <History className="h-5 w-5 text-blue-600" />
              <span>Your Progress History</span>
            </CardTitle>
            <CardDescription>
              Alignment scores across rubric versions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                {alignmentHistory.map((entry) => (
                  <div
                    key={entry.version}
                    className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/30"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                          entry.alignment >= 80
                            ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                        )}
                      >
                        V{entry.version}
                      </div>
                      <span className="text-sm font-medium">
                        {entry.alignment}%
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {entry.misalignedCount} issues
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress towards target */}
              <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    Progress to 80% target
                  </span>
                  <span className="font-medium text-primary">
                    {alignmentHistory[alignmentHistory.length - 1]?.alignment ||
                      0}
                    % / 80%
                  </span>
                </div>
                <Progress
                  value={Math.min(
                    ((alignmentHistory[alignmentHistory.length - 1]
                      ?.alignment || 0) /
                      80) *
                      100,
                    100
                  )}
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column: Guidelines and Reference */}
            <div className="space-y-6">
              {/* Enhancement Guidelines */}
              <Card className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                    <span>V{targetVersion} Enhancement Guidelines</span>
                  </CardTitle>
                  <CardDescription>
                    {isCreatingV2
                      ? "How to improve your V1 rubric to create V2"
                      : `How to improve V${previousVersion} based on ${misalignedItems.length} alignment issues`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start space-x-2">
                    <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Add specificity:</strong> Make vague questions
                      more concrete and measurable
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Break down complex items:</strong> Split
                      multi-part questions into individual rubrics
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Clarify ambiguous terms:</strong> Use precise
                      language that has only one interpretation
                    </span>
                  </div>
                  {isIterating && misalignedItems.length > 0 && (
                    <div className="flex items-start space-x-2">
                      <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <span>
                        <strong>Address misalignments:</strong> Focus on the{" "}
                        {misalignedItems.length} problematic items above
                      </span>
                    </div>
                  )}
                  <div className="flex items-start space-x-2">
                    <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Target 15-25 items:</strong> Focus on quality over
                      quantity for evaluation efficiency
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Test interpretation:</strong> Each question should
                      have only one possible answer
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Misaligned Items Detail - Only for iterations */}
              {isIterating && misalignedItems.length > 0 && (
                <Card className="bg-gradient-to-br from-red-50/50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/20 border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span>Misaligned Items ({misalignedItems.length})</span>
                    </CardTitle>
                    <CardDescription>
                      Items where human and model disagreed - these need your
                      attention
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {misalignedItems.map((item, index) => (
                          <div
                            key={`${item.id}-detail-${index}`}
                            className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800"
                          >
                            <div className="flex items-start space-x-2">
                              <span className="bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">
                                {index + 1}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {item.id}: {item.question}
                                </p>
                                <div className="flex items-center space-x-4 mt-1 text-xs">
                                  <span className="text-muted-foreground">
                                    Human:{" "}
                                    <span
                                      className={cn(
                                        "font-medium",
                                        item.human_score === "Yes"
                                          ? "text-green-600"
                                          : "text-red-600"
                                      )}
                                    >
                                      {item.human_score}
                                    </span>
                                  </span>
                                  <span className="text-muted-foreground">
                                    Model:{" "}
                                    <span
                                      className={cn(
                                        "font-medium",
                                        item.model_score === "Yes"
                                          ? "text-green-600"
                                          : "text-red-600"
                                      )}
                                    >
                                      {item.model_score}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <div className="text-xs text-muted-foreground mt-3 p-2 bg-red-50/30 dark:bg-red-950/20 rounded">
                      <strong>Enhancement tips:</strong> Make these questions
                      more specific, break complex criteria into simpler parts,
                      or clarify ambiguous terms.
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Previous Version Reference */}
              <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <span>
                          V{previousVersion} Reference (
                          {previousRubricItems.length} items)
                        </span>
                      </CardTitle>
                      <CardDescription>
                        Your current rubric as starting point
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadPreviousVersion}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Load V{previousVersion}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-80">
                    <div className="space-y-2">
                      {previousRubricItems.map((item, index) => {
                        const isMisaligned = misalignedItems.some(
                          (m) => m.id === item.key
                        );
                        return (
                          <div
                            key={`${item.key}-reference-${index}`}
                            className={cn(
                              "p-3 rounded-lg border transition-all duration-200",
                              isMisaligned
                                ? "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800 ring-1 ring-red-200 dark:ring-red-800"
                                : "bg-background/50 border-border/30"
                            )}
                          >
                            <div className="flex items-start space-x-2">
                              <span
                                className={cn(
                                  "rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0",
                                  isMisaligned
                                    ? "bg-red-600 text-white"
                                    : "bg-blue-600 text-white"
                                )}
                              >
                                {index + 1}
                              </span>
                              <p className="text-sm text-foreground leading-relaxed">
                                {item.question}
                              </p>
                            </div>
                            {isMisaligned && (
                              <div className="ml-7 mt-2">
                                <Badge
                                  variant="outline"
                                  className="text-xs text-red-600 border-red-600"
                                >
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Needs attention
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Task Context & Editor */}
            <div className="space-y-6">
              {/* Task Context */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Task Context</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Task Prompt
                      </p>
                      <p className="text-sm text-foreground leading-relaxed mt-1">
                        {task.Prompt}
                      </p>
                    </div>
                    {isIterating && (
                      <div className="border-t border-border/30 pt-3">
                        <p className="text-xs text-muted-foreground">
                          Enhancement Goal
                        </p>
                        <p className="text-sm text-foreground leading-relaxed mt-1">
                          {`Improve V{previousVersion} rubric to achieve ≥80%
                          human-model alignment (currently{" "}
                          ${task.Alignment_Gemini}%)`}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Validation Status */}
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Validation Issues</AlertTitle>
                  <AlertDescription>
                    <ul className="text-sm space-y-1 mt-2">
                      {validationErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Rubric Editor */}
              <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Edit className="h-5 w-5 text-green-600" />
                    <span>V{targetVersion} Enhanced Rubric</span>
                  </CardTitle>
                  <CardDescription>
                    {isCreatingV2
                      ? "Edit and enhance your V1 rubric to create the final V2 version"
                      : `Enhance V${previousVersion} to address ${misalignedItems.length} alignment issues`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="rubricContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enhanced Rubric JSON *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"rubric_1": "Does the response clearly explain...?", "rubric_2": "Does the response provide specific examples?", ...}'
                            className="min-h-[500px] font-mono text-sm bg-background/50"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {isCreatingV2
                            ? "Enhance your V1 rubric with better clarity, specificity, and completeness"
                            : `Enhance V${previousVersion} with better clarity, specificity, and completeness to achieve ≥80% alignment`}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Must contain 15-50 unique rubric items with at least
                            10 characters each.
                          </span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Submit Section */}
          <div className="flex items-center justify-between pt-6 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/tasks/${taskId}`)}
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Overview
            </Button>

            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground text-right">
                {validationErrors.length === 0 &&
                formContent &&
                formContent.trim().length > 0 ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <BarChart3 className="w-4 h-4" />
                    <span>Validation passed</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Check validation above</span>
                  </div>
                )}
              </div>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  validationErrors.length > 0 ||
                  !formContent?.trim()
                }
                className="min-w-[220px]"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving V{targetVersion}...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>Save V{targetVersion} & Start Evaluation</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
