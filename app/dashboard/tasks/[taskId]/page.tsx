"use client";

import React, { useState } from "react";
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
  ExternalLink,
  FileText,
  Bot,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  XCircle,
  BarChart3,
  Target,
  Globe,
  Shield,
  Loader2,
  AlertCircle,
  Edit,
  // Download,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import { getStatusDisplayInfo } from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { toast } from "sonner";

// Type guards and utility functions for safe data parsing
const safeParseJSON = (jsonString: string | undefined | null) => {
  if (!jsonString || typeof jsonString !== "string") return null;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return null;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safeToString = (value: any): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value.toString();
  return String(value);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safeToNumber = (value: any): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

interface MisalignedItem {
  id: string;
  tag: string;
  question: string;
  humanScore: boolean;
  aiScore: boolean;
}

export default function TaskDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [showGPTResponse, setShowGPTResponse] = useState(false);
  const [showGeminiResponse, setShowGeminiResponse] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);

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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copied to clipboard!`);
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        toast.error("Failed to copy to clipboard");
      });
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const getSectorInfo = (sector: string) => {
    return professionalSectors.find((s) => s.value === sector);
  };

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

  // Safe data extraction with type guards
  const statusInfo = getStatusDisplayInfo(task.Status);
  const sectorInfo = getSectorInfo(safeToString(task.ProfessionalSector));
  const progress = task.Status === "Completed" ? 100 : 50;

  // Safe parsing of rubric data
  const rubricData = safeParseJSON(safeToString(task.Rubric));
  const misalignedItems: MisalignedItem[] =
    safeParseJSON(safeToString(task.MisalignedItems)) || [];

  const rubricCount = rubricData ? Object.keys(rubricData).length : 0;
  const alignmentPercentage = safeToNumber(task.AlignmentPercentage);

  // Safe string extraction for display
  const taskPrompt = safeToString(task.Prompt);
  const gptResponse = safeToString(task.GPTResponse);
  const geminiResponse = safeToString(task.GeminiResponse);
  const taskSources = safeToString(task.Sources);
  const licenseNotes = safeToString(task.LicenseNotes);
  const comments = safeToString(task.Comments);
  const trainerEmail = safeToString(task.TrainerEmail);
  const taskIdDisplay = safeToString(task.TaskID);
  const createdDate = safeToString(task.Created);

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
                {taskIdDisplay}
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
              Detailed view of your evaluation task and results
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {task.Status === "Task Creation" && (
            <Button asChild>
              <Link href={`/dashboard/tasks/${taskId}/rubric`}>
                <Edit className="w-4 h-4 mr-2" />
                Create Rubric
              </Link>
            </Button>
          )}
          {/* <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button> */}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50/50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600/80">Status</p>
                <p className="font-medium text-blue-700 dark:text-blue-400">
                  {statusInfo.label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50/50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-green-600/80">Progress</p>
                <p className="font-medium text-green-700 dark:text-green-400">
                  {progress}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {task.Status === "Completed" && rubricCount > 0 && (
          <Card className="bg-gradient-to-br from-purple-50/50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-purple-600/80">Rubric Items</p>
                  <p className="font-medium text-purple-700 dark:text-purple-400">
                    {rubricCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {task.Status === "Completed" &&
          task.AlignmentPercentage !== undefined && (
            <Card className="bg-gradient-to-br from-amber-50/50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="text-sm text-amber-600/80">Alignment</p>
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      {alignmentPercentage}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Task Prompt */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Task Prompt</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(taskPrompt, "Task Prompt")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrompt(!showPrompt)}
                  >
                    {showPrompt ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <CardDescription>
                The original task description and requirements
              </CardDescription>
            </CardHeader>
            {showPrompt && (
              <CardContent>
                <div className="prose dark:prose-invert max-w-none">
                  <div className="p-4 bg-muted/30 rounded-lg border border-border/30 whitespace-pre-wrap font-mono text-sm">
                    {taskPrompt}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* AI Responses */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* GPT Response */}
            <Card className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <Bot className="h-5 w-5 text-green-600" />
                    <span>GPT Response</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(gptResponse, "GPT Response")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowGPTResponse(!showGPTResponse)}
                    >
                      {showGPTResponse ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  OpenAI GPT model response to the task
                </CardDescription>
              </CardHeader>
              {showGPTResponse && (
                <CardContent>
                  <div className="p-4 bg-background/50 rounded-lg border border-border/30 max-h-96 overflow-y-auto">
                    <div className="whitespace-pre-wrap font-mono text-sm">
                      {gptResponse}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Gemini Response */}
            <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <Bot className="h-5 w-5 text-blue-600" />
                    <span>Gemini Response</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(geminiResponse, "Gemini Response")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowGeminiResponse(!showGeminiResponse)}
                    >
                      {showGeminiResponse ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Google Gemini model response to the task
                </CardDescription>
              </CardHeader>
              {showGeminiResponse && (
                <CardContent>
                  <div className="p-4 bg-background/50 rounded-lg border border-border/30 max-h-96 overflow-y-auto">
                    <div className="whitespace-pre-wrap font-mono text-sm">
                      {geminiResponse}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Evaluation Results - Only show if completed */}
          {task.Status === "Completed" && rubricData && (
            <Card className="bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                  <span>Evaluation Results</span>
                </CardTitle>
                <CardDescription>
                  Detailed rubric evaluation and human-AI alignment analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Alignment Summary */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 bg-background/50 rounded-lg border border-border/30">
                    <p className="text-2xl font-bold text-purple-600">
                      {rubricCount}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Rubric Items
                    </p>
                  </div>
                  <div className="text-center p-4 bg-background/50 rounded-lg border border-border/30">
                    <p className="text-2xl font-bold text-green-600">
                      {alignmentPercentage}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      H-AI Alignment
                    </p>
                  </div>
                  <div className="text-center p-4 bg-background/50 rounded-lg border border-border/30">
                    <p className="text-2xl font-bold text-red-600">
                      {misalignedItems.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Misaligned</p>
                  </div>
                </div>

                {/* Alignment Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Human-AI Alignment Score</span>
                    <span className="font-medium">
                      {alignmentPercentage}% •{" "}
                      {alignmentPercentage >= 80
                        ? "Excellent"
                        : "Needs Improvement"}
                    </span>
                  </div>
                  <Progress value={alignmentPercentage} className="h-3" />
                </div>

                {/* Misaligned Items */}
                {misalignedItems.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground flex items-center space-x-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span>Misaligned Rubric Items</span>
                    </h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {misalignedItems.map((item, index) => (
                        <div
                          key={index}
                          className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {item.question}
                              </p>
                              <div className="flex items-center space-x-4 mt-1 text-xs">
                                <Badge
                                  variant="outline"
                                  className="text-red-600 border-red-600"
                                >
                                  {item.tag}
                                </Badge>
                                <span className="text-muted-foreground">
                                  Human: {item.humanScore ? "Yes" : "No"} • AI:{" "}
                                  {item.aiScore ? "Yes" : "No"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments */}
                {comments && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">
                      Evaluation Comments
                    </h4>
                    <div className="p-4 bg-background/50 rounded-lg border border-border/30">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {comments}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Metadata */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Task Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">ID</span>
                  <span className="text-sm font-mono">{taskIdDisplay}</span>
                </div>

                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={statusInfo.color} variant="outline">
                    {statusInfo.label}
                  </Badge>
                </div>

                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">Sector</span>
                  <div className="flex items-center space-x-1">
                    {sectorInfo && (
                      <span className="text-sm">{sectorInfo.icon}</span>
                    )}
                    <span className="text-sm">
                      {safeToString(task.ProfessionalSector)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">
                    Progress
                  </span>
                  <span className="text-sm font-medium">{progress}%</span>
                </div>

                {createdDate && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-muted-foreground">
                      Created
                    </span>
                    <span className="text-sm">{formatDate(createdDate)}</span>
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <span className="text-sm text-muted-foreground">Trainer</span>
                  <span className="text-sm font-mono">
                    {trainerEmail.split("@")[0]}
                  </span>
                </div>
              </div>

              {/* Progress Visualization */}
              <div className="space-y-2 pt-4 border-t border-border/30">
                <div className="flex items-center justify-between text-sm">
                  <span>Task Progress</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {progress === 100
                    ? "Evaluation completed"
                    : "Ready for rubric creation"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Sources & Licensing */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-lg">
                <Shield className="h-5 w-5" />
                <span>Sources & Licensing</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Google Drive Sources
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => window.open(taskSources, "_blank")}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    <span className="truncate">View Source Materials</span>
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </Button>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    License Status
                  </p>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Open Source Confirmed</span>
                  </div>
                </div>

                {licenseNotes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      License Notes
                    </p>
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                      <p className="text-xs text-muted-foreground">
                        {licenseNotes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Next Actions */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Next Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.Status === "Task Creation" ? (
                <div className="space-y-3">
                  <Button asChild className="w-full">
                    <Link href={`/dashboard/tasks/${taskId}/rubric`}>
                      <Edit className="w-4 h-4 mr-2" />
                      Create Evaluation Rubric
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Create rubric questions to evaluate the AI responses and
                    calculate human-AI alignment.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/dashboard/tasks/submitted">
                      <FileText className="w-4 h-4 mr-2" />
                      View All Tasks
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/dashboard/tasks/new">
                      <FileText className="w-4 h-4 mr-2" />
                      Create New Task
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This task is completed. You can view the results or create
                    new evaluation tasks.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
