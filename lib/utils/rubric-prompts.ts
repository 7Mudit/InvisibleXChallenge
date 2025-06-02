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

Each entry will contain a rubric number (as the key) and the rubric text (as the value), as shown in the examples below.

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

**IMPORTANT** You must follow all the guidelines mentioned above to write rubrics. Failure to do so will have really bad consequences.

Below are some examples of rubric decompositions:

**Example 1 (Data-Science & Analysis - Finding inconsistencies)**

**question:** Identify and list any inconsistencies in the following dataset. Do not attempt to correct the data, only list the inconsistencies. The dataset represents customer orders, and should have consistent data types within each column.

\`\`\`csv
CustomerID,OrderDate,TotalAmount,PaymentMethod
101,2023-01-15,125.50,Credit Card
102,2023-02-28,87.20,Debit Card
103,2023-03-10,Two Hundred,Cash
104,2023-04-01,45,Paypal
101,2023-01-15,125.50,Credit Card
\`\`\`

**answer:**

- The \`TotalAmount\` column has inconsistent data types: "Two Hundred" is text, while the others are numeric.
- The \`TotalAmount\` column has inconsistent formatting. "45" is missing decimal places present in the other entries.
- CustomerID 101 has duplicate entries.

<rubrics>
{
  "rubric_1": "Does the response identify the inconsistent data type ('Two Hundred') in the \`TotalAmount\` column?",
  "rubric_2": "Does the response identify the inconsistent formatting ('45' missing decimal places) in \`TotalAmount\`?",
  "rubric_3": "Does the response identify the duplicate entries for CustomerID 101?",
  "rubric_4": "Does the response *only* list inconsistencies and *not* attempt to correct them?"
}
</rubrics>

**Example 2 (Web Development - Troubleshooting)**

**question:** The following JavaScript code is intended to change the text color of a button with the ID "myButton" to red when it's clicked. It's not working. Identify the error, but do *not* provide the corrected code.

\`\`\`javascript
document.getElementByID("myButton").style.color = "red";
\`\`\`

**answer:** The method name is incorrect. It should be \`getElementById\`, not \`getElementByID\`.

<rubrics>
{
  "rubric_1": "Does the response correctly identify the error as an incorrect method name?",
  "rubric_2": "Does the response correctly identify the correct method name as \`getElementById\`?",
  "rubric_3": "Does the response *not* provide the corrected code?"
}
</rubrics>

**Example 3 (STEM Research - Grant Writing)**

**question:** Write the "Project Goals" section of a grant proposal for research on the effects of microplastics on marine invertebrate populations. The section should be no more than 200 words and should clearly state 3 distinct project goals. Do *not* include background information or methodology.

**answer:**

The primary goals of this research project are:

1. To quantify the prevalence and types of microplastics found in the tissues of key marine invertebrate species in [Specific Location].

2. To determine the physiological effects (e.g., growth rate, reproductive success) of exposure to different concentrations of common microplastic types on these species.

3. To assess the potential for trophic transfer of microplastics from these invertebrates to higher-level predators.

<rubrics>
{
  "rubric_1": "Is the response a 'Project Goals' section?",
  "rubric_2": "Is the response no more than 200 words?",
  "rubric_3": "Does the response clearly state 3 distinct project goals?",
  "rubric_4": "Is the first goal related to quantifying microplastic prevalence and types?",
  "rubric_5": "Is the second goal related to determining physiological effects of microplastic exposure?",
  "rubric_6": "Is the third goal related to assessing trophic transfer of microplastics?",
  "rubric_7": "Does the response *not* include background information?",
  "rubric_8": "Does the response *not* include methodology?"
}
</rubrics>

**Example 4 (Data Science - Categorizing/Filtering with Code)**

**question:** Write Python code using Pandas to filter a DataFrame named \`df\`. The DataFrame contains columns 'Category' (string), 'Price' (float), and 'InStock' (boolean). The filtered DataFrame should include only rows where 'Category' is 'Electronics' AND 'Price' is greater than 100. Do not include any comments or docstrings. Do not print the DataFrame.

**answer:**

\`\`\`python
import pandas as pd
filtered_df = df[(df['Category'] == 'Electronics') & (df['Price'] > 100)]
\`\`\`

<rubrics>
{
  "rubric_1": "Does the response include Python code?",
  "rubric_2": "Does the response use the Pandas library?",
  "rubric_3": "Does the response create a new DataFrame named \`filtered_df\`?",
  "rubric_4": "Does the code filter rows where 'Category' is 'Electronics'?",
  "rubric_5": "Does the code filter rows where 'Price' is greater than 100?",
  "rubric_6": "Does the code use the AND operator (&) to combine the filtering conditions?",
  "rubric_7": "Does the code *not* include comments?",
  "rubric_8": "Does the code *not* include docstrings?",
  "rubric_9": "Does the code *not* print the DataFrame?"
}
</rubrics>

**Example 5 (Web development - Interactive Web Graphics)**

**question:** Describe, in plain language, the steps required to create a basic, rotating 3D cube using Three.js. Do *not* include any code.

**answer:**

1. Create a scene, camera, and renderer.
2. Create a cube geometry.
3. Create a material (e.g., a basic color).
4. Create a mesh by combining the geometry and material.
5. Add the mesh to the scene.
6. Create an animation loop that rotates the cube and renders the scene.

<rubrics>
{
  "rubric_1": "Does the response describe creating a scene, camera, and renderer?",
  "rubric_2": "Does the response describe creating a cube geometry?",
  "rubric_3": "Does the response describe creating a material?",
  "rubric_4": "Does the response describe creating a mesh?",
  "rubric_5": "Does the response describe adding the mesh to the scene?",
  "rubric_6": "Does the response describe creating an animation loop that rotates the cube and renders the scene?",
  "rubric_7": "Does the response *not* include any code?"
}
</rubrics>

## Output format

The rubrics must be output as a json within <rubrics></rubrics> tags. Each rubrics will be one entry in the json.

Each entry will contain a rubric number and the rubric as shown in the examples above.

**IMPORTANT** Do Not answer the questions, only generate rubrics.

Now generate rubrics for the conversation below:

**question:** ${task.Prompt}

**answer:** ${task.GeminiResponse}`;
}

