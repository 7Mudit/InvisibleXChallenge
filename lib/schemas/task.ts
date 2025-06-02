import { FieldSet } from "airtable";
import { z } from "zod";

export const ProfessionalSector = z.enum([
  "Data-Science & Analysis",
  "Web development",
  "STEM Research",
  "Medicine",
  "Law",
  "Accounting",
]);

export type ProfessionalSector = z.infer<typeof ProfessionalSector>;

export const TaskStatus = z.enum(["Task Creation", "Completed"]);

export type TaskStatus = z.infer<typeof TaskStatus>;

export const CreateTaskSchema = z.object({
  Prompt: z
    .string()
    .min(50, "Task description must be at least 50 characters")
    .refine(
      (val) => val.trim().length >= 50,
      "Task description cannot be just whitespace"
    ),

  ProfessionalSector: ProfessionalSector,

  Sources: z
    .string()
    .url("Please provide a valid Google Drive URL")
    .refine(
      (url) => url.includes("drive.google.com"),
      "Must be a Google Drive URL"
    ),

  OpenSourceConfirmed: z
    .boolean()
    .refine((val) => val === true, "You must confirm open source licensing"),

  LicenseNotes: z
    .string()
    .max(1000, "License notes must be less than 1000 characters")
    .optional(),

  GPTResponse: z
    .string()
    .min(50, "GPT response must be at least 50 characters")
    .refine(
      (val) => val.trim().length >= 50,
      "GPT response cannot be just whitespace"
    ),

  GeminiResponse: z
    .string()
    .min(50, "Gemini response must be at least 50 characters")
    .refine(
      (val) => val.trim().length >= 50,
      "Gemini response cannot be just whitespace"
    ),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const ServerTaskSchema = CreateTaskSchema.extend({
  TrainerEmail: z
    .string()
    .email("Must be a valid email address")
    .refine(
      (email) => email.endsWith("@invisible.email"),
      "Must be an @invisible.email account"
    ),
});

export type ServerTaskInput = z.infer<typeof ServerTaskSchema>;

export interface AirtableTaskRecord extends FieldSet {
  TaskID: string;
  Prompt: string;
  ProfessionalSector: ProfessionalSector;
  TrainerEmail: string;
  Sources: string;
  OpenSourceConfirmed: string;
  LicenseNotes?: string;
  GPTResponse: string;
  GeminiResponse: string;
  Status: TaskStatus;

  // Rubric Creation fields
  Rubric?: string;
  HumanScores?: string;
  AIScores?: string;
  AlignmentPercentage?: number;
  MisalignedItems?: string;
  Comments?: string;
  Created?: string;
  LastModified?: string;
}

export interface Task extends AirtableTaskRecord {
  id: string;
}

export const TaskSummarySchema = z.object({
  id: z.string(),
  TaskID: z.string(),
  Prompt: z.string(),
  ProfessionalSector: ProfessionalSector,
  Status: TaskStatus,
  Progress: z.number().min(0).max(100),
  TrainerEmail: z.string().email(),
  Created: z.string().optional(),
});

export type TaskSummary = z.infer<typeof TaskSummarySchema>;

export function addServerFields(
  frontendData: CreateTaskInput,
  trainerEmail: string
): ServerTaskInput {
  return {
    ...frontendData,
    TrainerEmail: trainerEmail,
  };
}

export function toAirtableFormat(
  serverData: ServerTaskInput,
  taskID: string
): Omit<AirtableTaskRecord, keyof FieldSet> {
  return {
    TaskID: taskID,
    Prompt: serverData.Prompt,
    ProfessionalSector: serverData.ProfessionalSector,
    TrainerEmail: serverData.TrainerEmail,
    Sources: serverData.Sources,
    OpenSourceConfirmed: serverData.OpenSourceConfirmed.toString(),
    LicenseNotes: serverData.LicenseNotes || "",
    GPTResponse: serverData.GPTResponse,
    GeminiResponse: serverData.GeminiResponse,
    Status: "Task Creation" as TaskStatus,
  };
}

export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map((error) => {
    return error.message;
  });
}

export function getDetailedValidationError(errors: z.ZodError): {
  summary: string;
  details: string[];
  fieldErrors: Record<string, string>;
} {
  const details = formatValidationErrors(errors);
  const fieldErrors: Record<string, string> = {};

  errors.errors.forEach((error) => {
    const fieldName = error.path[0] as string;
    if (fieldName && !fieldErrors[fieldName]) {
      fieldErrors[fieldName] = error.message;
    }
  });

  return {
    summary: `Please fix ${errors.errors.length} validation ${
      errors.errors.length === 1 ? "error" : "errors"
    }`,
    details,
    fieldErrors,
  };
}

export function getStatusDisplayInfo(status: TaskStatus) {
  switch (status) {
    case "Task Creation":
      return {
        label: "Pending Rubric",
        color:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        step: 1,
        description: "Ready for rubric creation",
      };
    case "Completed":
      return {
        label: "Completed",
        color:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        step: 2,
        description: "Evaluation completed",
      };
    default:
      return {
        label: "Unknown",
        color:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
        step: 0,
        description: "Unknown status",
      };
  }
}

export function calculateTaskProgress(status: TaskStatus): number {
  switch (status) {
    case "Task Creation":
      return 50;
    case "Completed":
      return 100;
    default:
      return 0;
  }
}

export function getNextStatus(currentStatus: TaskStatus): TaskStatus | null {
  switch (currentStatus) {
    case "Task Creation":
      return "Completed";
    case "Completed":
      return null;
    default:
      return null;
  }
}

export function canProgressToNextRound(
  task: Partial<AirtableTaskRecord>
): boolean {
  switch (task.Status) {
    case "Task Creation":
      return !!(
        task.Prompt &&
        task.ProfessionalSector &&
        task.GPTResponse &&
        task.GeminiResponse &&
        task.Sources &&
        task.OpenSourceConfirmed
      );
    case "Completed":
    default:
      return false;
  }
}

export function getWorkflowSteps(): Array<{
  status: TaskStatus;
  label: string;
  description: string;
  estimatedTime: string;
}> {
  return [
    {
      status: "Task Creation",
      label: "Task Setup",
      description: "Create prompt and gather AI responses",
      estimatedTime: "30-45 minutes",
    },
    {
      status: "Completed",
      label: "Evaluation Complete",
      description: "Create rubric and calculate alignment",
      estimatedTime: "20-25 minutes",
    },
  ];
}
