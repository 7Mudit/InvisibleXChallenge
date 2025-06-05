// components/evaluation/RubricVersionBadge.tsx

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  getCurrentRubricVersionName,
  AirtableTaskRecord,
} from "@/lib/schemas/task";
import { cn } from "@/lib/utils";

interface RubricVersionBadgeProps {
  task: AirtableTaskRecord;
  className?: string;
  showEnhanced?: boolean;
}

export const RubricVersionBadge: React.FC<RubricVersionBadgeProps> = ({
  task,
  className,
  showEnhanced = true,
}) => {
  const versionName = getCurrentRubricVersionName(task);
  const version = task.Current_Rubric_Version || 1;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        version > 2
          ? "text-amber-600 border-amber-600"
          : "text-purple-600 border-purple-600",
        className
      )}
    >
      Using {versionName}
      {showEnhanced && version > 2 && " (Enhanced)"}
    </Badge>
  );
};

interface EvaluationHeaderProps {
  title: string;
  stepNumber: number;
  taskId: string;
  task: AirtableTaskRecord;
  sectorInfo?: {
    icon: string;
    label: string;
  };
  questionCount?: number;
}

export const EvaluationHeader: React.FC<EvaluationHeaderProps> = ({
  title,
  stepNumber,
  taskId,
  task,
  sectorInfo,
  questionCount,
}) => {
  const stepColors = {
    3: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    4: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    5: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    6: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    7: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="space-y-1">
        <div className="flex items-center space-x-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <Badge
            className={
              stepColors[stepNumber as keyof typeof stepColors] || stepColors[4]
            }
            variant="outline"
          >
            Step {stepNumber}
          </Badge>
          <RubricVersionBadge task={task} />
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>{taskId}</span>
          {sectorInfo && (
            <div className="flex items-center space-x-1">
              <span>{sectorInfo.icon}</span>
              <span>{sectorInfo.label}</span>
            </div>
          )}
          {questionCount && (
            <div className="flex items-center space-x-1">
              <span>📋</span>
              <span>{questionCount} criteria</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
