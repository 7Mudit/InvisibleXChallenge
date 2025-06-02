export function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `TASK-${timestamp}-${random}`.toUpperCase();
}

export function truncateText(text: string, length: number = 50): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
}

export function formatTaskDisplayName(
  taskDescription: string,
  taskId: string,
  sector: string
): string {
  const truncated = truncateText(taskDescription, 45);
  return `${taskId} • ${sector} • ${truncated}`;
}

export function getStatusStepNumber(status: string): number {
  switch (status) {
    case "Task Creation":
      return 1;
    case "Round 1":
      return 2;
    case "Round 2":
      return 3;
    case "Round 3":
      return 4;
    case "Completed":
      return 5;
    default:
      return 0;
  }
}

export function canAccessRound(
  currentStatus: string,
  targetRound: string
): boolean {
  const currentStep = getStatusStepNumber(currentStatus);
  const targetStep = getStatusStepNumber(targetRound);

  return targetStep <= currentStep;
}

export function getNextAvailableRound(currentStatus: string): string | null {
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
      return "Round 1";
  }
}
