"use client";

import React, { useState } from "react";
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
  Loader2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Eye,
  FolderOpen,
  Upload,
  ExternalLinkIcon,
  CheckCircleIcon,
} from "lucide-react";

import {
  CreateTaskSchema,
  CreateTaskInput,
  getWorkflowSteps,
  getStatusDisplayInfo,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { api } from "@/lib/trpc/client";
import { useUser } from "@auth0/nextjs-auth0";
import { DirectFileUpload } from "@/components/DirectFileUpload"; // Import the new component

export default function NewTaskPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [folderInfo, setFolderInfo] = useState<{
    taskId: string;
    taskFolderId: string;
    requestFolderId: string;
    responseGeminiFolderId: string;
    responseGptFolderId: string;
    taskFolderUrl: string;
  } | null>(null);
  const [createdTaskInfo, setCreatedTaskInfo] = useState<{
    taskId: string;
    folderUrl: string;
    requestFileCount: number;
    responseGeminiFileCount: number;
    responseGptFileCount: number;
  } | null>(null);

  const router = useRouter();
  const { user } = useUser();

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      taskId: "",
      Prompt: "",
      ProfessionalSector: undefined,
      OpenSourceConfirmed: false,
      LicenseNotes: "",
      GPTResponse: "",
      GeminiResponse: "",
      requestFiles: [],
      responseGeminiFiles: [],
      responseGptFiles: [],
    },
  });

  const workflowSteps = getWorkflowSteps();

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

  // Mutation to create folder structure
  const createFoldersMutation = api.tasks.createFolders.useMutation({
    onSuccess: (result) => {
      setFolderInfo(result);
      toast.success("Folder structure created!", {
        description: "You can now upload files to Google Drive.",
      });
    },
    onError: (error) => {
      toast.error("Failed to create folders", {
        description: error.message,
      });
      setSubmitError(error.message);
    },
  });

  // Mutation to create task (after files are uploaded)
  const createTaskMutation = api.tasks.create.useMutation({
    onSuccess: (result) => {
      toast.success("Task created successfully!", {
        description: `Task ${result.taskId} created successfully.`,
      });
      setCreatedTaskInfo({
        taskId: result.taskId,
        folderUrl: result.folderUrl,
        requestFileCount: form.getValues("requestFiles").length,
        responseGeminiFileCount: form.getValues("responseGeminiFiles").length,
        responseGptFileCount: form.getValues("responseGptFiles").length,
      });
      setIsSubmitting(false);
      setTimeout(() => {
        router.push(`/dashboard/tasks/${result.taskId}`);
      }, 5000);
    },
    onError: (error) => {
      setIsSubmitting(false);

      if (error.data?.code === "CONFLICT") {
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
            setSubmitError(error.message);
            toast.error("Cannot create new task", {
              description:
                "You have an incomplete task that must be completed first.",
            });
          }
        } else {
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

  // Step 1: Create folder structure
  const initializeTask = async () => {
    if (hasIncompleteTasks) {
      toast.error("Cannot create new task", {
        description:
          "You have an incomplete task that must be completed first.",
      });
      return;
    }

    setSubmitError(null);
    await createFoldersMutation.mutateAsync({});
  };

  // Step 2: Submit task after files are uploaded
  const onSubmit = async (data: CreateTaskInput) => {
    console.log(data);
    if (!folderInfo) {
      toast.error("Please initialize the task first by creating folders.");
      return;
    }

    // Check that all files have been uploaded
    const allFiles = [
      ...data.requestFiles,
      ...data.responseGeminiFiles,
      ...data.responseGptFiles,
    ];
    const missingUploads = allFiles.filter((file) => !file.driveFileId);

    if (missingUploads.length > 0) {
      toast.error("Please upload all files before submitting", {
        description: `Missing uploads: ${missingUploads
          .map((f) => f.name)
          .join(", ")}`,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Add folder info to the data
      console.log("Task id recieved from folders is ", folderInfo?.taskId);
      const taskData: CreateTaskInput = {
        ...data,
        taskId: folderInfo.taskId as string,
        taskFolderId: folderInfo.taskFolderId,
      };

      await createTaskMutation.mutateAsync(taskData);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const selectedSector = professionalSectors.find(
    (sector) => sector.value === form.watch("ProfessionalSector")
  );

  // Check if all files are uploaded
  const allFiles = [
    ...form.watch("requestFiles"),
    ...form.watch("responseGeminiFiles"),
    ...form.watch("responseGptFiles"),
  ];
  const allFilesUploaded =
    allFiles.length > 0 && allFiles.every((file) => file.driveFileId);
  const hasRequiredFiles = form.watch("requestFiles").length > 0;

  // Show success state
  if (createdTaskInfo) {
    return (
      <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
            <CheckCircleIcon className="h-6 w-6" />
            <span>Task Created Successfully!</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Task ID:
              </p>
              <code className="bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded text-sm block text-green-900 dark:text-green-100">
                {createdTaskInfo.taskId}
              </code>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Files Uploaded:
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-green-700 dark:text-green-300">
                    Request Files:
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                  >
                    {createdTaskInfo.requestFileCount}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-700 dark:text-green-300">
                    Gemini Files:
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                  >
                    {createdTaskInfo.responseGeminiFileCount}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-700 dark:text-green-300">
                    GPT Files:
                  </span>
                  <Badge
                    variant="secondary"
                    className="bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                  >
                    {createdTaskInfo.responseGptFileCount}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Google Drive Folder:
            </p>
            <div className="flex items-center space-x-2">
              <code className="bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded text-xs flex-1 truncate text-green-900 dark:text-green-100">
                {createdTaskInfo.folderUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50"
                onClick={() => window.open(createdTaskInfo.folderUrl, "_blank")}
              >
                <ExternalLinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Alert className="bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700">
            <FolderOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-200">
              Task Setup Complete
            </AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-300">
              Your task has been created with organized folder structure:
              <ul className="mt-2 space-y-1 text-xs">
                <li>
                  📁 {createdTaskInfo.taskId}/request →{" "}
                  {createdTaskInfo.requestFileCount} files
                </li>
                <li>
                  📁 {createdTaskInfo.taskId}/response_gemini →{" "}
                  {createdTaskInfo.responseGeminiFileCount} files
                </li>
                <li>
                  📁 {createdTaskInfo.taskId}/response_gpt →{" "}
                  {createdTaskInfo.responseGptFileCount} files
                </li>
              </ul>
              Redirecting to task page in 5 seconds...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

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

        {/* Incomplete Task Warning */}
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

        {/* Step indicator */}
        {!hasIncompleteTasks && (
          <div className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg">
            <div
              className={`flex items-center space-x-2 ${
                !folderInfo ? "text-primary" : "text-green-600"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  !folderInfo
                    ? "bg-primary text-primary-foreground"
                    : "bg-green-600 text-white"
                }`}
              >
                {!folderInfo ? "1" : "✓"}
              </div>
              <span className="text-sm font-medium">Initialize Task</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div
              className={`flex items-center space-x-2 ${
                folderInfo && !allFilesUploaded
                  ? "text-primary"
                  : folderInfo && allFilesUploaded
                  ? "text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  folderInfo && !allFilesUploaded
                    ? "bg-primary text-primary-foreground"
                    : folderInfo && allFilesUploaded
                    ? "border-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {folderInfo && allFilesUploaded ? "✓" : "2"}
              </div>
              <span className="text-sm font-medium">Upload Files</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div
              className={`flex items-center space-x-2 ${
                folderInfo && allFilesUploaded
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  folderInfo && allFilesUploaded
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                3
              </div>
              <span className="text-sm font-medium">Create Task</span>
            </div>
          </div>
        )}
      </div>

      {/* Only show form if no incomplete tasks exist */}
      {!hasIncompleteTasks ? (
        <>
          {/* Step 1: Initialize Task */}
          {!folderInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Initialize Task</CardTitle>
                <CardDescription>
                  First, we&apos;ll create the folder structure in Google Drive
                  for your task.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={initializeTask}
                  disabled={createFoldersMutation.isPending}
                  size="lg"
                  className="w-full"
                >
                  {createFoldersMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Folders...
                    </>
                  ) : (
                    <>
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Initialize Task & Create Folders
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2 & 3: Main Form (only show after folders are created) */}
          {folderInfo && (
            <>
              <Alert className=" border-green-200">
                <CheckCircleIcon className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">
                  Folders Created Successfully!
                </AlertTitle>
                <AlertDescription className="">
                  Task ID: {folderInfo.taskId}
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto "
                    onClick={() =>
                      window.open(folderInfo.taskFolderUrl, "_blank")
                    }
                  >
                    View in Google Drive{" "}
                    <ExternalLinkIcon className="ml-1 h-3 w-3" />
                  </Button>
                </AlertDescription>
              </Alert>

              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-6"
                >
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
                                  Provide a clear, detailed description of what
                                  you want the AI to accomplish.
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

                      {/* File Uploads - Using Direct Upload */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            <Upload className="h-5 w-5" />
                            <span>Step 2: File Uploads</span>
                          </CardTitle>
                          <CardDescription>
                            Upload files directly to Google Drive. Files are
                            uploaded immediately when you drop them.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <FormField
                            control={form.control}
                            name="requestFiles"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Request Files *</FormLabel>
                                <FormControl>
                                  <DirectFileUpload
                                    files={field.value}
                                    onFilesChange={field.onChange}
                                    folderId={folderInfo.requestFolderId}
                                    label="Upload Request Files"
                                    description="Upload all source materials, documents, and inputs for the task"
                                    immediate={true}
                                  />
                                </FormControl>
                                <FormDescription>
                                  These files will be stored in the
                                  &lsquo;request&rsquo; folder and represent the
                                  task inputs.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="responseGeminiFiles"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Gemini Response Files *</FormLabel>
                                <FormControl>
                                  <DirectFileUpload
                                    files={field.value}
                                    onFilesChange={field.onChange}
                                    folderId={folderInfo.responseGeminiFolderId}
                                    label="Upload Gemini Response Files"
                                    description="Upload files generated by or related to Gemini model responses"
                                    immediate={true}
                                  />
                                </FormControl>
                                <FormDescription>
                                  These files will be stored in the
                                  &lsquo;response_gemini&rsquo; folder.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="responseGptFiles"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GPT Response Files *</FormLabel>
                                <FormControl>
                                  <DirectFileUpload
                                    files={field.value}
                                    onFilesChange={field.onChange}
                                    folderId={folderInfo.responseGptFolderId}
                                    label="Upload GPT Response Files"
                                    description="Upload files generated by or related to GPT model responses"
                                    immediate={true}
                                  />
                                </FormControl>
                                <FormDescription>
                                  These files will be stored in the
                                  &lsquo;response_gpt&rsquo; folder.
                                </FormDescription>
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
                            Provide the complete responses from both GPT and
                            Gemini models.
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
                                  Include the full response exactly as provided
                                  by GPT.
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
                                  Include the full response exactly as provided
                                  by Gemini.
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
                            <span>Licensing</span>
                          </CardTitle>
                          <CardDescription>
                            Confirm licensing for your uploaded materials.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                  <FormLabel>
                                    Open Source Confirmation *
                                  </FormLabel>
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
                      {/* Upload Status */}
                      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2 text-lg">
                            <Upload className="h-5 w-5" />
                            <span>Upload Status</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Request Files</span>
                            <Badge
                              variant={
                                form.watch("requestFiles").length > 0
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {form.watch("requestFiles").length} files
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Gemini Files</span>
                            <Badge
                              variant={
                                form.watch("responseGeminiFiles").length > 0
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {form.watch("responseGeminiFiles").length} files
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">GPT Files</span>
                            <Badge
                              variant={
                                form.watch("responseGptFiles").length > 0
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {form.watch("responseGptFiles").length} files
                            </Badge>
                          </div>
                          <div className="pt-2 border-t">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                All Uploaded
                              </span>
                              {allFilesUploaded && hasRequiredFiles ? (
                                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

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
                              <span className="text-muted-foreground">
                                Email:{" "}
                              </span>
                              <span className="font-mono">{user.email}</span>
                            </div>
                            <div className="text-xs">
                              <span className="text-muted-foreground">
                                Name:{" "}
                              </span>
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
                      disabled={
                        isSubmitting || !allFilesUploaded || !hasRequiredFiles
                      }
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
                    {/* <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        console.log("FORCE DEBUG:", {
                          formData: form.getValues(),
                          folderInfo,
                          allFiles,
                          validation: form.formState.isValid,
                        });

                        // Try manual submission
                        const data = form.getValues();
                        console.log("Manual submit attempt:", data);
                      }}
                    >
                      🔍 Debug Form
                    </Button> */}
                  </div>
                </form>
              </Form>
            </>
          )}
        </>
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
                  current task &ldquo;
                  {currentIncompleteTask?.TaskID}&rdquo; before creating a new
                  one.
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
                  <FileText className="w-5 h-5 mr-2" />
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
