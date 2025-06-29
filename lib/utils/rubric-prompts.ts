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
/**
 * Generate the rubric decomposer system prompt for creating initial rubrics
 * COMPLETE VERSION with all examples
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

Below are some examples of rubric decompositions with the new format:

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
  "rubric_1": {
    "question": "Does the response identify the inconsistent data type ('Two Hundred') in the \`TotalAmount\` column?",
    "tag": "data_types"
  },
  "rubric_2": {
    "question": "Does the response identify the inconsistent formatting ('45' missing decimal places) in \`TotalAmount\`?",
    "tag": "formatting"
  },
  "rubric_3": {
    "question": "Does the response identify the duplicate entries for CustomerID 101?",
    "tag": "duplicates"
  },
  "rubric_4": {
    "question": "Does the response *only* list inconsistencies and *not* attempt to correct them?",
    "tag": "instructions"
  }
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
  "rubric_1": {
    "question": "Does the response correctly identify the error as an incorrect method name?",
    "tag": "error_identification"
  },
  "rubric_2": {
    "question": "Does the response correctly identify the correct method name as \`getElementById\`?",
    "tag": "correction"
  },
  "rubric_3": {
    "question": "Does the response *not* provide the corrected code?",
    "tag": "instructions"
  }
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
  "rubric_1": {
    "question": "Is the response a 'Project Goals' section?",
    "tag": "format"
  },
  "rubric_2": {
    "question": "Is the response no more than 200 words?",
    "tag": "word_limit"
  },
  "rubric_3": {
    "question": "Does the response clearly state 3 distinct project goals?",
    "tag": "goal_count"
  },
  "rubric_4": {
    "question": "Is the first goal related to quantifying microplastic prevalence and types?",
    "tag": "goal_1_content"
  },
  "rubric_5": {
    "question": "Is the second goal related to determining physiological effects of microplastic exposure?",
    "tag": "goal_2_content"
  },
  "rubric_6": {
    "question": "Is the third goal related to assessing trophic transfer of microplastics?",
    "tag": "goal_3_content"
  },
  "rubric_7": {
    "question": "Does the response *not* include background information?",
    "tag": "no_background"
  },
  "rubric_8": {
    "question": "Does the response *not* include methodology?",
    "tag": "no_methodology"
  }
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
  "rubric_1": {
    "question": "Does the response include Python code?",
    "tag": "language"
  },
  "rubric_2": {
    "question": "Does the response use the Pandas library?",
    "tag": "library"
  },
  "rubric_3": {
    "question": "Does the response create a new DataFrame named \`filtered_df\`?",
    "tag": "variable_name"
  },
  "rubric_4": {
    "question": "Does the code filter rows where 'Category' is 'Electronics'?",
    "tag": "category_filter"
  },
  "rubric_5": {
    "question": "Does the code filter rows where 'Price' is greater than 100?",
    "tag": "price_filter"
  },
  "rubric_6": {
    "question": "Does the code use the AND operator (&) to combine the filtering conditions?",
    "tag": "logical_operator"
  },
  "rubric_7": {
    "question": "Does the code *not* include comments?",
    "tag": "no_comments"
  },
  "rubric_8": {
    "question": "Does the code *not* include docstrings?",
    "tag": "no_docstrings"
  },
  "rubric_9": {
    "question": "Does the code *not* print the DataFrame?",
    "tag": "no_print"
  }
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
  "rubric_1": {
    "question": "Does the response describe creating a scene, camera, and renderer?",
    "tag": "setup"
  },
  "rubric_2": {
    "question": "Does the response describe creating a cube geometry?",
    "tag": "geometry"
  },
  "rubric_3": {
    "question": "Does the response describe creating a material?",
    "tag": "material"
  },
  "rubric_4": {
    "question": "Does the response describe creating a mesh?",
    "tag": "mesh"
  },
  "rubric_5": {
    "question": "Does the response describe adding the mesh to the scene?",
    "tag": "scene_addition"
  },
  "rubric_6": {
    "question": "Does the response describe creating an animation loop that rotates the cube and renders the scene?",
    "tag": "animation"
  },
  "rubric_7": {
    "question": "Does the response *not* include any code?",
    "tag": "no_code"
  }
}
</rubrics>

## Output format

The rubrics must be output as a json within <rubrics></rubrics> tags. Each rubric will be one entry in the json.

Each entry will contain a rubric number (as the key) and an object with "question" and "tag" properties as shown in the examples above.

**IMPORTANT** Do Not answer the questions, only generate rubrics.

You will grade a question as being correct if the answer follows the criteria from a provided rubric. otherwise if it does not follow the rubric, respond incorrect.

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

  return `You are evaluating an AI model's response against specific rubric criteria. 

**CRITICAL: You must respond with ONLY a valid JSON object in the exact format specified below. Do not include any additional text, explanations, or markdown formatting.**

**Required JSON Format:**
{"rubric_1":"Yes","rubric_2":"No","rubric_3":"Yes","rubric_4":"Yes","rubric_5":"No",...,"rubric_${
    validRubrics.length
  }":"Yes"}

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
5. **IMPORTANT: Return ONLY the JSON object with no additional text**

Evaluate the model response and return your assessment in the required JSON format:`;
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
 * Validate JSON evaluation response format with comprehensive error checking
 */
