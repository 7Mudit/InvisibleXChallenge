import {
  getCurrentRubricContent,
  getCurrentRubricVersionName,
  AirtableTaskRecord,
} from "@/lib/schemas/task";

export interface RubricQuestion {
  key: string;
  question: string;
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
    const rubric = JSON.parse(currentRubricContent);
    return Object.entries(rubric)
      .filter(([key]) => key.startsWith("rubric_"))
      .map(([key, question]) => ({
        key,
        question: String(question),
        number: parseInt(key.replace("rubric_", "")),
      }))
      .sort((a, b) => a.number - b.number);
  } catch (error) {
    console.error("Error parsing current rubric:", error);
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
