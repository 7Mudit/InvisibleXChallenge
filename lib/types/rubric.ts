import { z } from "zod";

export interface RubricItem {
  id: string;
  question: string;
  tag: string;
  humanScore?: boolean;
  aiScore?: boolean;
}

export interface Task {
  Prompt: string;
  GeminiResponse: string;
  GPTResponse: string;
  TaskID: string;
  Status: string;
}

export interface MisalignedItem {
  id: string;
  question: string;
  tag: string;
}

export const RubricItemSchema = z.object({
  id: z.string(),
  question: z
    .string()
    .min(10, "Rubric question must be at least 10 characters"),
  tag: z
    .string()
    .min(1, "Tag is required")
    .max(20, "Tag must be 20 characters or less"),
  humanScore: z.boolean().optional(),
  aiScore: z.boolean().optional(),
});

export const RubricFormSchema = z.object({
  rubricItems: z
    .array(RubricItemSchema)
    .min(15, "At least 15 rubric items are required for submission"),
  comments: z
    .string()
    .max(1000, "Comments must be less than 1000 characters")
    .optional(),
});

export type RubricFormData = z.infer<typeof RubricFormSchema>;
