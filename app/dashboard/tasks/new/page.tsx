"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import {
  Plus,
  FileText,
  Globe,
  Shield,
  AlertCircle,
  CheckCircle,
  Bot,
  ExternalLink,
} from "lucide-react";
import { CreateTaskSchema, CreateTaskInput } from "@/lib/schemas/task";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { professionalSectors } from "@/constants/ProfessionalSectors";

export default function NewTaskPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user } = useUser();

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      taskDescription: "",
      professionalSector: undefined,
      sources: "",
      openSourceConfirmed: false,
      licenseNotes: "",
      gptResponse: "",
      geminiResponse: "",
    },
  });

  const onSubmit = async (data: CreateTaskInput) => {
    setIsSubmitting(true);

    try {
      // Create task payload for Airtable
      const taskPayload = {
        ...data,
        trainerEmail: user?.primaryEmailAddress?.emailAddress,
        openSourceConfirmed: data.openSourceConfirmed.toString(), // Convert boolean to string for Airtable
        status: "Task Creation", // Initial status
      };

      console.log("Creating task:", taskPayload);

      // TODO: Implement API call to create task in Airtable
      // const response = await fetch('/api/tasks', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(taskPayload)
      // });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Redirect to submitted tasks
      // router.push("/tasks/submitted");
    } catch (error) {
      console.error("Error creating task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSector = professionalSectors.find(
    (sector) => sector.value === form.watch("professionalSector")
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Create New Task
        </h1>
        <p className="text-muted-foreground">
          Create a new evaluation task with AI model responses
        </p>
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
                    <span>Task Description</span>
                  </CardTitle>
                  <CardDescription>
                    Provide a detailed description of the evaluation task
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="taskDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the task that needs to be evaluated. Be specific about requirements, expected outputs, and evaluation criteria..."
                            className="min-h-[120px] bg-background/50"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum 10 characters. Be as detailed as possible.
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
                    Select the sector that best matches your task
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="professionalSector"
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
                    Provide responses from both GPT and Gemini models
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="gptResponse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GPT Response *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Paste the complete response from GPT model here..."
                            className="min-h-[120px] bg-background/50"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Include the full response from GPT for evaluation
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="geminiResponse"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gemini Response *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Paste the complete response from Gemini model here..."
                            className="min-h-[120px] bg-background/50"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Include the full response from Gemini for evaluation
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
                    Upload sources to Google Drive and confirm licensing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="sources"
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
                          Upload all your sources (photos, docs, datasets) to
                          Google Drive and share the folder URL
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="openSourceConfirmed"
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
                            licensed for commercial use and are open source
                            compliant.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="licenseNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional notes about licensing, restrictions, or usage rights..."
                            className="bg-background/50"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Any additional licensing information or restrictions
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
              {/* Evaluation Flow */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <Shield className="h-5 w-5" />
                    <span>Evaluation Flow</span>
                  </CardTitle>
                  <CardDescription>
                    Your task will progress through these stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-xs text-primary-foreground font-medium">
                          1
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Task Creation</p>
                        <p className="text-xs text-muted-foreground">
                          Current stage
                        </p>
                      </div>
                      <Badge variant="default" className="text-xs">
                        Active
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs text-muted-foreground font-medium">
                          2
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          Round 1
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rubric creation & scoring
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs text-muted-foreground font-medium">
                          3
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          Round 2
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Enhanced evaluation
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs text-muted-foreground font-medium">
                          4
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          Round 3
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Final scoring
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          Completed
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Evaluation complete
                        </p>
                      </div>
                    </div>
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
                      <span>Upload all sources to Google Drive</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Confirm open source licensing</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Include complete AI responses</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Provide detailed task descriptions</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
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
