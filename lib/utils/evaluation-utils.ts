import {
  getCurrentRubricContent,
  getCurrentRubricVersionName,
  AirtableTaskRecord,
  parseRubricContent,
  RubricFormat,
} from "@/lib/schemas/task";

export interface RubricQuestion {
  key: string;
  question: string;
  tag: string;
  number: number;
}

/**
 * Parse rubric questions from current rubric version
 */
export function parseCurrentRubricQuestions(
  task: AirtableTaskRecord
): RubricQuestion[] {
  const currentRubricContent = getCurrentRubricContent(task);

  if (!currentRubricContent || typeof currentRubricContent !== "string") {
    return [];
  }

  try {
    const rubric = parseRubricContent(currentRubricContent);

    if (!rubric) {
      console.error("Failed to parse rubric content - must be in new format");
      return [];
    }

    return Object.entries(rubric)
      .filter(([key]) => key.startsWith("rubric_"))
      .map(([key, rubricItem]) => ({
        key,
        question: rubricItem.question,
        tag: rubricItem.tag,
        number: parseInt(key.replace("rubric_", "")),
      }))
      .sort((a, b) => a.number - b.number);
  } catch (error) {
    console.error("Error parsing current rubric:", error);
    return [];
  }
}

/**
 * Parse rubric questions from any rubric JSON string
 */
export function parseRubricQuestions(rubricJSON: string): RubricQuestion[] {
  if (!rubricJSON || typeof rubricJSON !== "string") {
    return [];
  }

  try {
    const rubric = parseRubricContent(rubricJSON);

    if (!rubric) {
      console.error("Failed to parse rubric content - must be in new format");
      return [];
    }

    return Object.entries(rubric)
      .filter(([key]) => key.startsWith("rubric_"))
      .map(([key, rubricItem]) => ({
        key,
        question: rubricItem.question,
        tag: rubricItem.tag,
        number: parseInt(key.replace("rubric_", "")),
      }))
      .sort((a, b) => a.number - b.number);
  } catch (error) {
    console.error("Error parsing rubric:", error);
    return [];
  }
}

/**
 * Check if task has required rubric for evaluation
 */
export function hasRequiredRubric(task: AirtableTaskRecord): boolean {
  const currentRubricContent = getCurrentRubricContent(task);
  return !!(currentRubricContent && typeof currentRubricContent === "string");
}

/**
 * Get evaluation prerequisites status
 */
export function getEvaluationPrerequisites(
  task: AirtableTaskRecord,
  evaluationType: "human-gemini" | "model-gemini" | "human-gpt" | "model-gpt"
): {
  hasRubric: boolean;
  hasHumanEval: boolean;
  hasModelEval: boolean;
  hasAlignment: boolean;
  alignmentValue?: number;
  missingItems: string[];
  versionName: string;
} {
  const hasRubric = hasRequiredRubric(task);
  const versionName = getCurrentRubricVersionName(task);
  const missingItems: string[] = [];

  if (!hasRubric) {
    missingItems.push(`${versionName} rubric`);
  }

  let hasHumanEval = false;
  let hasModelEval = false;
  let hasAlignment = false;
  let alignmentValue: number | undefined;

  switch (evaluationType) {
    case "human-gemini":
      // Only needs rubric
      break;

    case "model-gemini":
      hasHumanEval = !!(
        task.Human_Eval_Gemini && typeof task.Human_Eval_Gemini === "string"
      );
      if (!hasHumanEval) missingItems.push("Human evaluation for Gemini");
      break;

    case "human-gpt":
      // Requires Gemini alignment ≥80%
      alignmentValue = task.Alignment_Gemini as number;
      hasAlignment = !!(alignmentValue && alignmentValue >= 80);
      hasModelEval = !!(
        task.Model_Eval_Gemini && typeof task.Model_Eval_Gemini === "string"
      );

      if (!hasModelEval) {
        missingItems.push("Gemini model evaluation");
      } else if (!hasAlignment) {
        missingItems.push(
          `Gemini alignment ≥80% (currently ${alignmentValue || 0}%)`
        );
      }
      break;

    case "model-gpt":
      hasHumanEval = !!(
        task.Human_Eval_GPT && typeof task.Human_Eval_GPT === "string"
      );
      if (!hasHumanEval) missingItems.push("Human evaluation for GPT");
      break;
  }

  return {
    hasRubric,
    hasHumanEval,
    hasModelEval,
    hasAlignment,
    alignmentValue,
    missingItems,
    versionName,
  };
}

/**
 * Load existing evaluation scores from task data
 */
export function loadExistingEvaluationScores(
  task: AirtableTaskRecord,
  evaluationType: "human-gemini" | "model-gemini" | "human-gpt" | "model-gpt",
  questions: RubricQuestion[]
): Record<string, "Yes" | "No"> {
  const evaluations: Record<string, "Yes" | "No"> = {};

  let existingScoresField: string | undefined;

  switch (evaluationType) {
    case "human-gemini":
      existingScoresField = task.Human_Eval_Gemini as string;
      break;
    case "model-gemini":
      existingScoresField = task.Model_Eval_Gemini as string;
      break;
    case "human-gpt":
      existingScoresField = task.Human_Eval_GPT as string;
      break;
    case "model-gpt":
      existingScoresField = task.Model_Eval_GPT as string;
      break;
  }

  if (existingScoresField && typeof existingScoresField === "string") {
    try {
      const existingEvals = JSON.parse(existingScoresField);
      questions.forEach((q) => {
        if (existingEvals[q.key]) {
          evaluations[q.key] = existingEvals[q.key];
        }
      });
    } catch (error) {
      console.error(
        `Error parsing existing ${evaluationType} evaluations:`,
        error
      );
    }
  }

  return evaluations;
}

