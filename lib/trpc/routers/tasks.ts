import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";
import {
  CreateTaskSchema,
  getDetailedValidationError,
  TaskStatus,
  calculateTaskProgress,
  Task,
  TaskSummary,
  RubricV1InputSchema,
  HumanEvalInputSchema,
  ModelEvalInputSchema,
  calculateAlignment,
  validateRubricJSON,
  validateEvaluationScores,
  getStatusDisplayInfo,
  getRubricFieldName,
  RubricEnhanceInputSchema,
  getCurrentRubricContent,
  addAlignmentToHistory,
  parseRubricContent,
  ServerTaskInput,
  toAirtableFormat,
} from "@/lib/schemas/task";
import z from "zod";
import { generateTaskId } from "@/lib/utils/task-utils";
import { GoogleDriveService } from "@/lib/services/google-drive";

class AirtableFieldManager {
  private baseId: string;
  private tableId: string;
  private apiKey: string;

  constructor(baseId: string, tableId: string, apiKey: string) {
    this.baseId = baseId;
    this.tableId = tableId;
    this.apiKey = apiKey;
  }

  // Check if a field exists in the table
  async fieldExists(fieldName: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      if (!response.ok) {
        console.error("Failed to fetch table schema:", response.statusText);
        return false;
      }

      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = data.tables.find((t: any) => t.id === this.tableId);

      if (!table) {
        console.error("Table not found in schema");
        return false;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return table.fields.some((field: any) => field.name === fieldName);
    } catch (error) {
      console.error("Error checking field existence:", error);
      return false;
    }
  }

  // Create a new rubric field dynamically
  async createRubricField(version: number): Promise<boolean> {
    const fieldName = getRubricFieldName(version);

    try {
      // First check if field already exists
      const exists = await this.fieldExists(fieldName);
      if (exists) {
        console.log(`Field ${fieldName} already exists`);
        return true;
      }

      console.log(`Creating new field: ${fieldName}`);

      const response = await fetch(
        `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables/${this.tableId}/fields`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: fieldName,
            type: "multilineText",
            description: `Rubric version ${version} - JSON string with evaluation criteria`,
          }),
        }
      );

      if (!response.ok) {
        console.error(
          `Failed to create field ${fieldName}:`,
          response.statusText
        );
        return false;
      }

      console.log(`Successfully created field: ${fieldName}`);
      return true;
    } catch (error) {
      console.error(`Error creating field ${fieldName}:`, error);
      return false;
    }
  }

  // Ensure all required fields exist up to a certain version
  async ensureRubricFieldsExist(maxVersion: number): Promise<boolean> {
    for (let version = 1; version <= maxVersion; version++) {
      const success = await this.createRubricField(version);
      if (!success) {
        return false;
      }
    }
    return true;
  }
}

// Initialize field manager
const fieldManager = new AirtableFieldManager(
  process.env.AIRTABLE_BASE_ID!,
  process.env.AIRTABLE_TABLE_ID!,
  process.env.AIRTABLE_API_KEY!
);

function base64ToBuffer(base64Data: string): Buffer {
  return Buffer.from(base64Data, "base64");
}

