"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  AlertCircle,
  Bot,
  Loader2,
  ArrowRight,
  Copy,
  CheckCircle,
  ThumbsUp,
  ThumbsDown,
  Eye,
  EyeOff,
  Target,
  Edit,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  getStatusDisplayInfo,
  getCurrentRubricVersionName,
  AirtableTaskRecord,
} from "@/lib/schemas/task";
import { generateRubricCheckerPrompt } from "@/lib/utils/rubric-prompts";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { cn } from "@/lib/utils";

// Import our reusable utilities
import {
  parseCurrentRubricQuestions,
  getEvaluationPrerequisites,
  loadExistingEvaluationScores,
  type RubricQuestion,
} from "@/lib/utils/evaluation-utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ModelEvalFormData {
  taskId: string;
  evaluations: Record<string, "Yes" | "No">;
}

export default function ModelEvalGeminiPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [rubricQuestions, setRubricQuestions] = useState<RubricQuestion[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

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

  // Form setup
  const form = useForm<ModelEvalFormData>({
    defaultValues: {
      taskId,
      evaluations: {},
    },
  });

  // Parse current rubric version and load existing evaluations
  useEffect(() => {
    if (task) {
      const questions = parseCurrentRubricQuestions(task as AirtableTaskRecord);
      setRubricQuestions(questions);

      // Load existing model evaluations if available
      const existingEvals = loadExistingEvaluationScores(
        task as AirtableTaskRecord,
        "model-gemini",
        questions
      );
      form.setValue("evaluations", existingEvals);
    }
  }, [task, form]);

  // Watch form changes to update progress
  const allFormValues = form.watch();
  useEffect(() => {
    if (!rubricQuestions.length) return;

    const evaluations = allFormValues.evaluations || {};
    const completedAnswers = rubricQuestions.filter((q) => {
      const answer = evaluations[q.key];
      return answer === "Yes" || answer === "No";
    });

    setCompletedCount(completedAnswers.length);
  }, [allFormValues, rubricQuestions]);

  // Mutation for updating model evaluation
  const updateModelEvalMutation = api.tasks.updateModelEvalGemini.useMutation({
    onSuccess: (data) => {
      toast.success("Model evaluation saved successfully!", {
        description: data.message,
      });
      setIsSubmitting(false);

      // Handle routing based on alignment
      if (data.needsRevision) {
        toast.warning(`Alignment is ${data.alignment}% - revision required`, {
          description: "Redirecting to rubric enhancement...",
        });
        router.push(`/dashboard/tasks/${taskId}/rubric/enhance`);
      } else {
        toast.success(`Great alignment: ${data.alignment}%!`, {
          description: "Proceeding to GPT evaluation...",
        });
        router.push(`/dashboard/tasks/${taskId}/evaluation/human-gpt`);
      }
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast.error("Failed to save model evaluation", {
        description: error.message,
      });
    },
  });

  // Generate the checker prompt
  const checkerPrompt = React.useMemo(() => {
    if (!task || !rubricQuestions.length) return "";

    return generateRubricCheckerPrompt(
      {
        Prompt: task.Prompt,
        GeminiResponse: task.GeminiResponse,
        GPTResponse: task.GPTResponse,
      },
      rubricQuestions.map((q) => ({
        id: q.key,
        question: q.question,
        tag: q.tag,
      }))
    );
  }, [task, rubricQuestions]);

  // Copy prompt to clipboard
  const copyPromptToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(checkerPrompt);
      setPromptCopied(true);
      toast.success("Prompt copied to clipboard!");
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (error) {
      console.error("Error copying the prompt", error);
      toast.error("Failed to copy prompt to clipboard");
    }
  };

  // Form submission
  const onSubmit = async (data: ModelEvalFormData) => {
    setIsSubmitting(true);

    // Check all questions are answered
    const unansweredQuestions = rubricQuestions.filter(
      (q) => !data.evaluations[q.key]
    );

    if (unansweredQuestions.length > 0) {
      setIsSubmitting(false);
      toast.error("Please answer all rubric questions", {
        description: `${unansweredQuestions.length} questions remaining`,
      });
      return;
    }

    // Convert evaluations to the required JSON format
    const modelScores = JSON.stringify(data.evaluations);

    try {
      await updateModelEvalMutation.mutateAsync({
        taskId: data.taskId,
        modelScores,
      });
    } catch (error) {
      console.error("Model evaluation submission error:", error);
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

  // Check if task is in correct state
  if (!["Human_Eval_Gemini", "Model_Eval_Gemini"].includes(task.Status)) {
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
          <AlertTitle>Cannot Evaluate Response</AlertTitle>
          <AlertDescription>
            This task is not in the correct state for model evaluation. Current
            status: {getStatusDisplayInfo(task.Status).label}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check for required prerequisites using dynamic validation
  const prerequisites = getEvaluationPrerequisites(
    task as AirtableTaskRecord,
    "model-gemini"
  );

  if (prerequisites.missingItems.length > 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Prerequisites Missing
            </h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing Required Data</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>You need to complete the following before model evaluation:</p>
              <ul className="list-disc list-inside space-y-1">
                {prerequisites.missingItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  router.push(
                    `/dashboard/tasks/${taskId}/evaluation/human-gemini`
                  )
                }
              >
                <Edit className="h-4 w-4 mr-2" />
                Complete Human Evaluation
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const sectorInfo = professionalSectors.find(
    (s) => s.value === task.ProfessionalSector
  );

  const progressPercentage =
    rubricQuestions.length > 0
      ? Math.round((completedCount / rubricQuestions.length) * 100)
      : 0;

  const versionName = getCurrentRubricVersionName(task as AirtableTaskRecord);

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
                Model Evaluate Gemini
              </h1>
              <Badge
                className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                variant="outline"
              >
                Step 5
              </Badge>
              <Badge
                variant="outline"
                className="text-purple-600 border-purple-600"
              >
                Using {versionName}
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

      {/* Instructions */}
      <Card className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-amber-600" />
            <span>Model Evaluation Process</span>
          </CardTitle>
          <CardDescription>
            How to get the model&apos;s evaluation of the Gemini response
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start space-x-2">
            <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              1
            </span>
            <span>Copy the rubric checker prompt below to your AI tool</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              2
            </span>
            <span>The AI will evaluate each rubric criterion with Yes/No</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              3
            </span>
            <span>Input the model&apos;s responses in the form below</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              4
            </span>
            <span>Submit to calculate alignment and continue the workflow</span>
          </div>
        </CardContent>
      </Card>

      {/* Rubric Checker Prompt */}
      <Card className="bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle>{versionName} Rubric Checker Prompt</CardTitle>
                <CardDescription>
                  Copy this prompt to your AI tool to get model evaluation
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyPromptToClipboard}
              >
                {promptCopied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {promptCopied ? "Copied!" : "Copy"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPromptVisible(!promptVisible)}
              >
                {promptVisible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {promptVisible ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {promptVisible && (
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Textarea
                  value={checkerPrompt}
                  readOnly
                  className="min-h-[400px] font-mono text-xs bg-background/50 resize-none"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Progress Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Model Evaluation Progress
                </h3>
                <p className="text-sm text-muted-foreground">
                  {completedCount} of {rubricQuestions.length} questions
                  answered
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">
                  {progressPercentage}%
                </p>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Main Evaluation Section */}
      <div className="min-h-0">
        <div className="space-y-6">
          {/* Evaluation Questions */}
          <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="h-5 w-5 text-green-600" />
                <span>Model Evaluation Input</span>
              </CardTitle>
              <CardDescription>
                Input the model&apos;s Yes/No responses for each {versionName}{" "}
                criterion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-96 space-y-4">
                {rubricQuestions.map((question, index) => {
                  const currentValue = form.watch(
                    `evaluations.${question.key}`
                  );

                  return (
                    <div
                      key={question.key}
                      className={cn(
                        "space-y-3 p-4 rounded-lg border transition-all duration-200",
                        currentValue
                          ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20"
                          : "border-border/30 bg-background/30"
                      )}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 space-y-2">
                          <p className="text-sm font-medium leading-relaxed text-foreground">
                            {question.question}
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {question.tag}
                          </Badge>
                        </div>
                      </div>

                      <div className="ml-9">
                        <RadioGroup
                          value={currentValue || ""}
                          onValueChange={(value) => {
                            form.setValue(
                              `evaluations.${question.key}`,
                              value as "Yes" | "No"
                            );
                          }}
                          className="flex items-center space-x-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="Yes"
                              id={`${question.key}-yes`}
                              className="text-green-600 border-green-600"
                            />
                            <Label
                              htmlFor={`${question.key}-yes`}
                              className={cn(
                                "flex items-center space-x-2 cursor-pointer text-sm",
                                currentValue === "Yes" &&
                                  "text-green-600 font-medium"
                              )}
                            >
                              <ThumbsUp className="h-4 w-4" />
                              <span>Yes</span>
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="No"
                              id={`${question.key}-no`}
                              className="text-red-600 border-red-600"
                            />
                            <Label
                              htmlFor={`${question.key}-no`}
                              className={cn(
                                "flex items-center space-x-2 cursor-pointer text-sm",
                                currentValue === "No" &&
                                  "text-red-600 font-medium"
                              )}
                            >
                              <ThumbsDown className="h-4 w-4" />
                              <span>No</span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Submit Section */}
          <Card className="bg-background/80 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/dashboard/tasks/${taskId}`)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <div className="flex items-center space-x-4">
                  <div className="text-sm text-muted-foreground text-right">
                    <p>
                      {completedCount}/{rubricQuestions.length} questions
                      completed
                    </p>
                  </div>
                  <Button
                    onClick={() => onSubmit(form.getValues())}
                    disabled={
                      isSubmitting || completedCount !== rubricQuestions.length
                    }
                    className="min-w-[200px]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Calculating Alignment...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Submit & Calculate</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
