"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
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
  AlertCircle,
  CheckCircle,
  Bot,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import {
  CreateTaskSchema,
  CreateTaskInput,
  getWorkflowSteps,
} from "@/lib/schemas/task";
import { professionalSectors } from "@/constants/ProfessionalSectors";
import { api } from "@/lib/trpc/client";

export default function NewTaskPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useUser();

  const workflowSteps = getWorkflowSteps();

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
      setSubmitError(
        error.message || "An error occurred while creating the task."
      );
      toast.error("Failed to create task", {
        description: error.message,
      });
    },
  });

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      Prompt: "",
      ProfessionalSector: undefined,
      Sources: "",
      OpenSourceConfirmed: false,
      LicenseNotes: "",
      GPTResponse: "",
      GeminiResponse: "",
    },
  });

  const onSubmit = async (data: CreateTaskInput) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await createTaskMutation.mutateAsync(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {}
  };

  const selectedSector = professionalSectors.find(
    (sector) => sector.value === form.watch("ProfessionalSector")
  );

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

        {submitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Submission Error</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}
      </div>

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
                          Provide a clear, detailed description of what you want
                          the AI to accomplish.
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
                          Include the full response exactly as provided by GPT.
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
                                window.open(
                                  "https://drive.google.com",
                                  "_blank"
                                )
                              }
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Upload all source materials to Google Drive and share
                          the folder URL.
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
                              <Badge variant="default" className="text-xs mt-2">
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
                      <span>Provide detailed prompt.</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Include complete AI responses</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Upload sources to Google Drive</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Confirm open source licensing</span>
                    </div>
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
                      <span className="text-muted-foreground">Email: </span>
                      <span className="font-mono">
                        {user.primaryEmailAddress?.emailAddress}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Name: </span>
                      <span>
                        {user.firstName} {user.lastName}
                      </span>
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
              disabled={isSubmitting}
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
    </div>
  );
}
