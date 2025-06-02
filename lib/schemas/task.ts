import { z } from "zod";

// Professional sectors enum
export const ProfessionalSector = z.enum([
  "Data-Science & Analysis",
  "Web development",
  "STEM Research",
  "Medicine",
  "Law",
  "Accounting",
]);

export type ProfessionalSector = z.infer<typeof ProfessionalSector>;

// Single status enum for tracking everything
export const TaskStatus = z.enum([
  "Task Creation",
  "Round 1",
  "Round 2",
  "Round 3",
  "Completed",
]);

export type TaskStatus = z.infer<typeof TaskStatus>;

export const CreateTaskSchema = z.object({
  Prompt: z.string().min(10, "Task description must be at least 10 characters"),
  ProfessionalSector: ProfessionalSector,
  TrainerEmail: z.string().email(),
  Sources: z
    .string()
    .url("Please provide a valid Google Drive URL")
    .min(1, "Google Drive URL is required"),
  OpenSourceConfirmed: z.boolean(),
  LicenseNotes: z.string().optional(),
  GPTResponse: z.string().min(1, "GPT response is required"),
  GeminiResponse: z.string().min(1, "Gemini response is required"),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const TaskSchema = z.object({
  TaskID: z.string(),
  Prompt: z.string(),
  ProfessionalSector: ProfessionalSector,
  TrainerEmail: z.string().email(),
  Sources: z.string(),
  OpenSourceConfirmed: z.string(),
  LicenseNotes: z.string().optional(),
  GPTResponse: z.string(),
  GeminiResponse: z.string(),

  // Round 1 fields
  Round1Rubric: z.string().optional(),
  Round1HumanScores: z.string().optional(),
  Round1AIScores: z.string().optional(),
  Round1AlignmentPercentage: z.number().optional(),
  Round1MisalignedItems: z.string().optional(),

  // Round 2 fields
  Round2AssignedTo: z.string().optional(),
  Round2RubricEnhanced: z.string().optional(),
  Round2Rubric: z.string().optional(),
  Round2HumanScores: z.string().optional(),
  Round2AIScores: z.string().optional(),
  Round2AlignmentPercentage: z.number().optional(),
  Round2MisalignedItems: z.string().optional(),

  // Round 3 fields
  Round3AssignedTo: z.string().optional(),
  Round3RubricEnhanced: z.string().optional(),
  Round3Rubric: z.string().optional(),
  Round3HumanScores: z.string().optional(),
  Round3AIScores: z.string().optional(),
  Round3AlignmentPercentage: z.number().optional(),
  Round3MisalignedItems: z.string().optional(),

  // Metadata
  Status: TaskStatus,
  Comments: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

// Task summary for listings in submitted tasks
export const TaskSummarySchema = z.object({
  TaskID: z.string(),
  Prompt: z.string(),
  ProfessionalSector: ProfessionalSector,
  Status: TaskStatus,
  Progress: z.number().min(0).max(100),
  TrainerEmail: z.string().email(),
});

export type TaskSummary = z.infer<typeof TaskSummarySchema>;

// Helper functions
export function getStatusDisplayInfo(status: TaskStatus) {
  switch (status) {
    case "Task Creation":
      return {
        label: "Task Creation",
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        step: 1,
        description: "Initial task setup",
      };
    case "Round 1":
      return {
        label: "Round 1",
        color:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        step: 2,
        description: "First evaluation round",
      };
    case "Round 2":
      return {
        label: "Round 2",
        color:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
        step: 3,
        description: "Second evaluation round",
      };
    case "Round 3":
      return {
        label: "Round 3",
        color:
          "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
        step: 4,
        description: "Final evaluation round",
      };
    case "Completed":
      return {
        label: "Completed",
        color:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        step: 5,
        description: "All rounds completed",
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
      return 20;
    case "Round 1":
      return 40;
    case "Round 2":
      return 60;
    case "Round 3":
      return 80;
    case "Completed":
      return 100;
    default:
      return 0;
  }
}

export function getNextStatus(currentStatus: TaskStatus): TaskStatus | null {
  switch (currentStatus) {
    case "Task Creation":
      return "Round 1";
    case "Round 1":
      return "Round 2";
    case "Round 2":
      return "Round 3";
    case "Round 3":
      return "Completed";
    case "Completed":
      return null;
    default:
      return null;
  }
}

export function canProgressToNextRound(task: Partial<Task>): boolean {
  switch (task.Status) {
    case "Task Creation":
      return !!(
        task.Prompt &&
        task.ProfessionalSector &&
        task.GPTResponse &&
        task.GeminiResponse
      );
    case "Round 1":
      return !!(
        task.Round1Rubric && task.Round1AlignmentPercentage !== undefined
      );
    case "Round 2":
      return !!(
        task.Round2Rubric && task.Round2AlignmentPercentage !== undefined
      );
    case "Round 3":
      return !!(
        task.Round3Rubric && task.Round3AlignmentPercentage !== undefined
      );
    case "Completed":
      return false;
    default:
      return false;
  }
}
