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

// TaskStatus enum with  step-by-step flow
export const TaskStatus = z.enum([
  "Task_Creation",
  "Rubric_V1",
  "Rubric_V2",
  "Rubric_Enhancing",
  "Human_Eval_Gemini",
  "Model_Eval_Gemini",
  "Human_Eval_GPT",
  "Model_Eval_GPT",
  "Completed",
]);

export type TaskStatus = z.infer<typeof TaskStatus>;

// Original task creation schema
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

// Airtable record interface with all new fields
export interface AirtableTaskRecord extends FieldSet {
  // Original fields
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
  Created?: string;
  LastModified?: string;

  Current_Rubric_Version: number;

  // New rubric fields
  Rubric_V1?: string; // JSON string - Initial rubric from Gemini
  Rubric_V2?: string; // JSON string - Enhanced rubric
  [key: `Rubric_V${number}`]: string | undefined;

  // Gemini evaluation fields
  Human_Eval_Gemini?: string; // JSON string - Human scores for Gemini response
  Model_Eval_Gemini?: string; // JSON string - Model scores for Gemini response
  Alignment_Gemini?: number; // Number 0-100 - Alignment percentage for Gemini
  Misaligned_Gemini?: string; // JSON array - Misaligned items for Gemini

  // GPT evaluation fields
  Human_Eval_GPT?: string; // JSON string - Human scores for GPT response
  Model_Eval_GPT?: string; // JSON string - Model scores for GPT response
  Alignment_GPT?: number; // Number 0-100 - Alignment percentage for GPT
  Misaligned_GPT?: string; // JSON array - Misaligned items for GPT

  Alignment_History?: string;

  // Optional comments
  Comments?: string; // General comments about the evaluation
}

export interface Task extends AirtableTaskRecord {
  id: string;
}

export function getRubricFieldName(version: number): string {
  return `Rubric_V${version}`;
}

export function getCurrentRubricFieldName(task: AirtableTaskRecord): string {
  const version = task.Current_Rubric_Version || 1;
  return getRubricFieldName(version);
}

