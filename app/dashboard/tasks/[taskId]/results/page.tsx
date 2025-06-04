"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  AlertCircle,
  Trophy,
  Loader2,
  FileText,
  Bot,
  User,
  BarChart3,
  CheckCircle,
  X,
  Calendar,
  TrendingUp,
  Download,
  Eye,
  EyeOff,
  Target,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import { getStatusDisplayInfo } from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { cn } from "@/lib/utils";

interface RubricQuestion {
  key: string;
  question: string;
  number: number;
}

interface EvaluationResult {
  question: string;
  humanScore: "Yes" | "No";
  modelScore: "Yes" | "No";
  isAligned: boolean;
}

export default function TaskResultsPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [showPrompt, setShowPrompt] = useState(false);

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

  if (taskLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Loading Results...
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading task results...</p>
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

  // Check if task is completed
  if (task.Status !== "Completed") {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Task Not Completed
            </h1>
          </div>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Results Not Available</AlertTitle>
          <AlertDescription>
            This task has not been completed yet. Current status:{" "}
            {getStatusDisplayInfo(task.Status).label}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 ml-2"
              onClick={() => router.push(`/dashboard/tasks/${taskId}`)}
            >
              Continue Task
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Parse evaluation data
  const parseRubricQuestions = (): RubricQuestion[] => {
    if (!task.Rubric_V2) return [];
    try {
      if (typeof task.Rubric_V2 === "string") {
        const rubric = JSON.parse(task.Rubric_V2);
        return Object.entries(rubric)
          .filter(([key]) => key.startsWith("rubric_"))
          .map(([key, question]) => ({
            key,
            question: String(question),
            number: parseInt(key.replace("rubric_", "")),
          }))
          .sort((a, b) => a.number - b.number);
      }
      return [];
    } catch {
      return [];
    }
  };

  const parseEvaluationResults = (
    humanScores: string,
    modelScores: string,
    rubricQuestions: RubricQuestion[]
  ): EvaluationResult[] => {
    try {
      const human = JSON.parse(humanScores);
      const model = JSON.parse(modelScores);

      return rubricQuestions.map((q) => ({
        question: q.question,
        humanScore: human[q.key] as "Yes" | "No",
        modelScore: model[q.key] as "Yes" | "No",
        isAligned: human[q.key] === model[q.key],
      }));
    } catch {
      return [];
    }
  };

  const rubricQuestions = parseRubricQuestions();
  const geminiResults =
    task.Human_Eval_Gemini && task.Model_Eval_Gemini
      ? parseEvaluationResults(
          task.Human_Eval_Gemini as string,
          task.Model_Eval_Gemini as string,
          rubricQuestions
        )
      : [];
  const gptResults =
    task.Human_Eval_GPT && task.Model_Eval_GPT
      ? parseEvaluationResults(
          task.Human_Eval_GPT as string,
          task.Model_Eval_GPT as string,
          rubricQuestions
        )
      : [];

  const sectorInfo = professionalSectors.find(
    (s) => s.value === task.ProfessionalSector
  );

  const geminiAlignment = (task.Alignment_Gemini as number) || 0;
  const gptAlignment = (task.Alignment_GPT as number) || 0;
  const averageAlignment = Math.round((geminiAlignment + gptAlignment) / 2);

  const exportResults = () => {
    const exportData = {
      taskId: task.TaskID,
      created: task.Created,
      sector: task.ProfessionalSector,
      prompt: task.Prompt,
      geminiAlignment: geminiAlignment,
      gptAlignment: gptAlignment,
      averageAlignment: averageAlignment,
      rubricQuestions: rubricQuestions.length,
      geminiResults: geminiResults,
      gptResults: gptResults,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `task-results-${task.TaskID}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Evaluation Results
              </h1>
              <Badge
                className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                variant="outline"
              >
                <Trophy className="w-3 h-3 mr-1" />
                Completed
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
              {(task.Created && typeof task.Created === "string") ||
                typeof task.Created === "number" ||
                (task.Created instanceof Date && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Completed {new Date(task.Created).toLocaleDateString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={exportResults}>
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/tasks/${taskId}`)}
          >
            <FileText className="w-4 h-4 mr-2" />
            View Task Details
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Overall Performance */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Overall Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-primary">
                  {averageAlignment}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Average Alignment
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Rubric Items</span>
                  <span className="font-medium">{rubricQuestions.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Completion Date</span>
                  <span className="font-medium">
                    {(task.Created && typeof task.Created === "string") ||
                    typeof task.Created === "number" ||
                    task.Created instanceof Date
                      ? new Date(task.Created as string).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gemini Results */}
        <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-green-600" />
              <span>Gemini Alignment</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-green-600">
                  {geminiAlignment}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Human-AI Agreement
                </p>
              </div>
              <Progress value={geminiAlignment} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>Status</span>
                <span
                  className={cn(
                    "font-medium",
                    geminiAlignment >= 80 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {geminiAlignment >= 80 ? "✓ Passed" : "⚠ Below Threshold"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GPT Results */}
        <Card className="bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-orange-600" />
              <span>GPT Alignment</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-orange-600">
                  {gptAlignment}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Human-AI Agreement
                </p>
              </div>
              <Progress value={gptAlignment} className="h-2" />
              <div className="flex justify-between text-sm">
                <span>Status</span>
                <span className="font-medium text-blue-600">
                  📊 Analysis Complete
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Task Overview */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Task Overview</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPrompt(!showPrompt)}
            >
              {showPrompt ? (
                <EyeOff className="h-4 w-4 mr-2" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              {showPrompt ? "Hide" : "Show"} Prompt
            </Button>
          </div>
        </CardHeader>
        {showPrompt && (
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <div className="bg-muted/30 p-4 rounded-lg border border-border/30">
                <p className="text-sm leading-relaxed">{task.Prompt}</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Detailed Results */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Detailed Analysis</span>
          </CardTitle>
          <CardDescription>
            Compare AI responses and view detailed rubric evaluation results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="comparison" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="comparison">Model Comparison</TabsTrigger>
              <TabsTrigger value="gemini">Gemini Analysis</TabsTrigger>
              <TabsTrigger value="gpt">GPT Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="comparison" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Gemini Response */}
                <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Bot className="h-5 w-5 text-green-600" />
                      <span>Gemini Response</span>
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600"
                      >
                        {geminiAlignment}% Aligned
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose dark:prose-invert max-w-none text-sm">
                      <div className="bg-background/50 p-4 rounded-lg border border-border/30 max-h-64 overflow-y-auto">
                        <ReactMarkdown>{task.GeminiResponse}</ReactMarkdown>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* GPT Response */}
                <Card className="bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-200 dark:border-orange-800">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Bot className="h-5 w-5 text-orange-600" />
                      <span>GPT Response</span>
                      <Badge
                        variant="outline"
                        className="text-orange-600 border-orange-600"
                      >
                        {gptAlignment}% Aligned
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose dark:prose-invert max-w-none text-sm">
                      <div className="bg-background/50 p-4 rounded-lg border border-border/30 max-h-64 overflow-y-auto">
                        <ReactMarkdown>{task.GPTResponse}</ReactMarkdown>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Alignment Comparison */}
              <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <span>Alignment Comparison</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Gemini Alignment</span>
                          <span className="font-semibold text-green-600">
                            {geminiAlignment}%
                          </span>
                        </div>
                        <Progress value={geminiAlignment} className="h-2" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>GPT Alignment</span>
                          <span className="font-semibold text-orange-600">
                            {gptAlignment}%
                          </span>
                        </div>
                        <Progress value={gptAlignment} className="h-2" />
                      </div>
                    </div>
                    <div className="text-center p-4 bg-primary/5 rounded-lg">
                      <p className="text-lg font-semibold text-primary">
                        Average Alignment: {averageAlignment}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {averageAlignment >= 80
                          ? "Strong agreement between human and AI evaluations"
                          : averageAlignment >= 60
                          ? "Moderate agreement between evaluations"
                          : "Low agreement - may need rubric refinement"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gemini" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Gemini Evaluation Breakdown
                  </h3>
                  <Badge
                    className="text-green-600 border-green-600"
                    variant="outline"
                  >
                    {geminiResults.filter((r) => r.isAligned).length}/
                    {geminiResults.length} Aligned
                  </Badge>
                </div>

                {geminiResults.map((result, index) => (
                  <Card
                    key={index}
                    className={cn(
                      "border transition-all duration-200",
                      result.isAligned
                        ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20"
                        : "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start space-x-3">
                          <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">
                            {index + 1}
                          </span>
                          <p className="text-sm font-medium leading-relaxed text-foreground">
                            {result.question}
                          </p>
                        </div>

                        <div className="ml-9 flex items-center space-x-6">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">Human:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                result.humanScore === "Yes"
                                  ? "text-green-600 border-green-600"
                                  : "text-red-600 border-red-600"
                              )}
                            >
                              {result.humanScore}
                            </Badge>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Bot className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium">AI:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                result.modelScore === "Yes"
                                  ? "text-green-600 border-green-600"
                                  : "text-red-600 border-red-600"
                              )}
                            >
                              {result.modelScore}
                            </Badge>
                          </div>

                          <div className="flex items-center space-x-2">
                            {result.isAligned ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-red-600" />
                            )}
                            <span
                              className={cn(
                                "text-sm font-medium",
                                result.isAligned
                                  ? "text-green-600"
                                  : "text-red-600"
                              )}
                            >
                              {result.isAligned ? "Aligned" : "Misaligned"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="gpt" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    GPT Evaluation Breakdown
                  </h3>
                  <Badge
                    className="text-orange-600 border-orange-600"
                    variant="outline"
                  >
                    {gptResults.filter((r) => r.isAligned).length}/
                    {gptResults.length} Aligned
                  </Badge>
                </div>

                {gptResults.map((result, index) => (
                  <Card
                    key={index}
                    className={cn(
                      "border transition-all duration-200",
                      result.isAligned
                        ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20"
                        : "border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20"
                    )}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start space-x-3">
                          <span className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">
                            {index + 1}
                          </span>
                          <p className="text-sm font-medium leading-relaxed text-foreground">
                            {result.question}
                          </p>
                        </div>

                        <div className="ml-9 flex items-center space-x-6">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">Human:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                result.humanScore === "Yes"
                                  ? "text-green-600 border-green-600"
                                  : "text-red-600 border-red-600"
                              )}
                            >
                              {result.humanScore}
                            </Badge>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Bot className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium">AI:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                result.modelScore === "Yes"
                                  ? "text-green-600 border-green-600"
                                  : "text-red-600 border-red-600"
                              )}
                            >
                              {result.modelScore}
                            </Badge>
                          </div>

                          <div className="flex items-center space-x-2">
                            {result.isAligned ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-red-600" />
                            )}
                            <span
                              className={cn(
                                "text-sm font-medium",
                                result.isAligned
                                  ? "text-green-600"
                                  : "text-red-600"
                              )}
                            >
                              {result.isAligned ? "Aligned" : "Misaligned"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
