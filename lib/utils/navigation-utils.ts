import { getCurrentRubricVersionName } from "@/lib/schemas/task";
import type { Task } from "@/lib/schemas/task";

export function getTaskNavigationRoutes(task: Task) {
  const taskId = task.TaskID;
  const currentVersion = task.Current_Rubric_Version || 1;
  const versionName = getCurrentRubricVersionName(task);

  return {
    // Core routes
    overview: `/dashboard/tasks/${taskId}`,
    results: `/dashboard/tasks/${taskId}/results`,

    // Rubric routes
    rubricV1: `/dashboard/tasks/${taskId}/rubric/v1`,
    rubricEnhance: `/dashboard/tasks/${taskId}/rubric/enhance`, // Handles V2+

    // Evaluation routes
    humanEvalGemini: `/dashboard/tasks/${taskId}/evaluation/human-gemini`,
    modelEvalGemini: `/dashboard/tasks/${taskId}/evaluation/model-gemini`,
    humanEvalGPT: `/dashboard/tasks/${taskId}/evaluation/human-gpt`,
    modelEvalGPT: `/dashboard/tasks/${taskId}/evaluation/model-gpt`,

    // Context info
    currentVersion,
    versionName,
  };
}
