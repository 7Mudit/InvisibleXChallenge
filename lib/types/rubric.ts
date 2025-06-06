import { z } from "zod";

//  Updated RubricItem interface with tag
export interface RubricItem {
  id: string;
  question: string;
  tag: string;
  humanScore?: boolean;
  aiScore?: boolean;
}

//  Interface for rubric item without scores (for creation/editing)
export interface RubricItemInput {
  question: string;
  tag: string;
}

// Task interface remains the same
export interface Task {
  Prompt: string;
  GeminiResponse: string;
  GPTResponse: string;
  TaskID: string;
  Status: string;
}

// Interface for misaligned items with tag
export interface MisalignedItem {
  id: string;
  question: string;
  tag: string;
  human_score: string;
  model_score: string;
}

//  Updated RubricItemSchema with tag validation
export const RubricItemSchema = z.object({
  id: z.string(),
  question: z
    .string()
    .min(10, "Rubric question must be at least 10 characters"),
  tag: z
    .string()
    .min(1, "Tag is required")
    .max(20, "Tag must be 20 characters or less")
    .regex(/^[a-z_]+$/, "Tag must be lowercase letters and underscores only"),
  humanScore: z.boolean().optional(),
  aiScore: z.boolean().optional(),
});

// Schema for rubric item input (without scores)
export const RubricItemInputSchema = z.object({
  question: z
    .string()
    .min(10, "Rubric question must be at least 10 characters"),
  tag: z
    .string()
    .min(1, "Tag is required")
    .max(20, "Tag must be 20 characters or less")
    .regex(/^[a-z_]+$/, "Tag must be lowercase letters and underscores only"),
});

//  Updated RubricFormSchema
export const RubricFormSchema = z.object({
  rubricItems: z
    .array(RubricItemSchema)
    .min(15, "At least 15 rubric items are required for submission"),
  comments: z
    .string()
    .max(1000, "Comments must be less than 1000 characters")
    .optional(),
});

//  Schema for creating rubrics (array of inputs)
export const CreateRubricSchema = z.object({
  items: z
    .array(RubricItemInputSchema)
    .min(15, "At least 15 rubric items are required")
    .max(50, "Maximum 50 rubric items allowed"),
});

//  Schema for the new JSON format stored in database
export const NewRubricFormatSchema = z.record(
  z.string().regex(/^rubric_\d+$/, "Key must be in format rubric_X"),
  z.object({
    question: z.string().min(10, "Question must be at least 10 characters"),
    tag: z
      .string()
      .min(1, "Tag is required")
      .max(20, "Tag must be 20 characters or less"),
  })
);

export type RubricFormData = z.infer<typeof RubricFormSchema>;
export type CreateRubricData = z.infer<typeof CreateRubricSchema>;
export type NewRubricFormat = z.infer<typeof NewRubricFormatSchema>;