/**
 * Get comparison scores for model evaluation pages
 */
export function getComparisonScores(
  task: AirtableTaskRecord,
  evaluationType: "model-gemini" | "model-gpt"
): Record<string, "Yes" | "No"> {
  const scores: Record<string, "Yes" | "No"> = {};

  let humanScoresField: string | undefined;

  switch (evaluationType) {
    case "model-gemini":
      humanScoresField = task.Human_Eval_Gemini as string;
      break;
    case "model-gpt":
      humanScoresField = task.Human_Eval_GPT as string;
      break;
  }

  if (humanScoresField && typeof humanScoresField === "string") {
    try {
      return JSON.parse(humanScoresField);
    } catch (error) {
      console.error(`Error parsing human scores for ${evaluationType}:`, error);
    }
  }

  return scores;
}

/**
 * Create a new rubric in the new format from questions and tags
 */
export function createNewRubricFormat(
  questions: Array<{ question: string; tag: string }>
): string {
  const rubric: RubricFormat = {};

  questions.forEach((item, index) => {
    const key = `rubric_${index + 1}`;
    rubric[key] = {
      question: item.question,
      tag: item.tag,
    };
  });

  return JSON.stringify(rubric, null, 2);
}

/**
 * Extract questions and tags from rubric format for editing
 */
export function extractRubricItems(
  rubricJSON: string
): Array<{ question: string; tag: string }> {
  try {
    const rubric = parseRubricContent(rubricJSON);

    if (!rubric) {
      return [];
    }

    return Object.entries(rubric)
      .filter(([key]) => key.startsWith("rubric_"))
      .sort(([a], [b]) => {
        const numA = parseInt(a.replace("rubric_", ""));
        const numB = parseInt(b.replace("rubric_", ""));
        return numA - numB;
      })
      .map(([, rubricItem]) => ({
        question: rubricItem.question,
        tag: rubricItem.tag,
      }));
  } catch (error) {
    console.error("Error extracting rubric items:", error);
    return [];
  }
}

/**
 * Get all unique tags from a rubric
 */
export function getRubricTags(rubricJSON: string): string[] {
  try {
    const rubric = parseRubricContent(rubricJSON);

    if (!rubric) {
      return [];
    }

    const tags = Object.values(rubric).map((item) => item.tag);
    return [...new Set(tags)].sort();
  } catch (error) {
    console.error("Error getting rubric tags:", error);
    return [];
  }
}

/**
 * Group rubric questions by tag
 */
export function groupRubricByTag(
  questions: RubricQuestion[]
): Record<string, RubricQuestion[]> {
  return questions.reduce((acc, question) => {
    if (!acc[question.tag]) {
      acc[question.tag] = [];
    }
    acc[question.tag].push(question);
    return acc;
  }, {} as Record<string, RubricQuestion[]>);
}

/**
 * Validate that all questions have valid tags
 */
export function validateRubricTags(
  questions: Array<{ question: string; tag: string }>
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  questions.forEach((item, index) => {
    if (!item.tag || item.tag.trim().length === 0) {
      errors.push(`Question ${index + 1}: Tag cannot be empty`);
    } else if (item.tag.length > 20) {
      errors.push(`Question ${index + 1}: Tag must be 20 characters or less`);
    }

    if (!item.question || item.question.trim().length < 10) {
      errors.push(
        `Question ${index + 1}: Question must be at least 10 characters`
      );
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get suggested tags based on question content (simple heuristics)
 */
export function suggestTagForQuestion(question: string): string {
  const lowerQuestion = question.toLowerCase();

  // Simple keyword matching for tag suggestions
  if (lowerQuestion.includes("clear") || lowerQuestion.includes("understand")) {
    return "clarity";
  }
  if (lowerQuestion.includes("example") || lowerQuestion.includes("instance")) {
    return "examples";
  }
  if (
    lowerQuestion.includes("complete") ||
    lowerQuestion.includes("comprehensive")
  ) {
    return "completeness";
  }
  if (lowerQuestion.includes("accurate") || lowerQuestion.includes("correct")) {
    return "accuracy";
  }
  if (
    lowerQuestion.includes("relevant") ||
    lowerQuestion.includes("appropriate")
  ) {
    return "relevance";
  }
  if (
    lowerQuestion.includes("structure") ||
    lowerQuestion.includes("organize")
  ) {
    return "structure";
  }
  if (lowerQuestion.includes("detail") || lowerQuestion.includes("specific")) {
    return "detail";
  }
  if (lowerQuestion.includes("source") || lowerQuestion.includes("reference")) {
    return "sources";
  }
  if (lowerQuestion.includes("format") || lowerQuestion.includes("style")) {
    return "format";
  }
  if (lowerQuestion.includes("logic") || lowerQuestion.includes("reason")) {
    return "logic";
  }

  // Default fallback
  return "criterion";
}