/**
 * Generate the rubric checker system prompt for evaluating responses
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

  const rubricJson = validRubrics.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = item.question;
    return acc;
  }, {} as Record<string, string>);

  return `You will grade a question as being CORRECT if the answer follows the criteria from a provided rubric. Otherwise if it does not follow the rubric, respond INCORRECT.

Question: ${task.Prompt}

Rubric: ${JSON.stringify(rubricJson, null, 2)}

Answer: {model_answer}

Following the rubric, is the answer YES or NO?

Response:`;
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
 * Format rubric data for submission to backend
 */
export function formatRubricForSubmission(
  rubricItems: RubricItem[]
  // comments?: string
): {
  rubricJson: string;
  humanScoresJson: string;
  aiScoresJson: string;
  rubricItemsJson: string;
} {
  const validRubrics = rubricItems.filter(
    (item) => item.question.trim() && item.tag.trim()
  );

  // Simple rubric JSON for the Rubric field
  const rubricJson = validRubrics.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = item.question;
    return acc;
  }, {} as Record<string, string>);

  // Human scores JSON
  const humanScores = validRubrics.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = item.humanScore === true ? "Yes" : "No";
    return acc;
  }, {} as Record<string, string>);

  // AI scores JSON
  const aiScores = validRubrics.reduce((acc, item, index) => {
    acc[`rubric_${index + 1}`] = item.aiScore === true ? "Yes" : "No";
    return acc;
  }, {} as Record<string, string>);

  // Complete rubric items with metadata
  const rubricItemsWithMetadata = validRubrics.map((item, index) => ({
    rubricNumber: index + 1,
    question: item.question,
    tag: item.tag,
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
