"use client";

import React, { useState } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Lightbulb,
  FileText,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import { generateRubricDecomposerPrompt } from "@/lib/utils/rubric-prompts";
import {
  RubricV1Input,
  RubricV1InputSchema,
  validateRubricJSON,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";

export default function RubricV1Page() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [exampleVisible, setExampleVisible] = useState(false);

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
      taskId: taskId,
      rubricV1: "",
    },
  });

  // Mutation for updating V1 rubric
  const updateRubricV1Mutation = api.tasks.updateRubricV1.useMutation({
    onSuccess: (data) => {
      toast.success("V1 Rubric created successfully! 🎉", {
        description: data.message,
      });
      setIsSubmitting(false);
      // Navigate to enhance rubric page
      router.push(`/dashboard/tasks/${taskId}/rubric/enhance`);
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast.error("Failed to save V1 rubric", {
        description: error.message,
      });
    },
  });

  // Generate the decomposer prompt
  const generatePrompt = () => {
    if (!task) return "";

    const taskData = {
      Prompt: task.Prompt,
      GeminiResponse: task.GeminiResponse,
      GPTResponse: task.GPTResponse,
    };

    return generateRubricDecomposerPrompt(taskData);
  };

  // Copy prompt to clipboard
  const copyPromptToClipboard = async () => {
    const prompt = generatePrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
      toast.success("Prompt copied to clipboard!");
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (error) {
      console.error("Error copying prompt:", error);
      toast.error("Failed to copy prompt to clipboard");
    }
  };

  // Form submission
  const onSubmit = async (data: RubricV1Input) => {
    setIsSubmitting(true);

    try {
      // Validate the new format
      const validation = validateRubricJSON(data.rubricV1);

      if (!validation.isValid) {
        toast.error("Invalid rubric format", {
          description: validation.errors[0],
        });
        setIsSubmitting(false);
        return;
      }

      // Additional validation to ensure it's new format
      try {
        const parsed = JSON.parse(data.rubricV1);
        const hasNewFormat = Object.values(parsed).every(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any) =>
            typeof item === "object" &&
            typeof item.question === "string" &&
            typeof item.tag === "string"
        );

        if (!hasNewFormat) {
          toast.error("Rubric must be in specified format", {
            description:
              "Each rubric item must have 'question' and 'tag' properties",
          });
          setIsSubmitting(false);
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        toast.error("Invalid JSON structure");
        setIsSubmitting(false);
        return;
      }

      await updateRubricV1Mutation.mutateAsync({
        taskId: taskId,
        rubricV1: data.rubricV1,
      });
    } catch (error) {
      console.error("Error submitting V1 rubric:", error);
      toast.error("Failed to save V1 rubric");
      setIsSubmitting(false);
    }
  };

  // Example rubric in new format
  const getExampleRubric = () => {
    return `{
  "rubric_1": {
    "question": "Does the response clearly explain the main concept?",
    "tag": "clarity"
  },
  "rubric_2": {
    "question": "Does the response provide specific examples?",
    "tag": "examples"
  },
  "rubric_3": {
    "question": "Does the response address all parts of the question?",
    "tag": "completeness"
  },
  "rubric_4": {
    "question": "Does the response maintain logical structure?",
    "tag": "structure"
  },
  "rubric_5": {
    "question": "Does the response use accurate information?",
    "tag": "accuracy"
  }
}`;
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

  const sectorInfo = professionalSectors.find(
    (s) => s.value === task.ProfessionalSector
  );

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
                Create V1 Rubric
              </h1>
              <Badge
                className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                variant="outline"
              >
                Step 2
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

      {/* New Format Notice */}
      <Alert className="bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
        <Sparkles className="h-4 w-4 text-purple-600" />
        <AlertTitle className="text-purple-800 dark:text-purple-400">
          Rubric Format Required
        </AlertTitle>
        <AlertDescription className="text-purple-700 dark:text-purple-300">
          Rubrics now use an enhanced format with questions and tags. Each
          rubric item must include both a &ldquo;question&rdquo; and a
          descriptive &ldquo;tag&rdquo; for better organization and analysis.
        </AlertDescription>
      </Alert>

      {/* Instructions */}
      <Card className="bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-amber-600" />
            <span>How to Create V1 Rubric</span>
          </CardTitle>
          <CardDescription>
            Generate your initial rubric using AI assistance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start space-x-2">
            <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              1
            </span>
            <span>Copy the rubric decomposer prompt below to your AI tool</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              2
            </span>
            <span>
              The AI will generate a rubric with question/tag structure
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              3
            </span>
            <span>
              Paste the generated JSON into the form below (15-50 items
              required)
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              4
            </span>
            <span>
              Submit to create your V1 rubric and proceed to enhancement
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Rubric Decomposer Prompt */}
      <Card className="bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle>Rubric Decomposer Prompt</CardTitle>
                <CardDescription>
                  Copy this prompt to your AI tool to generate the V1 rubric
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
                  value={generatePrompt()}
                  readOnly
                  className="min-h-[300px] font-mono text-xs bg-background/50 resize-none"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Example Format */}
      <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              <div>
                <CardTitle>Example</CardTitle>
                <CardDescription>
                  Example of the required rubric format with question/tag
                  structure
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExampleVisible(!exampleVisible)}
            >
              {exampleVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {exampleVisible ? "Hide" : "Show"} Example
            </Button>
          </div>
        </CardHeader>
        {exampleVisible && (
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Textarea
                  value={getExampleRubric()}
                  readOnly
                  className="min-h-[200px] font-mono text-xs bg-background/50 resize-none"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                <p>
                  <strong>Required structure:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>
                    Each rubric item must have &ldquo;question&rdquo; and
                    &ldquo;tag&rdquo; properties
                  </li>
                  <li>Questions must be at least 10 characters long</li>
                  <li>
                    Tags must be 1-20 characters (e.g., &ldquo;clarity&rdquo;,
                    &ldquo;examples&rdquo;, &ldquo;accuracy&rdquo;)
                  </li>
                  <li>Minimum 15 items, maximum 50 items</li>
                  <li>Keys must be sequential: rubric_1, rubric_2, etc.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Main Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>V1 Rubric JSON</span>
              </CardTitle>
              <CardDescription>
                Paste the AI-generated rubric JSON with question/tag structure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="rubricV1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rubric JSON</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Paste your rubric JSON here..."
                        className="min-h-[400px] font-mono text-sm"
                      />
                    </FormControl>
                    <FormDescription>
                      Must contain 15-50 rubric items in : {"{"}
                      &ldquo;rubric_1&rdquo;: {"{"}&ldquo;question&rdquo;:
                      &ldquo;...&rdquo;, &ldquo;tag&rdquo;: &ldquo;...&rdquo;
                      {"}"}
                      {"}"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

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

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-[200px]"
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating V1 Rubric...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span>Create V1 Rubric</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