export function validateEvaluationJSON(
  jsonString: string,
  expectedRubricCount: number
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  parsedData?: Record<string, "Yes" | "No">;
  summary?: {
    totalKeys: number;
    validKeys: number;
    invalidKeys: number;
    missingKeys: number;
    extraKeys: number;
    validValues: number;
    invalidValues: number;
  };
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if input is empty or just whitespace
  if (!jsonString.trim()) {
    return {
      isValid: false,
      errors: ["JSON input cannot be empty"],
      warnings: [],
    };
  }

  // Check for potential duplicate keys by looking at the raw string
  // This catches duplicates before JSON.parse() removes them
  const duplicateKeyPattern = /"([^"]+)"\s*:/g;
  const foundKeys: string[] = [];
  const duplicateKeys: string[] = [];
  let match;

  while ((match = duplicateKeyPattern.exec(jsonString)) !== null) {
    const key = match[1];
    if (foundKeys.includes(key)) {
      if (!duplicateKeys.includes(key)) {
        duplicateKeys.push(key);
      }
    } else {
      foundKeys.push(key);
    }
  }

  if (duplicateKeys.length > 0) {
    errors.push(
      `Duplicate keys found: ${duplicateKeys.join(
        ", "
      )}. Each key should appear only once.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseError) {
    // Try to give more specific error messages for common JSON errors
    const errorMessage =
      parseError instanceof Error ? parseError.message : String(parseError);

    if (errorMessage.includes("Unexpected token")) {
      errors.push(
        "Invalid JSON syntax. Check for missing quotes, commas, or brackets."
      );
    } else if (errorMessage.includes("Unexpected end")) {
      errors.push("Incomplete JSON. The JSON appears to be cut off.");
    } else {
      errors.push(`Invalid JSON format: ${errorMessage}`);
    }

    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Check if it's an object
  if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
    errors.push("Response must be a JSON object, not an array or other type");
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Generate expected keys
  const expectedKeys = Array.from(
    { length: expectedRubricCount },
    (_, i) => `rubric_${i + 1}`
  );

  // Get actual keys and analyze them
  const actualKeys = Object.keys(parsed);
  const validKeys: string[] = [];
  const invalidKeys: string[] = [];
  const missingKeys: string[] = [];
  const extraKeys: string[] = [];

  // Check for missing expected keys
  for (const expectedKey of expectedKeys) {
    if (actualKeys.includes(expectedKey)) {
      validKeys.push(expectedKey);
    } else {
      missingKeys.push(expectedKey);
    }
  }

  // Check for invalid/extra keys
  for (const actualKey of actualKeys) {
    if (!expectedKeys.includes(actualKey)) {
      // Check if it looks like a rubric key but has wrong format
      if (actualKey.startsWith("rubric")) {
        invalidKeys.push(actualKey);
      } else {
        extraKeys.push(actualKey);
      }
    }
  }

  // Report key issues
  if (actualKeys.length !== expectedRubricCount) {
    errors.push(
      `Expected exactly ${expectedRubricCount} rubric keys, but found ${actualKeys.length}`
    );
  }

  if (missingKeys.length > 0) {
    errors.push(`Missing required keys: ${missingKeys.join(", ")}`);
  }

  if (invalidKeys.length > 0) {
    errors.push(
      `Invalid rubric key format: ${invalidKeys.join(", ")}. ` +
        `Keys should be "rubric_1", "rubric_2", etc.`
    );
  }

  if (extraKeys.length > 0) {
    errors.push(`Unexpected keys found: ${extraKeys.join(", ")}`);
  }

  // Check values
  const validValues: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invalidValues: Array<{ key: string; value: any }> = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === "Yes" || value === "No") {
      validValues.push(key);
    } else {
      invalidValues.push({ key, value });
    }
  }

  // Report value issues
  if (invalidValues.length > 0) {
    const invalidValueMessages = invalidValues.map(
      ({ key, value }) => `${key}: "${value}"`
    );
    errors.push(
      `Invalid values found (must be "Yes" or "No"): ${invalidValueMessages.join(
        ", "
      )}`
    );

    // Give helpful suggestions for common mistakes
    for (const { value } of invalidValues) {
      const stringValue = String(value).toLowerCase();
      if (["true", "false"].includes(stringValue)) {
        warnings.push('Use "Yes"/"No" instead of "true"/"false"');
      } else if (["1", "0"].includes(stringValue)) {
        warnings.push('Use "Yes"/"No" instead of 1/0');
      } else if (["y", "n"].includes(stringValue)) {
        warnings.push('Use full words "Yes"/"No" instead of "Y"/"N"');
      } else if (["maybe", "unknown", "unclear"].includes(stringValue)) {
        warnings.push('Evaluation must be definitive: use "Yes" or "No" only');
      }
    }
  }

  // Create summary
  const summary = {
    totalKeys: actualKeys.length,
    validKeys: validKeys.length,
    invalidKeys: invalidKeys.length + extraKeys.length,
    missingKeys: missingKeys.length,
    extraKeys: extraKeys.length,
    validValues: validValues.length,
    invalidValues: invalidValues.length,
  };

  // Additional helpful warnings
  if (actualKeys.length > expectedRubricCount) {
    warnings.push(
      `You have ${
        actualKeys.length - expectedRubricCount
      } extra keys that will be ignored`
    );
  }

  if (validKeys.length > 0 && missingKeys.length > 0) {
    warnings.push(
      `Partially complete: ${validKeys.length}/${expectedRubricCount} keys provided`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    parsedData: errors.length === 0 ? parsed : undefined,
    summary,
  };
}
