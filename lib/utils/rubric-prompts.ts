// lib/utils/rubric-prompts.ts

export interface RubricItem {
  id: string;
  question: string;
  tag: string;
  humanScore?: boolean;
  aiScore?: boolean;
}

export interface TaskData {
  Prompt: string;
  GeminiResponse: string;
  GPTResponse?: string;
}

/**
 * Generate the rubric decomposer system prompt for creating initial rubrics
 */
export function generateRubricDecomposerPrompt(task: TaskData): string {
  return `You are an expert rubric generator. Your task is to create rubrics that are Yes or No questions **designed to be used for automated grading of model responses.** These rubrics will be used by a separate grading system to determine if a model's answer is CORRECT or INCORRECT based on these criteria.

Given a *question* and a *model's answer*, you will come up with rubrics which are Yes or No questions based on the *question*, to verify whether the *answer* fulfilled the requirements in the *question*.

**Input:**

1. **question:** ${task.Prompt}

2. **answer:** ${task.GeminiResponse}

**Output:**

The rubrics must be output as a JSON object within \`<rubrics></rubrics>\` tags. Each rubric will be one entry in the JSON.

Each entry will contain a rubric number (as the key) and an object with "question" and "tag" properties, as shown in the examples below.

The detailed description of the task is below.

## Rubrics

The task is to appropriately capture all the different constraints that are expressed in the *question*. Given these rubrics, anyone could determine how well and completely the model fulfilled the constraints in the user prompts.

How to write rubrics:

1. Rubrics are always full sentence interrogative constructions that yield a Yes/No response. Make sure the questions are phrased such that a 'Yes' response always means the *answer* followed a particular instruction from the *question*, **and should contribute to a 'CORRECT' grade.** 'No' means it did not follow the instruction, **and should contribute to an 'INCORRECT' grade.**

2. Rubrics must be fully decontextualized. Do not assume that context is shared between rubrics, each rubric's content should stand on its own.

3. Rubrics must be as granular as possible and verify one constraint at a time. Do not merge 2 or more constraints into one rubric. Each rubric must verify only one thing. Sometimes each sentence in the *question* might yield multiple rubrics. As a rule of thumb, check which constraints in the *question* can hold true or false independently of each other --- these are great candidates for individual rubrics.

**IMPORTANT** It is very important to have as many rubrics as possible. Do not ever merge rubrics into one!

4. Some *questions* contain descriptions of the genre or format that the *answer* should be in, and then add specifications on the content that should be included. Create separate rubrics for assessing genre/format and content.

5. Some *questions* will contain constraints on producing an output that is deterministically resolvable. In those cases, the rubrics should be a resolved version of the constraints, rather than just asking if the response is correct.

6. Rubrics must replicate the wording from the *question* as much as possible.

7. Rubrics maintain the polarity of the constructions in the *question*. (e.g., "Do not include..." should become "Does the response not include...")

8. Rubrics must be ordered in the same order as their corresponding constraints appear in the *question*.

9. Rubrics must be unique; do not duplicate rubrics even if the constraints appear multiple times.

10. If there are conflicting instructions, only write the rubric that is closest to the end of the *question*.

11. **NEW: Tags** - Each rubric must include a descriptive "tag" that categorizes what capability or aspect the rubric is checking. Tags should be:
    - 1-20 characters long
    - Descriptive of the criterion being evaluated
    - Use lowercase with underscores for multi-word tags (e.g., "clarity", "examples", "code_quality")
    - Common tags include: clarity, completeness, accuracy, examples, format, structure, relevance, detail, sources, logic

**IMPORTANT** You must follow all the guidelines mentioned above to write rubrics. Failure to do so will have really bad consequences.

## Output format

The rubrics must be output as a json within <rubrics></rubrics> tags. Each rubric will be one entry in the json.

Each entry will contain a rubric number (as the key) and an object with "question" and "tag" properties as shown in the examples above.

**IMPORTANT** Do Not answer the questions, only generate rubrics.

Now generate rubrics(at least 15) for the conversation below:

**question:** ${task.Prompt}

**answer:** ${task.GeminiResponse}`;
}

/**
 * Generate the rubric checker system prompt for evaluating responses
 * FIXED: Now properly uses actual tags from the rubric items
 */
