"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  AlertCircle,
  Bot,
  Loader2,
  ArrowRight,
  Copy,
  CheckCircle,
  Eye,
  EyeOff,
  Target,
  Edit,
  CheckCircle2,
  X,
  AlertTriangle,
  Check,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  getStatusDisplayInfo,
  getCurrentRubricVersionName,
  AirtableTaskRecord,
} from "@/lib/schemas/task";
import {
  generateRubricCheckerPrompt,
  validateEvaluationJSON,
} from "@/lib/utils/rubric-prompts";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { cn } from "@/lib/utils";

import {
  parseCurrentRubricQuestions,
  getEvaluationPrerequisites,
  loadExistingEvaluationScores,
  type RubricQuestion,
} from "@/lib/utils/evaluation-utils";

interface ModelEvalFormData {
  taskId: string;
  jsonInput: string;
}

export default function ModelEvalGeminiPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [rubricQuestions, setRubricQuestions] = useState<RubricQuestion[]>([]);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonWarnings, setJsonWarnings] = useState<string[]>();
  const [jsonValid, setJsonValid] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [validationSummary, setValidationSummary] = useState<any>(null);

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
      jsonInput: "",
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

      if (Object.keys(existingEvals).length > 0) {
        const jsonString = JSON.stringify(existingEvals);
        setJsonInput(jsonString);
        form.setValue("jsonInput", jsonString);
      }
    }
  }, [task, form]);

  useEffect(() => {
    if (!jsonInput.trim() || rubricQuestions.length === 0) {
      setJsonError("");
      setJsonWarnings([]);
      setJsonValid(false);
      setValidationSummary(null);
      return;
    }

    const validation = validateEvaluationJSON(
      jsonInput,
      rubricQuestions.length
    );

    if (validation.isValid) {
      setJsonError("");
      setJsonValid(true);
    } else {
      setJsonError(validation.errors.join("; "));
      setJsonValid(false);
    }

    setJsonWarnings(validation.warnings || []);
    setValidationSummary(validation.summary);
  }, [jsonInput, rubricQuestions.length]);

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

  const handleJsonInputChange = (value: string) => {
    setJsonInput(value);
    form.setValue("jsonInput", value);
  };

  const exampleJson = useMemo(() => {
    if (rubricQuestions.length === 0) return "";

    const example: Record<string, string> = {};
    rubricQuestions.forEach((q, index) => {
      example[q.key] = index % 2 === 0 ? "Yes" : "No";
    });
    return JSON.stringify(example);
  }, [rubricQuestions]);

  // Form submission
  const onSubmit = async (data: ModelEvalFormData) => {
    if (!jsonValid) {
      toast.error("Please fix JSON validation errors before submitting");
      return;
    }
    setIsSubmitting(true);

    try {
      await updateModelEvalMutation.mutateAsync({
        taskId: data.taskId,
        modelScores: jsonInput,
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

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Edit className="h-5 w-5" />
                  <span>Model Evaluation Response</span>
                </CardTitle>
                <CardDescription>
                  Paste the JSON response from your AI tool below
                </CardDescription>
              </div>
              {jsonValid && (
                <Badge
                  variant={"outline"}
                  className="text-green-600 border-green-600"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valid JSON
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {exampleJson && (
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Expected JSON Format:
                </Label>
                <code className="text-xs text-muted-foreground break-all">
                  {exampleJson}
                </code>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="jsonInput">AI Model Response (JSON)</Label>
              <Textarea
                id="jsonInput"
                value={jsonInput}
                onChange={(e) => handleJsonInputChange(e.target.value)}
                placeholder={`Paste the AI's JSON response here... \n\nExample:\n${exampleJson}`}
                className={cn(
                  "font-mono text-sm min-h-32",
                  jsonError && "border-red-500",
                  jsonValid && "border-green-500",
                  jsonWarnings &&
                    jsonWarnings.length > 0 &&
                    !jsonError &&
                    "border-yellow-500"
                )}
              />
              {jsonError && (
                <Alert variant="destructive">
                  <X className="h-4 w-4" />
                  <AlertTitle>JSON Validation Error</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <div>{jsonError}</div>
                    {validationSummary && (
                      <div className="text-xs mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded border">
                        <strong>Summary:</strong> {validationSummary.totalKeys}{" "}
                        keys found, {validationSummary.validKeys} valid,{" "}
                        {validationSummary.invalidKeys} invalid
                        {validationSummary.missingKeys > 0 &&
                          `, ${validationSummary.missingKeys} missing`}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {jsonWarnings && jsonWarnings.length > 0 && !jsonError && (
                <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                    Validation Warnings
                  </AlertTitle>
                  <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                    <ul className="list-disc list-inside space-y-1">
                      {jsonWarnings.map((warning, index) => (
                        <li key={index} className="text-sm">
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {jsonValid && validationSummary && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                  <Check className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800 dark:text-green-200">
                    JSON Valid
                  </AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                    All {validationSummary.validKeys} rubric responses provided
                    correctly with valid Yes/No values.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {rubricQuestions.length > 0 && (
              <div className="flex items-center space-x-4 pt-2">
                <span className="text-sm text-muted-foreground">
                  Expected {rubricQuestions.length} rubric responses
                </span>
                {jsonValid && (
                  <Badge variant={"secondary"} className="text-green-600">
                    All {rubricQuestions.length} responses provided
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant={"outline"}
            onClick={() => router.back()}
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !jsonValid}
            className="min-w-32"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                Submit Evaluation
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