// Validation function for rubric JSON string in new format
export function validateNewRubricFormat(jsonString: string): {
  isValid: boolean;
  errors: string[];
  data?: NewRubricFormat;
} {
  try {
    const parsed = JSON.parse(jsonString);
    const result = NewRubricFormatSchema.safeParse(parsed);

    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        ),
      };
    }

    // Additional validation
    const keys = Object.keys(result.data);
    const errors: string[] = [];

    // Check for sequential numbering
    const numbers = keys
      .map((key) => parseInt(key.replace("rubric_", "")))
      .sort((a, b) => a - b);
    const expectedSequence = Array.from(
      { length: numbers.length },
      (_, i) => i + 1
    );

    if (!numbers.every((num, index) => num === expectedSequence[index])) {
      errors.push("Rubric keys must be sequential starting from rubric_1");
    }

    // Check for minimum/maximum count
    if (keys.length < 15) {
      errors.push(`Minimum 15 rubric items required. Found ${keys.length}`);
    }

    if (keys.length > 50) {
      errors.push(`Maximum 50 rubric items allowed. Found ${keys.length}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: result.data,
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return {
      isValid: false,
      errors: ["Invalid JSON format"],
    };
  }
}

// Convert between formats
export function convertRubricItemsToNewFormat(
  items: RubricItemInput[]
): NewRubricFormat {
  const result: NewRubricFormat = {};

  items.forEach((item, index) => {
    result[`rubric_${index + 1}`] = {
      question: item.question,
      tag: item.tag,
    };
  });

  return result;
}

export function convertNewFormatToRubricItems(
  format: NewRubricFormat
): RubricItemInput[] {
  return Object.entries(format)
    .sort(([a], [b]) => {
      const numA = parseInt(a.replace("rubric_", ""));
      const numB = parseInt(b.replace("rubric_", ""));
      return numA - numB;
    })
    .map(([, value]) => ({
      question: value.question,
      tag: value.tag,
    }));
}

//  Create RubricItem array with IDs for forms
export function createRubricItemsWithIds(
  inputs: RubricItemInput[]
): RubricItem[] {
  return inputs.map((input, index) => ({
    id: `rubric_${index + 1}`,
    question: input.question,
    tag: input.tag,
  }));
}

//  Tag validation and suggestions
export const COMMON_RUBRIC_TAGS = [
  "clarity",
  "completeness",
  "accuracy",
  "examples",
  "format",
  "structure",
  "relevance",
  "detail",
  "sources",
  "logic",
  "grammar",
  "style",
  "organization",
  "evidence",
  "analysis",
  "synthesis",
  "creativity",
  "feasibility",
  "methodology",
  "conclusion",
] as const;

export type CommonRubricTag = (typeof COMMON_RUBRIC_TAGS)[number];

export function isCommonTag(tag: string): tag is CommonRubricTag {
  return COMMON_RUBRIC_TAGS.includes(tag as CommonRubricTag);
}

export function suggestTags(questionText: string): CommonRubricTag[] {
  const lowerText = questionText.toLowerCase();
  const suggestions: CommonRubricTag[] = [];

  if (lowerText.includes("clear") || lowerText.includes("understand")) {
    suggestions.push("clarity");
  }
  if (lowerText.includes("complete") || lowerText.includes("comprehensive")) {
    suggestions.push("completeness");
  }
  if (lowerText.includes("accurate") || lowerText.includes("correct")) {
    suggestions.push("accuracy");
  }
  if (lowerText.includes("example") || lowerText.includes("instance")) {
    suggestions.push("examples");
  }
  if (lowerText.includes("format") || lowerText.includes("style")) {
    suggestions.push("format");
  }
  if (lowerText.includes("structure") || lowerText.includes("organize")) {
    suggestions.push("structure");
  }
  if (lowerText.includes("relevant") || lowerText.includes("appropriate")) {
    suggestions.push("relevance");
  }
  if (lowerText.includes("detail") || lowerText.includes("specific")) {
    suggestions.push("detail");
  }
  if (lowerText.includes("source") || lowerText.includes("reference")) {
    suggestions.push("sources");
  }
  if (lowerText.includes("logic") || lowerText.includes("reason")) {
    suggestions.push("logic");
  }

  // Return unique suggestions, fallback to common ones
  const unique = [...new Set(suggestions)];
  return unique.length > 0 ? unique : ["clarity", "completeness", "accuracy"];
}

// Utility functions for working with tags
export function getUniqueTagsFromItems(items: RubricItem[]): string[] {
  const tags = items.map((item) => item.tag).filter(Boolean);
  return [...new Set(tags)].sort();
}

export function groupItemsByTag(
  items: RubricItem[]
): Record<string, RubricItem[]> {
  return items.reduce((acc, item) => {
    if (!acc[item.tag]) {
      acc[item.tag] = [];
    }
    acc[item.tag].push(item);
    return acc;
  }, {} as Record<string, RubricItem[]>);
}

export function validateTagUniqueness(items: RubricItemInput[]): {
  isValid: boolean;
  errors: string[];
  duplicateTags: string[];
} {
  const tagCounts = items.reduce((acc, item) => {
    acc[item.tag] = (acc[item.tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const duplicateTags = Object.entries(tagCounts)
    .filter(([, count]) => count > 1)
    .map(([tag]) => tag);

  const errors =
    duplicateTags.length > 0
      ? [
          `Duplicate tags found: ${duplicateTags.join(
            ", "
          )}. Each tag should be unique.`,
        ]
      : [];

  return {
    isValid: duplicateTags.length === 0,
    errors,
    duplicateTags,
  };
}
