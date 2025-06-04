"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { debounce } from "lodash";

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
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  AlertCircle,
  Bot,
  Loader2,
  ArrowRight,
  FileText,
  Lightbulb,
  Eye,
  EyeOff,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  RubricV1InputSchema,
  RubricV1Input,
  validateRubricJSON,
  getStatusDisplayInfo,
} from "@/lib/schemas/task";
import { generateRubricDecomposerPrompt } from "@/lib/utils/rubric-prompts";
import { professionalSectors } from "@/constants/ProfessionalSectors";

export default function RubricV1Page() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [rubricValidation, setRubricValidation] = useState<{
    isValid: boolean;
    errors: string[];
    rubricCount: number;
  }>({ isValid: false, errors: [], rubricCount: 0 });

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
  const form = useForm<RubricV1Input>({
    resolver: zodResolver(RubricV1InputSchema),
    defaultValues: {
      taskId,
      rubricV1: "",
    },
  });

  // Load existing V1 rubric if available
  useEffect(() => {
    if (task?.Rubric_V1 && typeof task.Rubric_V1 === "string") {
      form.setValue("rubricV1", task.Rubric_V1);
      setRubricValidation(validateRubricJSON(task.Rubric_V1));
    }
  }, [task, form]);

  // Memoized validation function with caching
  const validateRubricMemoized = useMemo(() => {
    const cache = new Map<
      string,
      { isValid: boolean; errors: string[]; rubricCount: number }
    >();

    return (value: string) => {
      // Check cache first
      if (cache.has(value)) {
        return cache.get(value)!;
      }

      // Validate and cache result
      const result = validateRubricJSON(value);
      cache.set(value, result);

      // Limit cache size to prevent memory leaks
      if (cache.size > 50) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }

      return result;
    };
  }, []);

  // Debounced validation function
  const debouncedValidation = useMemo(
    () =>
      debounce((value: string) => {
        setIsValidating(true);

        if (!value || value.trim().length === 0) {
          setRubricValidation({ isValid: false, errors: [], rubricCount: 0 });
          setIsValidating(false);
          return;
        }

        try {
          const validation = validateRubricMemoized(value);
          setRubricValidation(validation);
        } catch (error) {
          console.error("Validation error:", error);
          setRubricValidation({
            isValid: false,
            errors: ["Validation failed"],
            rubricCount: 0,
          });
        } finally {
          setIsValidating(false);
        }
      }, 500), // 500ms delay
    [validateRubricMemoized]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedValidation.cancel();
    };
  }, [debouncedValidation]);

  // Mutation for updating V1 rubric
  const updateRubricV1Mutation = api.tasks.updateRubricV1.useMutation({
    onSuccess: (data) => {
      toast.success("V1 Rubric saved successfully!", {
        description: data.message,
      });
      setIsSubmitting(false);
      // Navigate to V2 rubric creation
      router.push(`/dashboard/tasks/${taskId}/rubric/v2`);
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast.error("Failed to save V1 rubric", {
        description: error.message,
      });
    },
  });

  // Generate the decomposer prompt
  const decomposerPrompt = task
    ? generateRubricDecomposerPrompt({
        Prompt: task.Prompt,
        GeminiResponse: task.GeminiResponse,
        GPTResponse: task.GPTResponse,
      })
    : "";

  // Copy prompt to clipboard
  const copyPromptToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(decomposerPrompt);
      setPromptCopied(true);
      toast.success("Prompt copied to clipboard!");
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (error) {
      console.error("Error copying the prompt", error);
      toast.error("Failed to copy prompt to clipboard");
    }
  };

  // Handle rubric change with debouncing
  const handleRubricChange = (value: string) => {
    // For empty values, validate immediately for better UX
    if (!value || value.trim().length === 0) {
      setRubricValidation({ isValid: false, errors: [], rubricCount: 0 });
      setIsValidating(false);
      return false;
    }

    // Use debounced validation for non-empty values
    debouncedValidation(value);
    return true; // Return optimistic result
  };

  // Form submission
  const onSubmit = async (data: RubricV1Input) => {
    setIsSubmitting(true);

    // Final validation
    const validation = validateRubricJSON(data.rubricV1);
    if (!validation.isValid) {
      setIsSubmitting(false);
      toast.error("Invalid rubric format", {
        description: validation.errors.join(", "),
      });
      return;
    }

    try {
      await updateRubricV1Mutation.mutateAsync(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Error handling is done in the mutation
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
  if (!["Task_Creation", "Rubric_V1"].includes(task.Status)) {
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
          <AlertTitle>Cannot Create V1 Rubric</AlertTitle>
          <AlertDescription>
            This task is not in the correct state for V1 rubric creation.
            Current status: {getStatusDisplayInfo(task.Status).label}
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
                Create V1 Rubric
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column: Prompt and Instructions */}
            <div className="space-y-6">
              {/* Instructions Card */}
              <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lightbulb className="h-5 w-5 text-blue-600" />
                    <span>Instructions</span>
                  </CardTitle>
                  <CardDescription>
                    How to create your V1 rubric
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
                      1
                    </span>
                    <span>
                      Copy the rubric decomposer prompt below to gemini.
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
                      2
                    </span>
                    <span>
                      The AI will generate a JSON rubric with multiple Yes/No
                      questions
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
                      3
                    </span>
                    <span>
                      Paste the generated JSON into the rubric field and submit
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Rubric Decomposer Prompt */}
              <Card className="bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bot className="h-5 w-5 text-purple-600" />
                      <div>
                        <CardTitle>Rubric Decomposer Prompt</CardTitle>
                        <CardDescription>
                          Copy this prompt to your AI tool to generate the
                          initial rubric
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
                          value={decomposerPrompt}
                          readOnly
                          className="min-h-[400px] font-mono text-xs bg-background/50 resize-none"
                        />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Right Column: Rubric Input */}
            <div className="space-y-6">
              {/* Task Overview */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5" />
                    <span>Task Overview</span>
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
                    <div className="border-t border-border/30 pt-3">
                      <p className="text-xs text-muted-foreground">
                        Gemini Response (first 200 characters)
                      </p>
                      <p className="text-sm text-muted-foreground font-mono bg-muted/30 p-2 rounded mt-1">
                        {task.GeminiResponse.substring(0, 200)}
                        {task.GeminiResponse.length > 200 && "..."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rubric Input */}
              <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle>V1 Rubric JSON</CardTitle>
                  <CardDescription>
                    Paste the generated rubric JSON from your AI tool
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="rubricV1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rubric JSON *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder='{"rubric_1": "Does the response clearly explain...?", "rubric_2": "Does the response provide specific examples?", ...}'
                            className="min-h-[300px] font-mono text-sm bg-background/50"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              handleRubricChange(e.target.value);
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          Must be valid JSON with 15-50 rubric items (rubric_1,
                          rubric_2, etc.)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Validation Status */}
                  {form.watch("rubricV1") && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center space-x-2">
                        {isValidating ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : rubricValidation.isValid ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            isValidating
                              ? "text-muted-foreground"
                              : rubricValidation.isValid
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {isValidating
                            ? "Validating..."
                            : rubricValidation.isValid
                            ? `Valid rubric with ${rubricValidation.rubricCount} items`
                            : "Invalid rubric format"}
                        </span>
                      </div>
                      {!isValidating &&
                        !rubricValidation.isValid &&
                        rubricValidation.errors.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                            <ul className="text-sm text-red-600 space-y-1">
                              {rubricValidation.errors.map((error, index) => (
                                <li key={index}>• {error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}
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
              Back
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || !rubricValidation.isValid}
              className="min-w-[160px]"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Save & Continue</span>
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
