"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  FileText,
  Globe,
  Shield,
  Bot,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Eye,
  Copy,
  FolderOpen,
  Upload,
} from "lucide-react";

import {
  CreateTaskSchema,
  CreateTaskInput,
  getWorkflowSteps,
  getStatusDisplayInfo,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { api } from "@/lib/trpc/client";
import { generateTaskId } from "@/lib/utils/task-utils";
import { useUser } from "@auth0/nextjs-auth0";

const BASE_DRIVE_URL =
  "https://drive.google.com/drive/u/5/folders/1wSO7QbJnuCiqXMntin1OooihJqkY0fae";

export default function NewTaskPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generatedTaskId, setGeneratedTaskId] = useState<string>("");
  const router = useRouter();
  const { user } = useUser();

  const workflowSteps = getWorkflowSteps();

  // Generate TaskID on component mount
  useEffect(() => {
    const taskId = generateTaskId();
    setGeneratedTaskId(taskId);
  }, []);

  // Query for existing incomplete tasks
  const {
    data: existingTasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = api.tasks.getMyTasks.useQuery();

  // Check if user has any incomplete tasks
  const incompleteTasks =
    existingTasks?.filter((task) => task.Status !== "Completed") || [];
  const hasIncompleteTasks = incompleteTasks.length > 0;
  const currentIncompleteTask = incompleteTasks[0];

  const createTaskMutation = api.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Task created successfully!", {
        description: "You can now view it in your submitted tasks.",
      });
      setIsSubmitting(false);
      router.push("/dashboard/tasks/submitted");
    },
    onError: (error) => {
      setIsSubmitting(false);

      // Handle the specific CONFLICT error for existing incomplete tasks
      if (error.data?.code === "CONFLICT") {
        // Parse structured error message: "INCOMPLETE_TASK_EXISTS:TASK-123:Status:Label"
        if (error.message.startsWith("INCOMPLETE_TASK_EXISTS:")) {
          const parts = error.message.split(":");
          if (parts.length >= 4) {
            const existingTaskId = parts[1];
            const existingTaskStatusLabel = parts[3];

            setSubmitError(
              `You already have an incomplete task (${existingTaskId}) in status "${existingTaskStatusLabel}". Please complete your current task before creating a new one.`
            );

            toast.error("Cannot create new task", {
              description: `Complete task ${existingTaskId} first`,
              action: {
                label: "View Task",
                onClick: () =>
                  router.push(`/dashboard/tasks/${existingTaskId}`),
              },
            });
          } else {
            // Fallback if message format is unexpected
            setSubmitError(error.message);
            toast.error("Cannot create new task", {
              description:
                "You have an incomplete task that must be completed first.",
            });
          }
        } else {
          // Generic conflict error
          setSubmitError(error.message);
          toast.error("Cannot create new task", {
            description: error.message,
          });
        }
      } else {
        setSubmitError(
          error.message || "An error occurred while creating the task."
        );
        toast.error("Failed to create task", {
          description: error.message,
        });
      }
    },
  });

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      TaskID: generatedTaskId,
      Prompt: "",
      ProfessionalSector: undefined,
      Sources: "",
      OpenSourceConfirmed: false,
      LicenseNotes: "",
      GPTResponse: "",
      GeminiResponse: "",
    },
  });

  // Update form when taskId is generated
  useEffect(() => {
    if (generatedTaskId) {
      form.setValue("TaskID", generatedTaskId);
    }
  }, [generatedTaskId, form]);

  const onSubmit = async (data: CreateTaskInput) => {
    if (hasIncompleteTasks) {
      toast.error("Cannot create new task", {
        description:
          "You have an incomplete task that must be completed first.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createTaskMutation.mutateAsync(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const selectedSector = professionalSectors.find(
    (sector) => sector.value === form.watch("ProfessionalSector")
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // Show loading state while checking for existing tasks
  if (tasksLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Create New Task
            </h1>
            <p className="text-muted-foreground">
              Checking your existing tasks...
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if failed to load tasks
  if (tasksError) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Create New Task
            </h1>
          </div>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Tasks</AlertTitle>
            <AlertDescription>{tasksError.message}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Create New Task
          </h1>
          <p className="text-muted-foreground">
            Create a new evaluation task with AI model responses.
          </p>
        </div>

        {/* Task ID Display */}
        {generatedTaskId && (
          <div className="bg-muted/30 border border-border/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Generated Task ID
                </h3>
                <p className="text-lg font-mono text-primary">
                  {generatedTaskId}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(generatedTaskId)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
        )}

        {/*  Incomplete Task Warning */}
        {hasIncompleteTasks && currentIncompleteTask && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Cannot Create New Task</AlertTitle>
            <AlertDescription>
              You already have an incomplete task (
              {currentIncompleteTask.TaskID}) in status &ldquo;
              {getStatusDisplayInfo(currentIncompleteTask.Status).label}&rdquo;.
              Please complete your current task before creating a new one.
              <div className="mt-3 flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/dashboard/tasks/${currentIncompleteTask.TaskID}`
                    )
                  }
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Current Task
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard/tasks/submitted")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View All Tasks
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Show server error if any */}
        {submitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Submission Error</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Only show form if no incomplete tasks exist */}
      {!hasIncompleteTasks ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Task Description */}
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Prompt</span>
                    </CardTitle>
                    <CardDescription>
                      Provide a detailed description of the task.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="Prompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prompt *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the task that needs to be evaluated. Be specific about requirements, expected outputs..."
                              className="min-h-[120px] bg-background/50"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Provide a clear, detailed description of what you
                            want the AI to accomplish.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Professional Sector */}
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle>Professional Sector</CardTitle>
                    <CardDescription>
                      Select the sector that best matches your task.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="ProfessionalSector"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sector *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-background/50">
                                <SelectValue placeholder="Select a professional sector" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {professionalSectors.map((sector) => (
                                <SelectItem
                                  key={sector.value}
                                  value={sector.value}
                                >
                                  <div className="flex items-center space-x-2">
                                    <span>{sector.icon}</span>
                                    <span>{sector.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedSector && (
                            <div className="mt-2 p-3 bg-muted/30 rounded-lg border border-border/30">
                              <p className="text-sm text-muted-foreground">
                                <strong>{selectedSector.label}:</strong>{" "}
                                {selectedSector.description}
                              </p>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* AI Model Responses */}
                <Card className="bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Bot className="h-5 w-5 text-purple-600" />
                      <span>AI Model Responses</span>
                    </CardTitle>
                    <CardDescription>
                      Provide the complete responses from both GPT and Gemini
                      models.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="GPTResponse"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GPT Response *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Paste the complete response from GPT model here..."
                              className="min-h-[120px] bg-background/50 font-mono text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Include the full response exactly as provided by
                            GPT.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="GeminiResponse"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gemini Response *</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Paste the complete response from Gemini model here..."
                              className="min-h-[120px] bg-background/50 font-mono text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Include the full response exactly as provided by
                            Gemini.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Sources and Licensing */}
                <Card className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Globe className="h-5 w-5" />
                      <span>Sources & Licensing</span>
                    </CardTitle>
                    <CardDescription>
                      Upload source materials to Google Drive and confirm
                      licensing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="Sources"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Google Drive URL *</FormLabel>
                          <FormControl>
                            <div className="flex space-x-2">
                              <Input
                                placeholder="https://drive.google.com/drive/folders/..."
                                className="bg-background/50"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  window.open(BASE_DRIVE_URL, "_blank")
                                }
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Upload all source materials to Google Drive and
                            share the folder URL.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="OpenSourceConfirmed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-green-50/50 dark:bg-green-950/20">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Open Source Confirmation *</FormLabel>
                            <FormDescription>
                              I confirm that all sources used are properly
                              licensed for commercial use.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="LicenseNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add any additional notes about licensing or restrictions..."
                              className="bg-background/50"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Document any specific licensing requirements.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Evaluation Process */}
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-lg">
                      <Shield className="h-5 w-5" />
                      <span>Evaluation Process</span>
                    </CardTitle>
                    <CardDescription>
                      Your task will progress through these stages
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {workflowSteps.map((step, index) => {
                        const isActive = index === 0;

                        return (
                          <div
                            key={step.status}
                            className="flex items-start space-x-3"
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                isActive
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium ${
                                  isActive
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {step.label}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {step.description}
                              </p>
                              {isActive && (
                                <Badge
                                  variant="default"
                                  className="text-xs mt-2"
                                >
                                  Current Step
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                {/* Google Drive Setup Instructions */}
                {generatedTaskId && (
                  <Card className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2 text-lg">
                        <FolderOpen className="h-5 w-5 text-blue-600" />
                        <span>Google Drive Setup</span>
                      </CardTitle>
                      <CardDescription>
                        Create the required folder structure for{" "}
                        {generatedTaskId}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                          <p className="text-sm font-medium text-foreground mb-2">
                            1. Go to Base Folder
                          </p>
                          <div className="flex items-center space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(BASE_DRIVE_URL, "_blank")
                              }
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Base Folder
                            </Button>
                          </div>
                        </div>

                        <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                          <p className="text-sm font-medium text-foreground mb-2">
                            2. Create Task Folder
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                {generatedTaskId}
                              </code>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(generatedTaskId)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Create a new folder with this exact name
                            </p>
                          </div>
                        </div>

                        <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                          <p className="text-sm font-medium text-foreground mb-2">
                            3. Create Subfolders Inside {generatedTaskId}
                          </p>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                request
                              </code>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard("request")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                                response
                              </code>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard("response")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <div className="flex items-start space-x-2">
                            <Upload className="h-4 w-4 text-amber-600 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                                Upload Guidelines
                              </p>
                              <ul className="text-xs text-amber-700 dark:text-amber-500 space-y-1">
                                <li>
                                  • Put all artifacts used in{" "}
                                  <code>request</code> folder
                                </li>
                                <li>
                                  • Put all artifacts generated by model in{" "}
                                  <code>response</code> folder
                                </li>
                                <li>• Share the main task folder URL below</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Current User Info */}
                {user && (
                  <Card className="bg-muted/30 border-border/30">
                    <CardHeader>
                      <CardTitle className="text-sm">
                        Trainer Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Email: </span>
                        <span className="font-mono">{user.email}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Name: </span>
                        <span>{user.name}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

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
                disabled={isSubmitting || !generatedTaskId}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Create Task</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        // Alternative content when incomplete tasks exist
        <Card className="bg-gradient-to-br from-muted/30 to-muted/10 border-border/50">
          <CardContent className="py-16">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <Clock className="w-10 h-10 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">
                  Complete Your Current Task First
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You can only work on one task at a time. Please complete your
                  current task &ldquo;{currentIncompleteTask?.TaskID}&rdquo;
                  before creating a new one.
                </p>
              </div>
              <div className="flex justify-center space-x-3">
                <Button
                  size="lg"
                  onClick={() =>
                    router.push(
                      `/dashboard/tasks/${currentIncompleteTask?.TaskID}`
                    )
                  }
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Continue Current Task
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push("/dashboard/tasks/submitted")}
                >
                  <FileText className="w-5  mr-2" />
                  View All Tasks
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