export function generateRubricCheckerPrompt(
  task: TaskData,
  rubricItems: RubricItem[]
): string {
  const validRubrics = rubricItems.filter(
    (item) => item.question.trim() && item.tag.trim()
  );

  if (validRubrics.length === 0) {
    return "Please create at least one valid rubric item before generating the checker prompt.";
  }

  // Create rubric JSON in the new format for the prompt - using ACTUAL tags
  const rubricJson = validRubrics.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = {
      question: item.question,
      tag: item.tag, // This now uses the actual tag from the rubric item
    };
    return acc;
  }, {} as Record<string, { question: string; tag: string }>);

  return `You will evaluate a model response against specific rubric criteria. For each criterion, answer "Yes" if the response meets the requirement or "No" if it doesn't.

**Question/Task:**
${task.Prompt}

**Model Response to Evaluate:**
${task.GeminiResponse}

**Evaluation Rubric:**
${JSON.stringify(rubricJson, null, 2)}

**Instructions:**
1. Read each rubric criterion carefully
2. Check if the model response meets that specific requirement
3. Respond with "Yes" if the criterion is met, "No" if it is not met
4. Be objective and consistent in your evaluation

**Format your response as:**
rubric_1: [Yes/No]
rubric_2: [Yes/No]
rubric_3: [Yes/No]
...
(continue for all rubric items)

Please evaluate the model response against each criterion:`;
}

/**
 * Calculate alignment percentage between human and AI scores
 */
export function calculateAlignment(rubricItems: RubricItem[]): {
  alignmentPercentage: number;
  alignedCount: number;
  totalScoredCount: number;
  misalignedItems: Array<{
    id: string;
    question: string;
    tag: string;
    humanScore: boolean;
    aiScore: boolean;
  }>;
} {
  const scoredItems = rubricItems.filter(
    (item) => item.humanScore !== undefined && item.aiScore !== undefined
  );

  if (scoredItems.length === 0) {
    return {
      alignmentPercentage: 0,
      alignedCount: 0,
      totalScoredCount: 0,
      misalignedItems: [],
    };
  }

  const alignedItems = scoredItems.filter(
    (item) => item.humanScore === item.aiScore
  );

  const misalignedItems = scoredItems
    .filter((item) => item.humanScore !== item.aiScore)
    .map((item) => ({
      id: item.id,
      question: item.question,
      tag: item.tag,
      humanScore: item.humanScore!,
      aiScore: item.aiScore!,
    }));

  const alignmentPercentage = Math.round(
    (alignedItems.length / scoredItems.length) * 100
  );

  return {
    alignmentPercentage,
    alignedCount: alignedItems.length,
    totalScoredCount: scoredItems.length,
    misalignedItems,
  };
}

/**
 * Validate minimum rubric requirements including 80% alignment
 */
export function validateRubricRequirements(rubricItems: RubricItem[]): {
  isValid: boolean;
  validCount: number;
  scoredCount: number;
  missingCount: number;
  alignmentPercentage: number;
  hasMinimumAlignment: boolean;
  errors: string[];
} {
  const validRubrics = rubricItems.filter(
    (item) => item.question.trim() && item.tag.trim()
  );

  const scoredRubrics = validRubrics.filter(
    (item) => item.humanScore !== undefined && item.aiScore !== undefined
  );

  const alignment = calculateAlignment(rubricItems);

  const errors: string[] = [];
  const validCount = validRubrics.length;
  const scoredCount = scoredRubrics.length;
  const missingCount = Math.max(0, 15 - validCount);
  const alignmentPercentage = alignment.alignmentPercentage;
  const hasMinimumAlignment = alignmentPercentage >= 80;

  if (validCount < 15) {
    errors.push(
      `Need at least 15 complete rubric items. Currently have ${validCount}.`
    );
  }

  if (scoredCount < validCount) {
    errors.push(
      `Please provide both human and AI scores for all ${validCount} rubric items. ${
        validCount - scoredCount
      } items need scoring.`
    );
  }

  if (scoredCount >= 15 && alignmentPercentage < 80) {
    errors.push(
      `Minimum 80% human-AI alignment required for submission. Current alignment: ${alignmentPercentage}%.`
    );
  }

  // Validate individual rubric items
  rubricItems.forEach((item, index) => {
    if (item.question.trim() && item.question.length < 10) {
      errors.push(
        `Rubric item ${
          index + 1
        }: Question must be at least 10 characters long.`
      );
    }

    if (item.tag.trim() && item.tag.length > 20) {
      errors.push(
        `Rubric item ${index + 1}: Tag must be 20 characters or less.`
      );
    }

    if (item.tag.trim() && item.tag.length < 1) {
      errors.push(`Rubric item ${index + 1}: Tag cannot be empty.`);
    }
  });

  return {
    isValid:
      errors.length === 0 &&
      validCount >= 15 &&
      scoredCount >= 15 &&
      hasMinimumAlignment,
    validCount,
    scoredCount,
    missingCount,
    alignmentPercentage,
    hasMinimumAlignment,
    errors,
  };
}

