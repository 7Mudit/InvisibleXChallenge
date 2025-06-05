"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  AlertCircle,
  User,
  Loader2,
  ArrowRight,
  FileText,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  Edit,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import { getStatusDisplayInfo, AirtableTaskRecord } from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { cn } from "@/lib/utils";

// Import our reusable utilities
import {
  parseCurrentRubricQuestions,
  getEvaluationPrerequisites,
  loadExistingEvaluationScores,
  type RubricQuestion,
} from "@/lib/utils/evaluation-utils";

interface HumanEvalFormData {
  taskId: string;
  evaluations: Record<string, "Yes" | "No">;
}

export default function HumanEvalGPTPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const form = useForm<HumanEvalFormData>({
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

      // Load existing evaluations if available
      const existingEvals = loadExistingEvaluationScores(
        task as AirtableTaskRecord,
        "human-gpt",
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

  // Mutation for updating human evaluation
  const updateHumanEvalMutation = api.tasks.updateHumanEvalGPT.useMutation({
    onSuccess: (data) => {
      toast.success("Human evaluation for GPT saved successfully!", {
        description: data.message,
      });
      setIsSubmitting(false);
      // Navigate to model evaluation for GPT
      router.push(`/dashboard/tasks/${taskId}/evaluation/model-gpt`);
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast.error("Failed to save human evaluation", {
        description: error.message,
      });
    },
  });

  // Form submission
  const onSubmit = async (data: HumanEvalFormData) => {
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
    const humanScores = JSON.stringify(data.evaluations);

    try {
      await updateHumanEvalMutation.mutateAsync({
        taskId: data.taskId,
        humanScores,
      });
    } catch (error) {
      console.error("Human evaluation submission error:", error);
    }
  };

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
  if (
    "Model_Eval_Gemini" !== task.Status ||
    (task.Alignment_Gemini as number) < 80
  ) {
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
            This task is not in the correct state for human evaluation. Current
            status: {getStatusDisplayInfo(task.Status).label}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Check for required prerequisites using dynamic validation
  const prerequisites = getEvaluationPrerequisites(
    task as AirtableTaskRecord,
    "human-gpt"
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
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cannot Proceed to GPT Evaluation</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>Missing requirements:</p>
              <ul className="list-disc list-inside space-y-1">
                {prerequisites.missingItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  if (!prerequisites.hasAlignment) {
                    router.push(`/dashboard/tasks/${taskId}/rubric/enhance`);
                  } else {
                    router.push(
                      `/dashboard/tasks/${taskId}/evaluation/model-gemini`
                    );
                  }
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                {!prerequisites.hasAlignment
                  ? "Enhance Rubric"
                  : "Complete Gemini Evaluation"}
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
                Human Evaluate GPT
              </h1>
              <Badge
                className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                variant="outline"
              >
                Step 6
              </Badge>
              <Badge
                variant="outline"
                className="text-purple-600 border-purple-600"
              >
                Using {prerequisites.versionName}
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
              <div className="flex items-center space-x-1">
                <FileText className="w-3 h-3" />
                <span>{rubricQuestions.length} criteria</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gemini Alignment Success Alert */}
      <Alert className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800 dark:text-green-400">
          Gemini Evaluation Complete
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          {`Gemini alignment: ${prerequisites.alignmentValue}% ✓ (≥80% required). Now
          evaluate the GPT response using the same ${prerequisites.versionName} rubric.`}
        </AlertDescription>
      </Alert>

      {/* Top Section: Task Prompt and Instructions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Task Overview */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Task Prompt</span>
            </CardTitle>
            <CardDescription>
              The original task you need to evaluate the GPT response against
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-sm text-foreground leading-relaxed bg-muted/30 p-4 rounded-lg">
                {task.Prompt}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Evaluation Instructions */}
        <Card className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              <span>How to Evaluate</span>
            </CardTitle>
            <CardDescription>
              Use the same criteria you used for Gemini evaluation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start space-x-2">
              <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
                1
              </span>
              <span>
                Read each {prerequisites.versionName} rubric question carefully
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
                2
              </span>
              <span>
                Check if the GPT response meets that specific criterion
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
                3
              </span>
              <span>
                Answer &ldquo;Yes&rdquo; if met, &ldquo;No&rdquo; if not met
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
                4
              </span>
              <span>
                Apply the same standards you used for Gemini evaluation
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  GPT Evaluation Progress
                </h3>
                <p className="text-sm text-muted-foreground">
                  {completedCount} of {rubricQuestions.length} questions
                  answered using {prerequisites.versionName}
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

      {/* Main Evaluation Section: Form Container */}
      <div className="min-h-0 max-h-[800px]">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* GPT Response + Questions Grid */}
          <div className="grid gap-6 lg:grid-cols-2 min-h-0">
            {/* Left: GPT Response */}
            <Card className="bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-200 dark:border-orange-800 min-h-0">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bot className="h-5 w-5 text-orange-600" />
                  <span>GPT Response</span>
                </CardTitle>
                <CardDescription>
                  The GPT AI response you&apos;re evaluating with{" "}
                  {prerequisites.versionName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose dark:prose-invert max-w-none text-sm">
                  <div className="bg-background/50  p-4 rounded-lg border border-border/30">
                    <ReactMarkdown
                      components={{
                        // Custom markdown components for better styling
                        h1: ({ children }) => (
                          <h1 className="text-lg font-bold mb-2">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-base font-semibold mb-2">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-sm font-medium mb-1">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="mb-2 leading-relaxed">{children}</p>
                        ),
                        code: ({ children }) => (
                          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="bg-muted p-3 rounded overflow-x-auto text-xs">
                            {children}
                          </pre>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside mb-2 space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside mb-2 space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="text-sm">{children}</li>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {task.GPTResponse}
                    </ReactMarkdown>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right: Evaluation Questions */}
            <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800 min-h-0">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <span>{prerequisites.versionName} Evaluation Questions</span>
                </CardTitle>
                <CardDescription>
                  Answer each question based on the GPT response
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rubricQuestions.map((question, index) => {
                  const currentValue = form.watch(
                    `evaluations.${question.key}`
                  );

                  return (
                    <div
                      key={question.key}
                      className="space-y-3 p-4 rounded-lg border border-border/30 bg-background/30"
                    >
                      <div className="flex items-start space-x-3">
                        <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">
                          {index + 1}
                        </span>
                        <p className="text-sm font-medium leading-relaxed text-foreground">
                          {question.question}
                        </p>
                      </div>

                      <div className="ml-9">
                        <RadioGroup
                          value={currentValue || ""}
                          onValueChange={(value) => {
                            form.setValue(
                              `evaluations.${question.key}`,
                              value as "Yes" | "No"
                            );
                            // Force re-render to update progress immediately
                            form.trigger(`evaluations.${question.key}`);
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
              </CardContent>
            </Card>
          </div>

          {/* Submit Section */}
          <Card className="bg-background/80 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/tasks/${taskId}`)}
                  disabled={isSubmitting}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <div className="flex items-center space-x-4">
                  <div className="text-sm text-muted-foreground">
                    {completedCount}/{rubricQuestions.length} questions
                    completed using {prerequisites.versionName}
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting || completedCount !== rubricQuestions.length
                    }
                    className="min-w-[200px]"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving Evaluation...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Save & Continue</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
