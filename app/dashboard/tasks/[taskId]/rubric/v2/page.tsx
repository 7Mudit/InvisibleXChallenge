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
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  RubricV2InputSchema,
  RubricV2Input,
  validateRubricJSON,
  getStatusDisplayInfo,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { cn } from "@/lib/utils";

export default function RubricV2Page() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch task data - exactly the same as before
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

  // Form setup
  const form = useForm<RubricV2Input>({
    resolver: zodResolver(RubricV2InputSchema),
    defaultValues: {
      taskId,
      rubricV2: "",
    },
  });

  // Load existing rubrics when task data is available
  useEffect(() => {
    if (task) {
      // Load V2 if it exists, otherwise load V1 as starting point
      const initialRubric = task.Rubric_V2 || task.Rubric_V1 || "";
      if (initialRubric && typeof initialRubric === "string") {
        form.setValue("rubricV2", initialRubric);
      }
    }
  }, [task, form]);

  // Mutation for updating V2 rubric
  const updateRubricV2Mutation = api.tasks.updateRubricV2.useMutation({
    onSuccess: (data) => {
      toast.success("V2 Rubric enhanced successfully!", {
        description: data.message,
      });
      setIsSubmitting(false);
      // Navigate to human evaluation for Gemini
      router.push(`/dashboard/tasks/${taskId}/evaluation/human-gemini`);
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast.error("Failed to save V2 rubric", {
        description: error.message,
      });
    },
  });

  // Load V1 rubric into editor
  const loadV1Rubric = () => {
    if (task?.Rubric_V1 && typeof task.Rubric_V1 === "string") {
      form.setValue("rubricV2", task.Rubric_V1);
      toast.success("V1 rubric loaded as starting point");
    } else {
      toast.error("No V1 rubric found to load");
    }
  };

  const onSubmit = async (data: RubricV2Input) => {
    setIsSubmitting(true);

    const validation = validateRubricJSON(data.rubricV2);
    if (!validation.isValid) {
      setIsSubmitting(false);
      toast.error("Invalid rubric format", {
        description: validation.errors.join(", "),
      });
      return;
    }

    try {
      await updateRubricV2Mutation.mutateAsync(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  //  Loading and error states
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

  // Check if task is in correct state
  if (!["Rubric_V1", "Rubric_V2"].includes(task.Status)) {
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
            This task is not in the correct state for V2 rubric enhancement.
            Current status: {getStatusDisplayInfo(task.Status).label}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check if V1 rubric exists
  if (!task.Rubric_V1) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              V1 Rubric Required
            </h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing V1 Rubric</AlertTitle>
          <AlertDescription>
            You need to create a V1 rubric before enhancing to V2.
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

  // Parse V1 rubric for display
  let v1RubricItems: Array<{ key: string; question: string }> = [];
  try {
    if (task.Rubric_V1 && typeof task.Rubric_V1 === "string") {
      const v1Rubric = JSON.parse(task.Rubric_V1);
      v1RubricItems = Object.entries(v1Rubric)
        .filter(([key]) => key.startsWith("rubric_"))
        .map(([key, question]) => ({ key, question: String(question) }))
        .sort((a, b) => {
          const aNum = parseInt(a.key.replace("rubric_", ""));
          const bNum = parseInt(b.key.replace("rubric_", ""));
          return aNum - bNum;
        });
    }
  } catch (error) {
    console.error("Error parsing V1 rubric:", error);
  }

  // Check if we should show misaligned items
  const hasLowAlignment =
    task.Alignment_Gemini && (task.Alignment_Gemini as number) < 80;
  const hasMisalignedItems = task.Misaligned_Gemini && hasLowAlignment;

  return (
    <div className="space-y-6">
      {/* Header  */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Enhance to V2 Rubric
              </h1>
              <Badge className={statusInfo.color} variant="outline">
                {statusInfo.label}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{task.TaskID}</span>
              {sectorInfo && (
                <div className="flex items-center space-x-1">
                  <span>{sectorInfo.icon}</span>
                  <span>{sectorInfo.label}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Misaligned Items Alert */}
      {hasMisalignedItems && (
        <Card className="bg-gradient-to-br from-red-50/50 to-red-100/50 dark:from-red-950/20 dark:to-red-900/20 border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>Misaligned Rubric Items</span>
            </CardTitle>
            <CardDescription>
              {`These rubric items had different scores between human and model evaluation (${task.Alignment_Gemini}% alignment). Focus on improving these items.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              try {
                const misalignedItems = JSON.parse(
                  task.Misaligned_Gemini as string
                );
                return (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {misalignedItems.map((item: any, index: number) => (
                      <div
                        key={item.id}
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
                    <div className="text-xs text-muted-foreground mt-3 p-2 bg-red-50/30 dark:bg-red-950/20 rounded">
                      <strong>Revision tips:</strong> Consider rephrasing these
                      questions to be more specific, breaking complex criteria
                      into simpler parts, or clarifying ambiguous terms.
                    </div>
                  </div>
                );
              } catch (error) {
                console.error("Error parsing misaligned items:", error);
                return (
                  <p className="text-sm text-muted-foreground">
                    Unable to parse misaligned items data.
                  </p>
                );
              }
            })()}
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column: Instructions and V1 Reference */}
            <div className="space-y-6">
              {/* Enhancement Guidelines */}
              <Card className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lightbulb className="h-5 w-5 text-amber-600" />
                    <span>Enhancement Guidelines</span>
                  </CardTitle>
                  <CardDescription>
                    How to improve your V1 rubric to create V2
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
                      <strong>Add missing criteria:</strong> Include important
                      aspects that V1 might have missed
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Improve clarity:</strong> Ensure each question has
                      only one possible interpretation
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Target 15-25 items:</strong> Focus on quality over
                      quantity for evaluation efficiency
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* V1 Rubric Reference */}
              <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <span>V1 Rubric Reference</span>
                      </CardTitle>
                      <CardDescription>
                        Your current V1 rubric ({v1RubricItems.length} items)
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadV1Rubric}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Load V1
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="space-y-2 h-[380px] ">
                    {v1RubricItems.map((item, index) => (
                      <div
                        key={item.key}
                        className="p-3 bg-background/50 rounded-lg border border-border/30"
                      >
                        <div className="flex items-start space-x-2">
                          <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">
                            {index + 1}
                          </span>
                          <p className="text-sm wrap-anywhere text-foreground leading-relaxed">
                            {item.question}
                          </p>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: V2 Editor */}
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
                      <p className="text-sm wrap-anywhere text-foreground leading-relaxed mt-1">
                        {task.Prompt}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/*   Rubric Editor */}
              <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Edit className="h-5 w-5 text-green-600" />
                    <span>V2 Enhanced Rubric</span>
                  </CardTitle>
                  <CardDescription>
                    Edit and enhance your V1 rubric to create the final V2
                    version
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="rubricV2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enhanced Rubric JSON *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"rubric_1": "Does the response clearly explain...?", "rubric_2": "Does the response provide specific examples?", ...}'
                            className="min-h-[400px] font-mono text-sm bg-background/50"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enhance your V1 rubric with better clarity,
                          specificity, and completeness
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Submit Section*/}
          <div className="flex items-center justify-between pt-6 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/tasks/${taskId}`)}
              disabled={isSubmitting}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[200px]"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Enhanced Rubric...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Save V2 & Start Evaluation</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