/**
 * Format rubric data for submission to backend (updated for new format)
 */
export function formatRubricForSubmission(rubricItems: RubricItem[]): {
  rubricJson: string;
  humanScoresJson: string;
  aiScoresJson: string;
  rubricItemsJson: string;
} {
  const validRubrics = rubricItems.filter(
    (item) => item.question.trim() && item.tag.trim()
  );

  // NEW: Rubric JSON in new format with actual tags
  const rubricJson = validRubrics.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = {
      question: item.question,
      tag: item.tag, // Use actual tag from item
    };
    return acc;
  }, {} as Record<string, { question: string; tag: string }>);

  // Human scores JSON (unchanged)
  const humanScores = validRubrics.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = item.humanScore === true ? "Yes" : "No";
    return acc;
  }, {} as Record<string, string>);

  // AI scores JSON (unchanged)
  const aiScores = validRubrics.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = item.aiScore === true ? "Yes" : "No";
    return acc;
  }, {} as Record<string, string>);

  // Complete rubric items with metadata (updated with actual tags)
  const rubricItemsWithMetadata = validRubrics.map((item, index) => ({
    rubricNumber: index + 1,
    question: item.question,
    tag: item.tag, // Use actual tag
    humanScore: item.humanScore,
    aiScore: item.aiScore,
  }));

  return {
    rubricJson: JSON.stringify(rubricJson),
    humanScoresJson: JSON.stringify(humanScores),
    aiScoresJson: JSON.stringify(aiScores),
    rubricItemsJson: JSON.stringify(rubricItemsWithMetadata),
  };
}

/**
 * Convert rubric items array to new JSON format with actual tags
 */
export function rubricItemsToNewFormat(
  items: Array<{ question: string; tag: string }>
): string {
  const rubric = items.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = {
      question: item.question,
      tag: item.tag, // Use actual tag from item
    };
    return acc;
  }, {} as Record<string, { question: string; tag: string }>);

  return JSON.stringify(rubric, null, 2);
}

/**
 * Convert new format JSON to rubric items array
 */
export function newFormatToRubricItems(
  rubricJson: string
): Array<{ question: string; tag: string }> {
  try {
    const rubric = JSON.parse(rubricJson);

    return (
      Object.entries(rubric)
        .filter(([key]) => key.startsWith("rubric_"))
        .sort(([a], [b]) => {
          const numA = parseInt(a.replace("rubric_", ""));
          const numB = parseInt(b.replace("rubric_", ""));
          return numA - numB;
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map(([, value]: [string, any]) => ({
          question: value.question || "",
          tag: value.tag || "", // Extract actual tag
        }))
    );
  } catch (error) {
    console.error("Error converting new format to rubric items:", error);
    return [];
  }
}

/**
 * Generate example rubric in new format for documentation
 */
export function generateExampleRubric(): string {
  const exampleRubric = {
    rubric_1: {
      question: "Does the response clearly explain the main concept?",
      tag: "clarity",
    },
    rubric_2: {
      question: "Does the response provide specific examples?",
      tag: "examples",
    },
    rubric_3: {
      question: "Does the response address all parts of the question?",
      tag: "completeness",
    },
  };

  return JSON.stringify(exampleRubric, null, 2);
}