export const tasksRouter = router({
  // Original create task mutation
  create: protectedProcedure
    .input(CreateTaskSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        console.log("Starting task creation");

        const userEmail = ctx.session.user.email as string;

        // Check for existing incomplete tasks
        const existingTasks = await ctx.airtable.tasksTable
          .select({
            filterByFormula: `AND({TrainerEmail} = '${userEmail}', {Status} != 'Completed')`,
            maxRecords: 1,
          })
          .all();

        if (existingTasks.length > 0) {
          const incompleteTask = existingTasks[0];
          const taskStatus = getStatusDisplayInfo(incompleteTask.fields.Status);

          throw new TRPCError({
            code: "CONFLICT",
            message: `INCOMPLETE_TASK_EXISTS:${incompleteTask.fields.TaskID}:${incompleteTask.fields.Status}:${taskStatus.label}`,
          });
        }

        const taskId = generateTaskId();
        console.log("Generated TaskID:", taskId);

        const serviceAccountKey = {
          type: "service_account",
          project_id: process.env.GOOGLE_PROJECT_ID,
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url:
            "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
          universe_domain: "googleapis.com",
        };

        const driveService = new GoogleDriveService(serviceAccountKey);
        const BASE_FOLDER_ID = process.env.GOOGLE_DRIVE_BASE_FOLDER_ID!;

        console.log("Creating google drive folders...");
        const folderResult = await driveService.createTaskFolder(
          taskId,
          BASE_FOLDER_ID
        );

        console.log("Uploading request files...");
        for (const file of input.requestFiles) {
          const fileBuffer = base64ToBuffer(file.data);
          await driveService.uploadFile(
            fileBuffer,
            file.name,
            file.type,
            folderResult.requestFolderId
          );
        }

        console.log("Uploading response_gemini files...");
        for (const file of input.responseGeminiFiles) {
          const fileBuffer = base64ToBuffer(file.data);
          await driveService.uploadFile(
            fileBuffer,
            file.name,
            file.type,
            folderResult.responseGeminiFolderId
          );
        }

        console.log("Uploading response_gpt files...");
        for (const file of input.responseGptFiles) {
          const fileBuffer = base64ToBuffer(file.data);
          await driveService.uploadFile(
            fileBuffer,
            file.name,
            file.type,
            folderResult.responseGptFolderId
          );
        }

        await driveService.setFolderPermissions(
          folderResult.taskFolderId,
          userEmail
        );

        console.log("Google Drive setup completed successfully");

        const taskData: ServerTaskInput = {
          TaskID: taskId,
          Prompt: input.Prompt,
          ProfessionalSector: input.ProfessionalSector,
          TrainerEmail: userEmail,
          Sources: folderResult.taskFolderUrl,
          OpenSourceConfirmed: input.OpenSourceConfirmed,
          LicenseNotes: input.LicenseNotes || "",
          GPTResponse: input.GPTResponse,
          GeminiResponse: input.GeminiResponse,
        };

        const finalAirtableData = toAirtableFormat(taskData);

        try {
          console.log("Creating record in Airtable:", taskId);

          const createdTask = await ctx.airtable.tasksTable.create(
            finalAirtableData
          );

          if (!createdTask) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create task record.",
            });
          }

          console.log("Task created successfully:", createdTask);

          return {
            id: createdTask.id,
            taskId: taskId,
            folderUrl: folderResult.taskFolderUrl,
            requestFileCount: input.requestFiles.length,
            responseGeminiFileCount: input.responseGeminiFiles.length,
            responseGptFileCount: input.responseGptFiles.length,
            success: true,
          };
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            console.error("Validation failed:", validationError.errors);
            const errorDetails = getDetailedValidationError(validationError);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Validation Error: ${errorDetails.summary}`,
            });
          }
          throw validationError;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Task creation failed:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        if (
          error.error === "INVALID_VALUE_FOR_COLUMN" ||
          error.message?.includes("INVALID_VALUE")
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "One or more field values are invalid. Please check your selections and try again.",
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred. Please try again.",
        });
      }
    }),

  // Step 1: Update Rubric V1
  updateRubricV1: protectedProcedure
    .input(RubricV1InputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userEmail = ctx.session.user.email;
        //  Validate new rubric JSON format with question/tag structure
        const validation = validateRubricJSON(input.rubricV1);
        if (!validation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid rubric format: ${validation.errors.join(", ")}`,
          });
        }

        // Additional validation to ensure it's the new format
        try {
          const parsed = JSON.parse(input.rubricV1);
          const isNewFormat = Object.values(parsed).every(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (item: any) =>
              typeof item === "object" &&
              typeof item.question === "string" &&
              typeof item.tag === "string"
          );

          if (!isNewFormat) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Rubric must be in new format with question and tag properties for each item",
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (parseError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid JSON format or structure",
          });
        }

        // Find the task
        const existingRecords = await ctx.airtable.tasksTable
          .select({
            filterByFormula: `AND({TaskID} = '${input.taskId}', {TrainerEmail} = '${userEmail}')`,
            maxRecords: 1,
          })
          .all();

        if (existingRecords.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
          });
        }

        const existingRecord = existingRecords[0];

        // Validate current status
        if (
          !["Task_Creation", "Rubric_V1"].includes(existingRecord.fields.Status)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for V1 rubric creation.",
          });
        }

        // Update the record with new format
        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: {
              Rubric_V1: input.rubricV1,
              Final_Rubric: input.rubricV1,
              Status: "Rubric_V1" as TaskStatus,
            },
          },
        ]);

        const updatedRecord = updatedRecords[0];

        if (!updatedRecord) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update task record.",
          });
        }

        console.log(
          "V1 Rubric saved (new format):",
          input.taskId,
          "Items:",
          validation.rubricCount
        );

        return {
          success: true,
          message: `V1 Rubric saved successfully with ${validation.rubricCount} items in new format!`,
          task: {
            id: updatedRecord.id,
            ...updatedRecord.fields,
          },
        };
      } catch (error) {
        console.error("Failed to update V1 rubric:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save V1 rubric.",
        });
      }
    }),

  // Fix the updateRubricEnhanced mutation in your router

  updateRubricEnhanced: protectedProcedure
    .input(RubricEnhanceInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userEmail = ctx.session.user.email;
        // UPDATED: Validate new rubric JSON format with question/tag structure
        const validation = validateRubricJSON(input.rubricContent);
        if (!validation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid rubric format: ${validation.errors.join(", ")}`,
          });
        }

        // UPDATED: Additional validation to ensure it's the new format
        try {
          const parsed = JSON.parse(input.rubricContent);
          const isNewFormat = Object.values(parsed).every(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (item: any) =>
              typeof item === "object" &&
              typeof item.question === "string" &&
              typeof item.tag === "string"
          );

          if (!isNewFormat) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Rubric must be in new format with question and tag properties for each item",
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (parseError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid JSON format or structure",
          });
        }

        const existingRecords = await ctx.airtable.tasksTable
          .select({
            filterByFormula: `AND({TaskID} = '${input.taskId}', {TrainerEmail} = '${userEmail}')`,
            maxRecords: 1,
          })
          .all();

        if (existingRecords.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
          });
        }

        const existingRecord = existingRecords[0];

        // Determine if this is V2 creation or iteration enhancement
        const isCreatingV2 = existingRecord.fields.Status === "Rubric_V1";
        const isIterating = existingRecord.fields.Status === "Rubric_Enhancing";

        if (!isCreatingV2 && !isIterating) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for rubric enhancement.",
          });
        }

        // Validate target version
        const currentVersion =
          existingRecord.fields.Current_Rubric_Version || 1;
        const expectedTargetVersion = isCreatingV2 ? 2 : currentVersion + 1;

        if (input.targetVersion !== expectedTargetVersion) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Target version mismatch. Expected ${expectedTargetVersion}, got ${input.targetVersion}`,
          });
        }

        // Ensure the target version field exists
        await fieldManager.ensureRubricFieldsExist(input.targetVersion);

        const rubricFieldName = getRubricFieldName(input.targetVersion);

        // Determine next status
        let nextStatus: TaskStatus;
        if (isCreatingV2) {
          nextStatus = "Rubric_V2";
        } else {
          // For iterations, we go back to enhancing mode until evaluation
          nextStatus = "Rubric_Enhancing";
        }

        // Update the record with the new version
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateFields: any = {
          [rubricFieldName]: input.rubricContent,
          Current_Rubric_Version: input.targetVersion,
          Final_Rubric: input.rubricContent,
          Status: nextStatus,
        };

        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: updateFields,
          },
        ]);

        const updatedRecord = updatedRecords[0];

        if (!updatedRecord) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update task record.",
          });
        }

        console.log(
          `V${input.targetVersion} Rubric saved (new format):`,
          input.taskId,
          "Items:",
          validation.rubricCount,
          "Type:",
          isCreatingV2 ? "V2 Creation" : "Iteration"
        );

        return {
          success: true,
          message: `V${input.targetVersion} Rubric ${
            isCreatingV2 ? "created" : "enhanced"
          } successfully with ${validation.rubricCount} items in new format!`,
          version: input.targetVersion,
          isCreatingV2,
          task: {
            id: updatedRecord.id,
            ...updatedRecord.fields,
          },
        };
      } catch (error) {
        console.error("Failed to update enhanced rubric:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save enhanced rubric.",
        });
      }
    }),

  // Step 3: Human Evaluation - Gemini
  updateHumanEvalGemini: protectedProcedure
    .input(HumanEvalInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userEmail = ctx.session.user.email;

        const existingRecords = await ctx.airtable.tasksTable
          .select({
            filterByFormula: `AND({TaskID} = '${input.taskId}', {TrainerEmail} = '${userEmail}')`,
            maxRecords: 1,
          })
          .all();

        if (existingRecords.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
          });
        }

        const existingRecord = existingRecords[0];

        if (
          !["Rubric_V2", "Rubric_Enhancing", "Human_Eval_Gemini"].includes(
            existingRecord.fields.Status
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for human evaluation.",
          });
        }

        // Get current rubric for validation
        const currentRubric = getCurrentRubricContent(existingRecord.fields);
        if (!currentRubric) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Current rubric not found. Please create/enhance rubric first.",
          });
        }

        const scoreValidation = validateEvaluationScores(
          input.humanScores,
          currentRubric
        );
        if (!scoreValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid evaluation scores: ${scoreValidation.errors.join(
              ", "
            )}`,
          });
        }

        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: {
              Human_Eval_Gemini: input.humanScores,
              Status: "Human_Eval_Gemini" as TaskStatus,
            },
          },
        ]);

        const updatedRecord = updatedRecords[0];

        if (!updatedRecord) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update task record.",
          });
        }

        console.log("Human evaluation for Gemini saved:", input.taskId);

        return {
          success: true,
          message: "Human evaluation for Gemini saved successfully!",
          task: {
            id: updatedRecord.id,
            ...updatedRecord.fields,
          },
        };
      } catch (error) {
        console.error("Failed to save human evaluation for Gemini:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save human evaluation for Gemini.",
        });
      }
    }),

  // Step 4: Model Evaluation - Gemini (with alignment calculation)
  updateModelEvalGemini: protectedProcedure
    .input(ModelEvalInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userEmail = ctx.session.user.email;

        const existingRecords = await ctx.airtable.tasksTable
          .select({
            filterByFormula: `AND({TaskID} = '${input.taskId}', {TrainerEmail} = '${userEmail}')`,
            maxRecords: 1,
          })
          .all();

        if (existingRecords.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
          });
        }

        const existingRecord = existingRecords[0];

        if (
          !["Human_Eval_Gemini", "Model_Eval_Gemini"].includes(
            existingRecord.fields.Status
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for model evaluation.",
          });
        }

        // Get current rubric in new format and validate
        const currentRubricContent = getCurrentRubricContent(
          existingRecord.fields
        );
        if (!currentRubricContent || !existingRecord.fields.Human_Eval_Gemini) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Current rubric and Human evaluation are required.",
          });
        }

        // Validate that rubric is in new format
        try {
          const rubric = parseRubricContent(currentRubricContent);
          if (!rubric) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Current rubric is not in the correct new format with question/tag structure.",
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Failed to parse current rubric - must be in new format.",
          });
        }

        const scoreValidation = validateEvaluationScores(
          input.modelScores,
          currentRubricContent
        );
        if (!scoreValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid evaluation scores: ${scoreValidation.errors.join(
              ", "
            )}`,
          });
        }

        //  Calculate alignment using new format
        const alignment = calculateAlignment(
          existingRecord.fields.Human_Eval_Gemini,
          input.modelScores,
          currentRubricContent
        );

        const currentVersion =
          existingRecord.fields.Current_Rubric_Version || 1;

        // Update alignment history
        const updatedHistory = addAlignmentToHistory(
          existingRecord.fields,
          currentVersion,
          alignment.percentage,
          alignment.misalignedItems.length
        );

        // Determine next status WITHOUT incrementing version yet
        let nextStatus: TaskStatus;

        if (alignment.percentage >= 80) {
          nextStatus = "Model_Eval_Gemini";
        } else {
          nextStatus = "Rubric_Enhancing";
        }

        // Ensure the next version field exists (for future use)
        const nextVersion = currentVersion + 1;
        await fieldManager.ensureRubricFieldsExist(nextVersion);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateFields: any = {
          Model_Eval_Gemini: input.modelScores,
          Alignment_Gemini: alignment.percentage,
          Misaligned_Gemini: JSON.stringify(alignment.misalignedItems),
          Alignment_History: updatedHistory,
          Status: nextStatus,
        };

        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: updateFields,
          },
        ]);

        const updatedRecord = updatedRecords[0];

        if (!updatedRecord) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update task record.",
          });
        }

        console.log(
          "Model evaluation for Gemini saved (new format):",
          input.taskId,
          "Alignment:",
          alignment.percentage + "%",
          "Current version:",
          currentVersion,
          "Next version will be:",
          nextVersion
        );

        const message =
          alignment.percentage >= 80
            ? `Model evaluation completed! Alignment: ${alignment.percentage}% - Ready for GPT evaluation.`
            : `Alignment: ${alignment.percentage}%. Need to enhance V${currentVersion} to V${nextVersion}.`;

        return {
          success: true,
          message,
          alignment: alignment.percentage,
          misalignedCount: alignment.misalignedItems.length,
          needsRevision: alignment.percentage < 80,
          nextVersion: nextVersion,
          currentVersion: currentVersion,
          task: {
            id: updatedRecord.id,
            ...updatedRecord.fields,
          },
        };
      } catch (error) {
        console.error("Failed to save model evaluation for Gemini:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save model evaluation for Gemini.",
        });
      }
    }),

  // Step 5: Human Evaluation - GPT
  updateHumanEvalGPT: protectedProcedure
    .input(HumanEvalInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userEmail = ctx.session.user.email;

        const existingRecords = await ctx.airtable.tasksTable
          .select({
            filterByFormula: `AND({TaskID} = '${input.taskId}', {TrainerEmail} = '${userEmail}')`,
            maxRecords: 1,
          })
          .all();

        if (existingRecords.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
          });
        }

        const existingRecord = existingRecords[0];

        if (existingRecord.fields.Status !== "Model_Eval_Gemini") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for GPT evaluation.",
          });
        }

        if (
          !existingRecord.fields.Alignment_Gemini ||
          existingRecord.fields.Alignment_Gemini < 80
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Gemini alignment must be ≥80% before proceeding to GPT evaluation.",
          });
        }

        const currentRubric = getCurrentRubricContent(existingRecord.fields);
        if (!currentRubric) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Current rubric not found.",
          });
        }

        const scoreValidation = validateEvaluationScores(
          input.humanScores,
          currentRubric
        );
        if (!scoreValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid evaluation scores: ${scoreValidation.errors.join(
              ", "
            )}`,
          });
        }

        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: {
              Human_Eval_GPT: input.humanScores,
              Status: "Human_Eval_GPT" as TaskStatus,
            },
          },
        ]);

        const updatedRecord = updatedRecords[0];

        if (!updatedRecord) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update task record.",
          });
        }

        console.log("Human evaluation for GPT saved:", input.taskId);

        return {
          success: true,
          message: "Human evaluation for GPT saved successfully!",
          task: {
            id: updatedRecord.id,
            ...updatedRecord.fields,
          },
        };
      } catch (error) {
        console.error("Failed to save human evaluation for GPT:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save human evaluation for GPT.",
        });
      }
    }),

  // Step 6: Model Evaluation - GPT (final step)
  updateModelEvalGPT: protectedProcedure
    .input(ModelEvalInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const userEmail = ctx.session.user.email;
        const existingRecords = await ctx.airtable.tasksTable
          .select({
            filterByFormula: `AND({TaskID} = '${input.taskId}', {TrainerEmail} = '${userEmail}')`,
            maxRecords: 1,
          })
          .all();

        if (existingRecords.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
          });
        }

        const existingRecord = existingRecords[0];

        if (
          !["Human_Eval_GPT", "Model_Eval_GPT"].includes(
            existingRecord.fields.Status
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Task is not in the correct state for GPT model evaluation.",
          });
        }

        const currentRubric = getCurrentRubricContent(existingRecord.fields);
        if (!currentRubric || !existingRecord.fields.Human_Eval_GPT) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Current rubric and Human evaluation for GPT are required.",
          });
        }

        const scoreValidation = validateEvaluationScores(
          input.modelScores,
          currentRubric
        );
        if (!scoreValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid evaluation scores: ${scoreValidation.errors.join(
              ", "
            )}`,
          });
        }

        const alignment = calculateAlignment(
          existingRecord.fields.Human_Eval_GPT,
          input.modelScores,
          currentRubric
        );

        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: {
              Model_Eval_GPT: input.modelScores,
              Alignment_GPT: alignment.percentage,
              Misaligned_GPT: JSON.stringify(alignment.misalignedItems),
              Status: "Completed" as TaskStatus,
            },
          },
        ]);

        const updatedRecord = updatedRecords[0];

        if (!updatedRecord) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update task record.",
          });
        }

        console.log(
          "Task completed:",
          input.taskId,
          "GPT Alignment:",
          alignment.percentage + "%"
        );

        return {
          success: true,
          message: `Task completed successfully! GPT alignment: ${alignment.percentage}%`,
          geminiAlignment: existingRecord.fields.Alignment_Gemini || 0,
          gptAlignment: alignment.percentage,
          task: {
            id: updatedRecord.id,
            ...updatedRecord.fields,
          },
        };
      } catch (error) {
        console.error("Failed to complete task:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to complete task.",
        });
      }
    }),

  // Get all Tasks for requested trainer
  getMyTasks: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userEmail = ctx.session.user.email;

      console.log("Fetching tasks for user:", userEmail);

      const records = await ctx.airtable.tasksTable
        .select({
          filterByFormula: `{TrainerEmail} = '${userEmail}'`,
          sort: [{ field: "Created", direction: "desc" }],
        })
        .all();

      const tasks: TaskSummary[] = records.map((record) => ({
        id: record.id,
        TaskID: record.fields.TaskID,
        Prompt: record.fields.Prompt,
        ProfessionalSector: record.fields.ProfessionalSector,
        Status: record.fields.Status,
        Progress: calculateTaskProgress(
          record.fields.Status,
          record.fields.Current_Rubric_Version
        ),
        TrainerEmail: record.fields.TrainerEmail,
        Created: record.fields.Created,
      }));

      return tasks;
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch tasks.",
      });
    }
  }),

  // get task by id
  getTaskById: protectedProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const userEmail = ctx.session.user.email;

        console.log("Fetching task:", input.taskId);

        const records = await ctx.airtable.tasksTable
          .select({
            filterByFormula: `AND({TaskID} = '${input.taskId}', {TrainerEmail} = '${userEmail}')`,
            maxRecords: 1,
          })
          .all();

        if (records.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Task not found or access denied.",
          });
        }

        const record = records[0];
        const task: Task = {
          id: record.id,
          ...record.fields,
        };

        return task;
      } catch (error) {
        console.error("Failed to fetch task:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch task.",
        });
      }
    }),
});