export function getCurrentRubricContent(
  task: AirtableTaskRecord
): string | undefined {
  const fieldName = getCurrentRubricFieldName(task);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (task as any)[fieldName];
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

function hasRubricDuplicates(jsonString: string): boolean {
  const rubricKeyRegex = /"(rubric_\d+)"\s*:/g;
  const foundKeys: string[] = [];
  let match;

  while ((match = rubricKeyRegex.exec(jsonString)) !== null) {
    const key = match[1];
    if (foundKeys.includes(key)) {
      return true;
    }
    foundKeys.push(key);
  }

  return false;
}

// Rubric JSON validation schema
export const RubricJSONSchema = z.string().refine(
  (jsonString) => {
    try {
      // Check for empty string
      if (!jsonString || jsonString.trim().length === 0) {
        return false;
      }

      // Check for duplicate keys BEFORE parsing
      if (hasRubricDuplicates(jsonString)) {
        return false;
      }

      const rubric = JSON.parse(jsonString);

      // Check if it's an object
      if (
        typeof rubric !== "object" ||
        Array.isArray(rubric) ||
        rubric === null
      ) {
        return false;
      }

      // Get rubric keys
      const rubricKeys = Object.keys(rubric).filter(
        (key) => key.startsWith("rubric_") && /^rubric_\d+$/.test(key)
      );

      // Check minimum count (15) and maximum count (50)
      if (rubricKeys.length < 15 || rubricKeys.length > 50) {
        return false;
      }

      // Check for non-rubric keys
      const nonRubricKeys = Object.keys(rubric).filter(
        (key) => !key.startsWith("rubric_") || !/^rubric_\d+$/.test(key)
      );

      if (nonRubricKeys.length > 0) {
        return false;
      }

      // Validate each rubric item
      return rubricKeys.every((key) => {
        const value = rubric[key];
        return typeof value === "string" && value.trim().length >= 10;
      });
    } catch {
      return false;
    }
  },
  {
    message:
      "Must be valid JSON with 15-50 unique rubric items (rubric_1, rubric_2, etc.) each with at least 10 characters. No duplicate keys allowed.",
  }
);

// Evaluation scores validation schema
export const EvaluationScoresSchema = z.string().refine(
  (jsonString) => {
    try {
      const scores = JSON.parse(jsonString);

      // Check if it's an object
      if (typeof scores !== "object" || Array.isArray(scores)) {
        return false;
      }

      // All values must be "Yes" or "No"
      return Object.values(scores).every(
        (value) => value === "Yes" || value === "No"
      );
    } catch {
      return false;
    }
  },
  {
    message: "Must be valid JSON with all values as 'Yes' or 'No'",
  }
);

// Step-specific input schemas
export const RubricInputSchema = z.object({
  taskId: z.string(),
  rubricContent: RubricJSONSchema,
  version: z.number().min(1).max(50),
});

export const RubricV1InputSchema = z.object({
  taskId: z.string(),
  rubricV1: RubricJSONSchema,
});

export const RubricEnhanceInputSchema = z.object({
  taskId: z.string(),
  rubricContent: RubricJSONSchema,
  targetVersion: z.number().min(2),
});

export const HumanEvalInputSchema = z.object({
  taskId: z.string(),
  humanScores: EvaluationScoresSchema,
});

export const ModelEvalInputSchema = z.object({
  taskId: z.string(),
  modelScores: EvaluationScoresSchema,
});

export type RubricInput = z.infer<typeof RubricInputSchema>;
export type RubricV1Input = z.infer<typeof RubricV1InputSchema>;
export type RubricEnhanceInput = z.infer<typeof RubricEnhanceInputSchema>;
export type HumanEvalInput = z.infer<typeof HumanEvalInputSchema>;
export type ModelEvalInput = z.infer<typeof ModelEvalInputSchema>;

export interface AlignmentHistoryEntry {
  version: number;
  alignment: number;
  timestamp: string;
  misalignedCount: number;
}

export function addAlignmentToHistory(
  task: AirtableTaskRecord,
  version: number,
  alignment: number,
  misalignedCount: number
): string {
  const currentHistory: AlignmentHistoryEntry[] = task.Alignment_History
    ? JSON.parse(task.Alignment_History)
    : [];

  const newEntry: AlignmentHistoryEntry = {
    version,
    alignment,
    timestamp: new Date().toISOString(),
    misalignedCount,
  };

  // Remove any existing entry for this version and add the new one
  const updatedHistory = [
    ...currentHistory.filter((entry) => entry.version !== version),
    newEntry,
  ].sort((a, b) => a.version - b.version);

  return JSON.stringify(updatedHistory);
}

// Utility functions
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
    Status: "Task_Creation" as TaskStatus,
    Current_Rubric_Version: 1,
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

// Updated status display info for new statuses
export function getStatusDisplayInfo(status: TaskStatus) {
  switch (status) {
    case "Task_Creation":
      return {
        label: "Task Created",
        color:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        step: 1,
        description: "Ready for rubric creation",
      };
    case "Rubric_V1":
      return {
        label: "V1 Rubric",
        color:
          "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
        step: 2,
        description: "Initial rubric created",
      };
    case "Rubric_V2":
      return {
        label: "V2 Rubric",
        color:
          "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
        step: 3,
        description: "Enhanced rubric ready",
      };
    case "Rubric_Enhancing":
      return {
        label: "Enhancing Rubric",
        color:
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        step: 3,
        description: "Improving rubric for better alignment",
      };
    case "Human_Eval_Gemini":
      return {
        label: "Human Eval Gemini",
        color:
          "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
        step: 4,
        description: "Human evaluation in progress",
      };
    case "Model_Eval_Gemini":
      return {
        label: "Model Eval Gemini",
        color:
          "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
        step: 5,
        description: "Model evaluation in progress",
      };
    case "Human_Eval_GPT":
      return {
        label: "Human Eval GPT",
        color:
          "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
        step: 6,
        description: "GPT human evaluation in progress",
      };
    case "Model_Eval_GPT":
      return {
        label: "Model Eval GPT",
        color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        step: 7,
        description: "GPT model evaluation in progress",
      };
    case "Completed":
      return {
        label: "Completed",
        color:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        step: 8,
        description: "All evaluations completed",
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

export function calculateTaskProgress(
  status: TaskStatus,
  currentVersion?: number
): number {
  const baseProgress = {
    Task_Creation: 12.5,
    Rubric_V1: 25,
    Rubric_V2: 37.5,
    Rubric_Enhancing: 37.5, // Same as V2 since it's iterative improvement
    Human_Eval_Gemini: 50,
    Model_Eval_Gemini: 62.5,
    Human_Eval_GPT: 75,
    Model_Eval_GPT: 87.5,
    Completed: 100,
  };

  let progress = baseProgress[status] || 0;

  // Slight adjustment for multiple iterations to show progress
  if (status === "Rubric_Enhancing" && currentVersion && currentVersion > 2) {
    // Add small increment for each iteration to show progress
    const iterationBonus = Math.min((currentVersion - 2) * 2, 10); // Max 10% bonus
    progress = Math.min(progress + iterationBonus, 45); // Don't exceed Human_Eval_Gemini threshold
  }

  return progress;
}

export function getNextStatus(
  currentStatus: TaskStatus,
  alignment?: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentVersion?: number
): TaskStatus | null {
  switch (currentStatus) {
    case "Task_Creation":
      return "Rubric_V1";
    case "Rubric_V1":
      return "Rubric_V2"; // Go to V2 creation, not enhancement
    case "Rubric_V2":
      return "Human_Eval_Gemini";
    case "Rubric_Enhancing":
      return "Human_Eval_Gemini";
    case "Human_Eval_Gemini":
      return "Model_Eval_Gemini";
    case "Model_Eval_Gemini":
      // Dynamic decision based on alignment
      if (alignment !== undefined) {
        return alignment >= 80 ? "Human_Eval_GPT" : "Rubric_Enhancing";
      }
      return "Human_Eval_GPT";
    case "Human_Eval_GPT":
      return "Model_Eval_GPT";
    case "Model_Eval_GPT":
      return "Completed";
    case "Completed":
      return "Completed";
    default:
      return null;
  }
}

// Get current rubric version display name
export function getCurrentRubricVersionName(task: AirtableTaskRecord): string {
  const version = task.Current_Rubric_Version || 1;
  if (version <= 2) {
    return `V${version}`;
  }
  return `V${version} (Enhanced)`;
}

// Check if task needs rubric iteration
export function needsRubricIteration(task: AirtableTaskRecord): boolean {
  return (
    task.Status === "Model_Eval_Gemini" &&
    task.Alignment_Gemini !== undefined &&
    task.Alignment_Gemini < 80
  );
}

// Get all step definitions for progress tracking
// First, define the interface for workflow steps
export interface WorkflowStep {
  status: TaskStatus;
  label: string;
  description: string;
  estimatedTime: string;
  isIterative?: boolean;
  iterationInfo?: {
    currentVersion: number;
    targetVersion: number;
    reason: string;
  };
}

export function getWorkflowSteps(task?: AirtableTaskRecord): WorkflowStep[] {
  const baseSteps: WorkflowStep[] = [
    {
      status: "Task_Creation",
      label: "Task Setup",
      description: "Create prompt and gather AI responses",
      estimatedTime: "30-45 minutes",
    },
    {
      status: "Rubric_V1",
      label: "Create V1 Rubric",
      description: "Generate initial rubric using AI prompt",
      estimatedTime: "10-15 minutes",
    },
  ];

  // Handle V2 creation vs enhancement
  if (task?.Status === "Rubric_V1") {
    baseSteps.push({
      status: "Rubric_V2",
      label: "Enhance to V2 Rubric",
      description: "Refine and improve the initial rubric",
      estimatedTime: "15-20 minutes",
    });
  } else if (task && needsRubricIteration(task)) {
    const currentVersion = task.Current_Rubric_Version || 2;
    const targetVersion = currentVersion + 1;
    const alignment = task.Alignment_Gemini || 0;

    baseSteps.push({
      status: "Rubric_Enhancing",
      label: `Create V${targetVersion} Rubric`,
      description: `Enhance rubric for better alignment (was ${alignment}%)`,
      estimatedTime: "15-25 minutes",
      isIterative: true,
      iterationInfo: {
        currentVersion,
        targetVersion,
        reason: `Previous alignment: ${alignment}% (need ≥80%)`,
      },
    });
  } else {
    // Standard V2 step if not in iteration mode
    baseSteps.push({
      status: "Rubric_V2",
      label: "V2 Rubric",
      description: "Enhanced rubric ready",
      estimatedTime: "Complete",
    });
  }

  // Add remaining evaluation steps
  baseSteps.push(
    {
      status: "Human_Eval_Gemini",
      label: "Human Evaluate Gemini",
      description: "Manually evaluate Gemini's response",
      estimatedTime: "10-15 minutes",
    },
    {
      status: "Model_Eval_Gemini",
      label: "Model Evaluate Gemini",
      description: "Get AI to evaluate Gemini's response",
      estimatedTime: "5-10 minutes",
    },
    {
      status: "Human_Eval_GPT",
      label: "Human Evaluate GPT",
      description: "Manually evaluate GPT's response",
      estimatedTime: "10-15 minutes",
    },
    {
      status: "Model_Eval_GPT",
      label: "Model Evaluate GPT",
      description: "Get AI to evaluate GPT's response",
      estimatedTime: "5-10 minutes",
    },
    {
      status: "Completed",
      label: "Evaluation Complete",
      description: "All evaluations finished",
      estimatedTime: "Complete",
    }
  );

  return baseSteps;
}

// Alignment calculation utility
export interface AlignmentResult {
  percentage: number;
  aligned: number;
  total: number;
  misalignedItems: Array<{
    id: string;
    question: string;
    human_score: string;
    model_score: string;
  }>;
}

export function calculateAlignment(
  humanScoresJSON: string,
  modelScoresJSON: string,
  rubricJSON: string
): AlignmentResult {
  try {
    const humanScores = JSON.parse(humanScoresJSON);
    const modelScores = JSON.parse(modelScoresJSON);
    const rubric = JSON.parse(rubricJSON);

    const keys = Object.keys(humanScores);
    let aligned = 0;
    const misalignedItems: AlignmentResult["misalignedItems"] = [];

    keys.forEach((key) => {
      if (humanScores[key] === modelScores[key]) {
        aligned++;
      } else {
        misalignedItems.push({
          id: key,
          question: rubric[key] || `Question ${key.replace("rubric_", "")}`,
          human_score: humanScores[key],
          model_score: modelScores[key],
        });
      }
    });

    const percentage = Math.round((aligned / keys.length) * 100);

    return {
      percentage,
      aligned,
      total: keys.length,
      misalignedItems,
    };
  } catch (error) {
    console.error("Error calculating alignment:", error);
    return {
      percentage: 0,
      aligned: 0,
      total: 0,
      misalignedItems: [],
    };
  }
}

// Validation helpers
// Add this to lib/schemas/task.ts - replace the existing validateRubricJSON function

export function validateRubricJSON(jsonString: string): {
  isValid: boolean;
  errors: string[];
  rubricCount: number;
} {
  // Early return for empty string
  if (!jsonString || jsonString.trim().length === 0) {
    return {
      isValid: false,
      errors: ["JSON string cannot be empty"],
      rubricCount: 0,
    };
  }

  try {
    // Clean the JSON string - remove any trailing/leading whitespace and ensure it's properly formatted
    const cleanedJsonString = jsonString.trim();

    // Check for duplicate keys BEFORE parsing
    const duplicateCheck = checkForDuplicateRubricKeys(cleanedJsonString);

    const rubric = JSON.parse(cleanedJsonString);
    const errors: string[] = [];

    // Add duplicate key errors first
    if (duplicateCheck.hasDuplicates) {
      errors.push(
        `Duplicate rubric keys found: ${duplicateCheck.duplicates.join(
          ", "
        )}. Each rubric key should be unique.`
      );
    }

    // Check if it's an object
    if (
      typeof rubric !== "object" ||
      Array.isArray(rubric) ||
      rubric === null
    ) {
      errors.push("Rubric must be a JSON object");
      return { isValid: false, errors, rubricCount: 0 };
    }

    // Get rubric keys and validate pattern
    const rubricKeys = Object.keys(rubric).filter(
      (key) => key.startsWith("rubric_") && /^rubric_\d+$/.test(key)
    );

    // Check minimum count
    if (rubricKeys.length < 15) {
      errors.push(
        `Minimum 15 rubric items required. Found ${rubricKeys.length}`
      );
    }

    // Check maximum count
    if (rubricKeys.length > 50) {
      errors.push(
        `Maximum 50 rubric items allowed. Found ${rubricKeys.length}`
      );
    }

    // Validate each rubric item
    rubricKeys.forEach((key) => {
      const value = rubric[key];
      if (typeof value !== "string") {
        errors.push(`${key}: Must be a string`);
      } else if (value.trim().length < 10) {
        errors.push(`${key}: Must be at least 10 characters long`);
      }
    });

    // Check for non-rubric keys
    const nonRubricKeys = Object.keys(rubric).filter(
      (key) => !key.startsWith("rubric_") || !/^rubric_\d+$/.test(key)
    );

    if (nonRubricKeys.length > 0) {
      errors.push(
        `Invalid keys found: ${nonRubricKeys.join(
          ", "
        )}. Only rubric_1, rubric_2, etc. are allowed`
      );
    }

    // Check for sequential numbering
    const rubricNumbers = rubricKeys
      .map((key) => parseInt(key.replace("rubric_", "")))
      .sort((a, b) => a - b);

    if (rubricNumbers.length > 0) {
      const expectedSequence = Array.from(
        { length: rubricNumbers.length },
        (_, i) => i + 1
      );

      const isSequential = rubricNumbers.every(
        (num, index) => num === expectedSequence[index]
      );

      if (!isSequential) {
        console.warn("Rubric numbering is not sequential:", rubricNumbers);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      rubricCount: rubricKeys.length,
    };
  } catch (error) {
    console.error("JSON parsing error:", error);

    let errorMessage = "Invalid JSON format";

    if (error instanceof SyntaxError) {
      if (error.message.includes("Unexpected end")) {
        errorMessage =
          "JSON appears incomplete - check for missing closing braces or quotes";
      } else if (error.message.includes("Unexpected token")) {
        errorMessage = "JSON contains invalid characters or formatting";
      } else {
        errorMessage = `JSON syntax error: ${error.message}`;
      }
    }

    return {
      isValid: false,
      errors: [errorMessage],
      rubricCount: 0,
    };
  }
}

// Helper function to detect duplicate rubric keys in the raw JSON string
function checkForDuplicateRubricKeys(jsonString: string): {
  hasDuplicates: boolean;
  duplicates: string[];
} {
  // Use regex to find all rubric_X patterns in the string
  const rubricKeyRegex = /"(rubric_\d+)"\s*:/g;
  const foundKeys: string[] = [];
  const duplicates: string[] = [];
  let match;

  while ((match = rubricKeyRegex.exec(jsonString)) !== null) {
    const key = match[1];
    if (foundKeys.includes(key)) {
      if (!duplicates.includes(key)) {
        duplicates.push(key);
      }
    } else {
      foundKeys.push(key);
    }
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates,
  };
}

export function validateEvaluationScores(
  scoresJSON: string,
  rubricJSON: string
): { isValid: boolean; errors: string[] } {
  try {
    const scores = JSON.parse(scoresJSON);
    const rubric = JSON.parse(rubricJSON);
    const errors: string[] = [];

    const rubricKeys = Object.keys(rubric).filter(
      (key) => key.startsWith("rubric_") && /^rubric_\d+$/.test(key)
    );

    // Check all rubric items have scores
    rubricKeys.forEach((key) => {
      if (!(key in scores)) {
        errors.push(`Missing score for ${key}`);
      } else if (!["Yes", "No"].includes(scores[key])) {
        errors.push(`${key}: Score must be "Yes" or "No"`);
      }
    });

    // Check no extra scores
    Object.keys(scores).forEach((key) => {
      if (!rubricKeys.includes(key)) {
        errors.push(`Unexpected score key: ${key}`);
      }
    });

    return { isValid: errors.length === 0, errors };
  } catch (error) {
    console.error("Error validating evaluation scores JSON :", error);

    return { isValid: false, errors: ["Invalid JSON format"] };
  }
}
