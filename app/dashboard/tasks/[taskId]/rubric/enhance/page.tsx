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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle,
  Edit3,
  FileText,
  Lightbulb,
  RefreshCw,
  Target,
  AlertTriangle,
  History,
  RotateCcw,
  Eye,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import {
  getStatusDisplayInfo,
  getCurrentRubricVersionName,
  validateRubricJSON,
  AirtableTaskRecord,
  AlignmentHistoryEntry,
  parseRubricContent,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { cn } from "@/lib/utils";

interface RubricEnhanceFormData {
  taskId: string;
  rubricContent: string;
  targetVersion: number;
}

interface RubricQuestion {
  key: string;
  question: string;
  tag: string;
  number: number;
}

export default function RubricEnhancePage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rubricValidation, setRubricValidation] = useState<{
    isValid: boolean;
    errors: string[];
    rubricCount: number;
  }>({ isValid: false, errors: [], rubricCount: 0 });

  const [previousRubricQuestions, setPreviousRubricQuestions] = useState<
    RubricQuestion[]
  >([]);
  const [previousVersionName, setPreviousVersionName] = useState<string>("");
  const [loadedRubricContent, setLoadedRubricContent] = useState<string>("");

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
  const form = useForm<RubricEnhanceFormData>({
    defaultValues: {
      taskId,
      rubricContent: "",
      targetVersion: 2,
    },
  });

  // Load existing rubric content and determine target version
  useEffect(() => {
    if (task) {
      const currentVersion = task.Current_Rubric_Version || 1;
      const isCreatingV2 = task.Status === "Rubric_V1";
      const targetVersion = isCreatingV2 ? 2 : currentVersion + 1;

      form.setValue("targetVersion", targetVersion);

      // Smart fallback logic: Try to find the best available rubric version
      let rubricToLoad: string | undefined;
      let versionLoaded = currentVersion;

      if (isCreatingV2) {
        // Creating V2: Load V1 as starting point
        rubricToLoad = task.Rubric_V1 as string;
        versionLoaded = 1;
      } else {
        // Creating V3+: Try current version first, then fall back systematically
        // Try V3, V2, V1 in that order until we find one
        for (let v = currentVersion; v >= 1; v--) {
          const fieldName = `Rubric_V${v}`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rubricContent = (task as any)[fieldName] as string;
          if (rubricContent) {
            rubricToLoad = rubricContent;
            versionLoaded = v;
            break;
          }
        }
      }

      if (rubricToLoad) {
        setLoadedRubricContent(rubricToLoad);
        form.setValue("rubricContent", rubricToLoad);
        setPreviousVersionName(`V${versionLoaded}`);

        // Parse the rubric to show as list items
        try {
          const rubric = parseRubricContent(rubricToLoad);
          if (rubric) {
            const questions = Object.entries(rubric)
              .filter(([key]) => key.startsWith("rubric_"))
              .map(([key, rubricItem]) => ({
                key,
                question: rubricItem.question,
                tag: rubricItem.tag,
                number: parseInt(key.replace("rubric_", "")),
              }))
              .sort((a, b) => a.number - b.number);

            setPreviousRubricQuestions(questions);
          }
        } catch (error) {
          console.error("Error parsing rubric content:", error);
          setPreviousRubricQuestions([]);
        }

        // Validate the loaded content
        const validation = validateRubricJSON(rubricToLoad);
        setRubricValidation(validation);
      } else {
        // No rubric found - show error
        setRubricValidation({
          isValid: false,
          errors: ["No previous rubric version found to enhance from."],
          rubricCount: 0,
        });
        setPreviousRubricQuestions([]);
        setPreviousVersionName("");
      }
    }
  }, [task, form]);

  // Watch for rubric content changes and validate
  const rubricContent = form.watch("rubricContent");
  useEffect(() => {
    if (rubricContent && rubricContent.trim()) {
      const validation = validateRubricJSON(rubricContent);
      setRubricValidation(validation);
    } else {
      setRubricValidation({ isValid: false, errors: [], rubricCount: 0 });
    }
  }, [rubricContent]);

  // Function to load the previous version back into the editor
  const loadPreviousVersion = () => {
    if (loadedRubricContent) {
      form.setValue("rubricContent", loadedRubricContent);
      toast.success(`${previousVersionName} rubric loaded into editor`);
    }
  };

  // Mutation for updating enhanced rubric
  const updateRubricMutation = api.tasks.updateRubricEnhanced.useMutation({
    onSuccess: (data) => {
      toast.success(
        `${
          data.isCreatingV2
            ? "V2 Rubric created"
            : `V${data.version} Rubric enhanced`
        } successfully!`,
        {
          description: data.message,
        }
      );
      setIsSubmitting(false);
      // Navigate to human evaluation
      router.push(`/dashboard/tasks/${taskId}/evaluation/human-gemini`);
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast.error("Failed to save enhanced rubric", {
        description: error.message,
      });
    },
  });

  // Form submission
  const onSubmit = async (data: RubricEnhanceFormData) => {
    if (!rubricValidation.isValid) {
      toast.error("Please fix rubric validation errors before submitting");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateRubricMutation.mutateAsync({
        taskId: data.taskId,
        rubricContent: data.rubricContent,
        targetVersion: data.targetVersion,
      });
    } catch (error) {
      console.error("Rubric enhancement submission error:", error);
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
  if (!["Rubric_V1", "Rubric_Enhancing"].includes(task.Status)) {
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

  const currentVersion = task.Current_Rubric_Version || 1;
  const isCreatingV2 = task.Status === "Rubric_V1";
  const targetVersion = isCreatingV2 ? 2 : currentVersion + 1;
  const versionName = getCurrentRubricVersionName(task as AirtableTaskRecord);
  const sectorInfo = professionalSectors.find(
    (s) => s.value === task.ProfessionalSector
  );

  // Parse alignment history
  let alignmentHistory: AlignmentHistoryEntry[] = [];
  try {
    if (task.Alignment_History && typeof task.Alignment_History === "string") {
      alignmentHistory = JSON.parse(task.Alignment_History);
    }
  } catch (error) {
    console.error("Error parsing alignment history:", error);
  }

  const lastAlignment = alignmentHistory[alignmentHistory.length - 1];

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
                  ? "Enhance to V2 Rubric"
                  : `Create V${targetVersion} Rubric`}
              </h1>
              <Badge
                className={cn(
                  "text-white",
                  isCreatingV2
                    ? "bg-gradient-to-r from-indigo-500 to-indigo-600"
                    : "bg-gradient-to-r from-amber-500 to-amber-600"
                )}
                variant="outline"
              >
                {isCreatingV2 ? "Step 3" : `Iteration ${targetVersion}`}
              </Badge>
              {!isCreatingV2 && (
                <Badge
                  variant="outline"
                  className="text-amber-600 border-amber-600"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Improving Alignment
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
              <div className="flex items-center space-x-1">
                <Target className="w-3 h-3" />
                <span>Target: V{targetVersion}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Alert */}
      {isCreatingV2 ? (
        <Alert className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200 dark:border-indigo-800">
          <Edit3 className="h-4 w-4 text-indigo-600" />
          <AlertTitle className="text-indigo-800 dark:text-indigo-400">
            Creating V2 Rubric
          </AlertTitle>
          <AlertDescription className="text-indigo-700 dark:text-indigo-300">
            Enhance your V1 rubric by making criteria more specific, actionable,
            and objectively measurable. Focus on clarity and reducing ambiguity
            for better human-AI alignment.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-400">
            Alignment Improvement Required
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            {versionName} achieved {lastAlignment?.alignment || 0}% alignment
            with {lastAlignment?.misalignedCount || 0} misaligned items. Create
            V{targetVersion} to improve alignment ≥80% before proceeding to GPT
            evaluation.
          </AlertDescription>
        </Alert>
      )}

      {/* Alignment History (for iterations) */}
      {alignmentHistory.length > 0 && (
        <Card className="bg-gradient-to-br from-sky-50/40 to-sky-100/40 dark:from-sky-900/20 dark:to-sky-800/20 border-sky-500/30 dark:border-sky-700/30">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <History className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              <span>Alignment Progress</span>
            </CardTitle>
            <CardDescription>
              Previous rubric versions and their alignment results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-6">
              {alignmentHistory.map((entry) => (
                <div
                  key={entry.version}
                  className="flex flex-col items-center p-3 bg-background/50 rounded-lg border border-border/30"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2",
                      entry.alignment >= 80
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    )}
                  >
                    V{entry.version}
                  </div>
                  <p className="text-lg font-bold text-center">
                    {entry.alignment}%
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    {entry.misalignedCount} issues
                  </p>
                </div>
              ))}

              {/* Target indicator */}
              <div className="flex flex-col items-center p-3 bg-green-50/30 dark:bg-green-950/10 rounded-lg border border-green-200 dark:border-green-800 border-dashed">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <Target className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-center text-green-600">
                  80%
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Target
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhancement Instructions */}
      <Card className="bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5 text-purple-600" />
            <span>Enhancement Guidelines</span>
          </CardTitle>
          <CardDescription>
            How to improve your rubric for better alignment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start space-x-2">
            <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              1
            </span>
            <span>
              Review the {previousVersionName} rubric on the left - click
              &ldquo;Load&rdquo; to restore it anytime
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              2
            </span>
            <span>
              Modify each criterion in the JSON editor for clarity and precision
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              3
            </span>
            <span>
              Ensure each question can be answered objectively as Yes/No
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mt-0.5">
              4
            </span>
            <span>
              Split complex criteria into simpler, atomic requirements
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Left-Right Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Previous Rubric Display */}
        <Card className="bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-950/20 dark:to-slate-900/20 border-slate-200 dark:border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-slate-600" />
                  <span>{previousVersionName} Rubric</span>
                </CardTitle>
                <CardDescription>
                  {previousRubricQuestions.length} criteria available as
                  starting point
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreviousVersion}
                disabled={!loadedRubricContent}
                className="shrink-0"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Load
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="">
              {previousRubricQuestions.length > 0 ? (
                <div className="space-y-3">
                  {previousRubricQuestions.map((question, index) => (
                    <div
                      key={question.key}
                      className="p-3 bg-background/50 rounded-lg border border-border/30"
                    >
                      <div className="flex items-start space-x-3">
                        <span className="bg-slate-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium mt-0.5 shrink-0">
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
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No Previous Rubric Found
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Unable to load a previous version as starting point
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: JSON Editor */}
        <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>V{targetVersion} Rubric JSON Editor</span>
            </CardTitle>
            <CardDescription>
              Edit the JSON to create your enhanced V{targetVersion} rubric
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rubricContent">Enhanced Rubric JSON</Label>
              <Textarea
                id="rubricContent"
                value={rubricContent}
                onChange={(e) => form.setValue("rubricContent", e.target.value)}
                placeholder={`{
  "rubric_1": {
    "question": "Does the response clearly explain the main concept?",
    "tag": "clarity"
  },
  "rubric_2": {
    "question": "Does the response provide specific examples?",
    "tag": "examples"
  },
  ...
}`}
                className="min-h-[300px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                💡 Use the Load button on the left to restore the{" "}
                {previousVersionName} rubric anytime
              </p>
            </div>

            {/* Validation Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Validation Status</span>
                <Badge
                  variant={rubricValidation.isValid ? "default" : "destructive"}
                  className={
                    rubricValidation.isValid
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : ""
                  }
                >
                  {rubricValidation.isValid ? (
                    <CheckCircle className="w-3 h-3 mr-1" />
                  ) : (
                    <AlertCircle className="w-3 h-3 mr-1" />
                  )}
                  {rubricValidation.isValid
                    ? `Valid (${rubricValidation.rubricCount} items)`
                    : "Invalid"}
                </Badge>
              </div>

              {rubricValidation.isValid && (
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-2 text-sm text-green-700 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      Rubric is valid with {rubricValidation.rubricCount}{" "}
                      criteria in the new format
                    </span>
                  </div>
                </div>
              )}

              {!rubricValidation.isValid &&
                rubricValidation.errors.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-sm font-medium text-red-700 dark:text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>Validation Errors:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm text-red-600 dark:text-red-400 ml-6">
                        {rubricValidation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                {rubricValidation.isValid ? (
                  <p className="text-green-600 dark:text-green-400">
                    ✓ Ready for submission
                  </p>
                ) : (
                  <p className="text-red-600 dark:text-red-400">
                    Fix validation errors first
                  </p>
                )}
              </div>
              <Button
                onClick={() => onSubmit(form.getValues())}
                disabled={isSubmitting || !rubricValidation.isValid}
                className="min-w-[200px]"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving V{targetVersion}...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>Save V{targetVersion} Rubric</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
