/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Bot,
  User,
  Save,
  BarChart3,
  Copy,
  Lightbulb,
  Zap,
  Target,
  Info,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  generateRubricDecomposerPrompt,
  generateRubricCheckerPrompt,
  calculateAlignment,
  formatRubricForSubmission,
  type RubricItem,
} from "@/lib/utils/rubric-prompts";

// Custom debounce hook for performance
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Rubric Schema
const RubricItemSchema = z.object({
  id: z.string(),
  question: z
    .string()
    .min(10, "Rubric question must be at least 10 characters"),
  tag: z
    .string()
    .min(1, "Tag is required")
    .max(20, "Tag must be 20 characters or less"),
  humanScore: z.boolean().optional(),
  aiScore: z.boolean().optional(),
});

const RubricFormSchema = z.object({
  rubricItems: z
    .array(RubricItemSchema)
    .min(1, "At least one rubric item is required"),
  comments: z
    .string()
    .max(1000, "Comments must be less than 1000 characters")
    .optional(),
});

type RubricFormData = z.infer<typeof RubricFormSchema>;

export default function RubricCreationPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Force validation updates by using a counter that triggers recalculation
  const [validationTrigger, setValidationTrigger] = useState(0);

  const currentFormValuesRef = useRef<RubricFormData>({
    rubricItems: [
      {
        id: crypto.randomUUID(),
        question: "",
        tag: "",
        humanScore: undefined,
        aiScore: undefined,
      },
    ],
    comments: "",
  });

  const {
    data: task,
    isLoading: taskLoading,
    error: taskError,
  } = api.tasks.getTaskById.useQuery(
    { taskId },
    {
      enabled: !!taskId,
    }
  );

  const updateRubricMutation = api.tasks.updateRubric.useMutation({
    onSuccess: () => {
      toast.success("Rubric created successfully!", {
        description: "Task has been marked as completed.",
      });
      setIsSubmitting(false);
      router.push(`/dashboard/tasks/${taskId}`);
    },
    onError: (error) => {
      setIsSubmitting(false);
      setSubmitError(
        error.message || "An error occurred while creating the rubric."
      );
      toast.error("Failed to create rubric", {
        description: error.message,
      });
    },
  });

  const form = useForm<RubricFormData>({
    resolver: zodResolver(RubricFormSchema),
    defaultValues: {
      rubricItems: [
        {
          id: crypto.randomUUID(),
          question: "",
          tag: "",
          humanScore: undefined,
          aiScore: undefined,
        },
      ],
      comments: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rubricItems",
  });

  const calculateValidationState = useCallback(
    (items: RubricFormData["rubricItems"]) => {
      if (!items)
        return {
          validCount: 0,
          scoredCount: 0,
          alignmentPercentage: 0,
          misalignedItems: [],
          hasMinimumRubrics: false,
          hasAllScores: false,
          hasMinimumAlignment: false,
        };

      const validItems = items.filter(
        (item) => item?.question?.trim() && item?.tag?.trim()
      );

      const scoredItems = validItems.filter(
        (item) => item?.humanScore !== undefined && item?.aiScore !== undefined
      );

      const alignedItems = scoredItems.filter(
        (item) => item.humanScore === item.aiScore
      );

      const misalignedItems = scoredItems
        .filter((item) => item.humanScore !== item.aiScore)
        .map((item) => ({
          id: item.id,
          tag: item.tag,
          question: item.question,
        }));

      const alignmentPercentage =
        scoredItems.length > 0
          ? Math.round((alignedItems.length / scoredItems.length) * 100)
          : 0;

      return {
        validCount: validItems.length,
        scoredCount: scoredItems.length,
        alignmentPercentage,
        misalignedItems,
        hasMinimumRubrics: validItems.length >= 15,
        hasAllScores:
          scoredItems.length >= 15 && scoredItems.length === validItems.length,
        hasMinimumAlignment: alignmentPercentage >= 80,
      };
    },
    []
  );

  useEffect(() => {
    const subscription = form.watch((value) => {
      currentFormValuesRef.current = value as RubricFormData;

      setValidationTrigger((prev) => prev + 1);
    });

    currentFormValuesRef.current = form.getValues();

    return () => subscription.unsubscribe();
  }, [form]);

  const watchedRubricItems = form.watch("rubricItems");
  const debouncedRubricItems = useDebounce(watchedRubricItems, 300);

  const validationState = useMemo(() => {
    return calculateValidationState(currentFormValuesRef.current.rubricItems);
  }, [calculateValidationState, validationTrigger]);

  const debouncedValidationState = useMemo(() => {
    return calculateValidationState(debouncedRubricItems);
  }, [debouncedRubricItems, calculateValidationState]);

  const displayValidationState =
    validationState.validCount > 0 ? validationState : debouncedValidationState;

  const canSubmit = useMemo(() => {
    return (
      validationState.hasMinimumRubrics &&
      validationState.hasAllScores &&
      validationState.hasMinimumAlignment
    );
  }, [validationState]);

  const rubricDecomposerPrompt = useMemo(() => {
    return task
      ? generateRubricDecomposerPrompt({
          Prompt: task.Prompt,
          GeminiResponse: task.GeminiResponse,
          GPTResponse: task.GPTResponse,
        })
      : "";
  }, [task]);

  const rubricCheckerPrompt = useMemo(() => {
    if (!task) return "";

    if (validationState.validCount < 15) return "";

    const validItems = currentFormValuesRef.current.rubricItems?.filter(
      (item) => item?.question?.trim() && item?.tag?.trim()
    ) as RubricItem[];

    return generateRubricCheckerPrompt(
      {
        Prompt: task.Prompt,
        GeminiResponse: task.GeminiResponse,
        GPTResponse: task.GPTResponse,
      },
      validItems || []
    );
  }, [task, validationState.validCount]);

  const copyToClipboard = useCallback((text: string, label: string) => {
    if (!text) {
      toast.error("No content to copy");
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copied to clipboard!`);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        toast.error("Failed to copy to clipboard");
      });
  }, []);

  const addRubricItem = useCallback(() => {
    append({
      id: crypto.randomUUID(),
      question: "",
      tag: "",
      humanScore: undefined,
      aiScore: undefined,
    });
  }, [append]);

  const onSubmit = async (data: RubricFormData) => {
    if (!task) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const validItems = data.rubricItems.filter(
        (item) => item.question?.trim() && item.tag?.trim()
      ) as RubricItem[];

      const alignment = calculateAlignment(validItems);

      if (!validationState.hasMinimumRubrics) {
        setSubmitError(
          `Need at least 15 valid rubric items. Currently have ${validationState.validCount}.`
        );
        setIsSubmitting(false);
        return;
      }

      if (!validationState.hasAllScores) {
        setSubmitError(
          `All ${validationState.validCount} rubric items must be scored.`
        );
        setIsSubmitting(false);
        return;
      }

      if (!validationState.hasMinimumAlignment) {
        setSubmitError(
          `Minimum 80% human-AI alignment required. Current: ${validationState.alignmentPercentage}%`
        );
        setIsSubmitting(false);
        return;
      }

      const formattedRubric = formatRubricForSubmission(validItems);

      const rubricData = {
        taskId: task.TaskID,
        rubric: formattedRubric.rubricJson,
        humanScores: formattedRubric.humanScoresJson,
        aiScores: formattedRubric.aiScoresJson,
        alignmentPercentage: alignment.alignmentPercentage,
        misalignedItems: JSON.stringify(alignment.misalignedItems),
        comments: data.comments || "",
      };

      await updateRubricMutation.mutateAsync(rubricData);
    } catch (error) {
      console.error("Submission error:", error);
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
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (task.Status !== "Task Creation") {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Rubric Already Created
            </h1>
          </div>
        </div>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Task Status</AlertTitle>
          <AlertDescription>
            This task has already progressed beyond the rubric creation stage.
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => router.push(`/dashboard/tasks/${taskId}`)}
            >
              View Task Details
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Create Evaluation Rubric
              </h1>
              <Badge variant="outline">{task.TaskID}</Badge>
            </div>
            <p className="text-muted-foreground">
              Create rubric questions and score AI responses (minimum 15 items,
              80% alignment required)
            </p>
          </div>
        </div>

        {displayValidationState.alignmentPercentage > 0 &&
          displayValidationState.hasMinimumRubrics && (
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Human-AI Alignment
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {displayValidationState.alignmentPercentage}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      {/* Error and progress alerts */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Submission Error</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Progress Alert */}
      {(!displayValidationState.hasMinimumRubrics ||
        !displayValidationState.hasAllScores ||
        !displayValidationState.hasMinimumAlignment) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Submission Requirements</AlertTitle>
          <AlertDescription>
            <div className="space-y-1 mt-2">
              <div className="flex items-center space-x-2">
                {displayValidationState.hasMinimumRubrics ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>
                  At least 15 rubric items ({displayValidationState.validCount}
                  /15)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {displayValidationState.hasAllScores ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>
                  All items scored ({displayValidationState.scoredCount}/
                  {displayValidationState.validCount})
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {displayValidationState.hasMinimumAlignment ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>
                  Minimum 80% alignment (
                  {displayValidationState.alignmentPercentage}%)
                </span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rubric Decomposer Helper */}
          <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="h-5 w-5 text-blue-600" />
                <span>Step 1: Generate Initial Rubrics with AI</span>
              </CardTitle>
              <CardDescription>
                Copy this prompt to Gemini to get your first set of rubric
                questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-background/50 rounded-lg border border-border/30 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    Rubric Decomposer Prompt
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        rubricDecomposerPrompt,
                        "Rubric Decomposer Prompt"
                      )
                    }
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Prompt
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto text-xs font-mono bg-muted/30 p-2 rounded">
                  {rubricDecomposerPrompt.substring(0, 300)}...
                </div>
              </div>

              <div className="flex items-center space-x-2 text-sm text-blue-600">
                <Target className="h-4 w-4" />
                <span>
                  Paste this in Gemini, then copy the generated rubrics back
                  here
                </span>
              </div>
            </CardContent>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Rubric Items */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Evaluation Rubric Items</span>
                    <Badge
                      variant={
                        displayValidationState.validCount >= 15
                          ? "default"
                          : "outline"
                      }
                    >
                      {displayValidationState.validCount} / 15 minimum
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Create binary (Yes/No) questions to evaluate the AI
                    responses
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="p-4 border border-border/50 rounded-lg bg-muted/20 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">
                          Rubric Item #{index + 1}
                        </h4>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`rubricItems.${index}.question`}
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Evaluation Question *</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Does the response clearly explain...?"
                                  className="bg-background/50"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Write a clear Yes/No question to evaluate the AI
                                response
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`rubricItems.${index}.tag`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Capability Tag *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="accuracy, clarity, etc."
                                  className="bg-background/50"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                One word describing what this evaluates
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Scoring Section - Show only when item has question and tag */}
                      {form.watch(`rubricItems.${index}.question`) &&
                        form.watch(`rubricItems.${index}.tag`) && (
                          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-border/30">
                            <FormField
                              control={form.control}
                              name={`rubricItems.${index}.humanScore`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center space-x-2">
                                    <User className="h-4 w-4" />
                                    <span>Human Score</span>
                                  </FormLabel>
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        checked={field.value === true}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange(true);
                                          } else if (field.value === true) {
                                            field.onChange(undefined);
                                          }
                                        }}
                                      />
                                      <label className="text-sm">Yes</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        checked={field.value === false}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange(false);
                                          } else if (field.value === false) {
                                            field.onChange(undefined);
                                          }
                                        }}
                                      />
                                      <label className="text-sm">No</label>
                                    </div>
                                  </div>
                                  <FormDescription>
                                    Your evaluation of the AI response
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`rubricItems.${index}.aiScore`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="flex items-center space-x-2">
                                    <Bot className="h-4 w-4" />
                                    <span>AI Score</span>
                                  </FormLabel>
                                  <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        checked={field.value === true}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange(true);
                                          } else if (field.value === true) {
                                            field.onChange(undefined);
                                          }
                                        }}
                                      />
                                      <label className="text-sm">Yes</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        checked={field.value === false}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange(false);
                                          } else if (field.value === false) {
                                            field.onChange(undefined);
                                          }
                                        }}
                                      />
                                      <label className="text-sm">No</label>
                                    </div>
                                  </div>
                                  <FormDescription>
                                    AI evaluator&apos;s assessment
                                  </FormDescription>
                                </FormItem>
                              )}
                            />

                            {/* Alignment Indicator */}
                            {form.watch(`rubricItems.${index}.humanScore`) !==
                              undefined &&
                              form.watch(`rubricItems.${index}.aiScore`) !==
                                undefined && (
                                <div className="md:col-span-2 flex items-center space-x-2 text-sm">
                                  {form.watch(
                                    `rubricItems.${index}.humanScore`
                                  ) ===
                                  form.watch(`rubricItems.${index}.aiScore`) ? (
                                    <>
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                      <span className="text-green-600">
                                        Aligned
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 text-red-600" />
                                      <span className="text-red-600">
                                        Misaligned
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                          </div>
                        )}
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRubricItem}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rubric Item
                  </Button>
                </CardContent>
              </Card>

              {/* Rubric Checker Helper - Only show when ready */}
              {displayValidationState.validCount >= 15 && (
                <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Zap className="h-5 w-5 text-green-600" />
                      <span>Step 2: Get Rubric Checker System Prompt</span>
                    </CardTitle>
                    <CardDescription>
                      Use this prompt to automatically evaluate responses with
                      your rubric
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-background/50 rounded-lg border border-border/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">
                          Rubric Checker System Prompt
                        </h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(
                              rubricCheckerPrompt,
                              "Rubric Checker Prompt"
                            )
                          }
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Prompt
                        </Button>
                      </div>
                      <div className="max-h-48 overflow-y-auto text-xs font-mono bg-muted/30 p-2 rounded whitespace-pre-wrap">
                        {rubricCheckerPrompt}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-green-600">
                      <Target className="h-4 w-4" />
                      <span>
                        Replace {"{model_answer}"} with the response you want to
                        evaluate
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Comments */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle>Additional Comments</CardTitle>
                  <CardDescription>
                    Optional notes about the evaluation process
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional observations or notes about the evaluation..."
                            className="bg-background/50 min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-6 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting || !canSubmit}
                  className="min-w-[120px]"
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Save className="w-4 h-4" />
                      <span>Complete Evaluation</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Sidebar - Progress Summary */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Progress Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Rubric Items</span>
                  <span
                    className={
                      displayValidationState.validCount >= 15
                        ? "text-green-600 font-medium"
                        : ""
                    }
                  >
                    {displayValidationState.validCount} / 15 required
                  </span>
                </div>
                <Progress
                  value={Math.min(
                    (displayValidationState.validCount / 15) * 100,
                    100
                  )}
                  className="h-2"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Scored Items</span>
                  <span>
                    {displayValidationState.scoredCount} /{" "}
                    {displayValidationState.validCount}
                  </span>
                </div>
                <Progress
                  value={
                    displayValidationState.validCount > 0
                      ? (displayValidationState.scoredCount /
                          displayValidationState.validCount) *
                        100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              {displayValidationState.alignmentPercentage > 0 &&
                displayValidationState.validCount >= 15 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Human-AI Alignment</span>
                      <span
                        className={`font-bold ${
                          displayValidationState.alignmentPercentage >= 80
                            ? "text-green-600"
                            : "text-amber-600"
                        }`}
                      >
                        {displayValidationState.alignmentPercentage}%
                      </span>
                    </div>
                    <Progress
                      value={displayValidationState.alignmentPercentage}
                      className="h-2"
                    />
                  </div>
                )}

              {displayValidationState.misalignedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    Misaligned Items (
                    {displayValidationState.misalignedItems.length}):
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {displayValidationState.misalignedItems.map((item, idx) => (
                      <Badge
                        key={idx}
                        variant="destructive"
                        className="text-xs mr-1 mb-1"
                      >
                        {item.tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guidelines */}
          <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <span>Guidelines</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Use the AI prompt to generate initial rubrics</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Create clear Yes/No questions</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Focus on one capability per rubric</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Score both human and AI assessments</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Minimum 15 rubric items required</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <span>Achieve 80% minimum human-AI alignment</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
