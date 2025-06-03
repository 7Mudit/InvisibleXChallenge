import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";
import {
  addServerFields,
  CreateTaskSchema,
  getDetailedValidationError,
  ServerTaskSchema,
  TaskStatus,
  toAirtableFormat,
  calculateTaskProgress,
  Task,
  TaskSummary,
  RubricV1InputSchema,
  RubricV2InputSchema,
  HumanEvalInputSchema,
  ModelEvalInputSchema,
  calculateAlignment,
  validateRubricJSON,
  validateEvaluationScores,
} from "@/lib/schemas/task";
import { generateTaskId } from "@/lib/utils/task-utils";
import { clerkClient } from "@clerk/nextjs/server";
import z from "zod";

export const tasksRouter = router({
  // Original create task mutation (updated to use new status)
  create: protectedProcedure
    .input(CreateTaskSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        console.log("Starting task creation");

        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "User email not found. Please ensure your account has a valid email address.",
          });
        }

        if (!userEmail.endsWith("@invisible.email")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Only @invisible.email accounts are authorized to create tasks.",
          });
        }

        const serverData = addServerFields(input, userEmail);

        try {
          const validatedServerData = ServerTaskSchema.parse(serverData);
          const taskID = generateTaskId();
          const airtableData = toAirtableFormat(validatedServerData, taskID);

          console.log("Creating record in Airtable:", taskID);

          const records = await ctx.airtable.tasksTable.create([
            {
              fields: airtableData,
            },
          ]);

          const createdRecord = records[0];

          if (!createdRecord) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to create task record.",
            });
          }

          console.log("Task created successfully:", records);

          return {
            success: true,
            taskId: taskID,
            recordId: createdRecord.id,
            message:
              "Task created successfully! You can now create the V1 rubric.",
            task: {
              id: createdRecord.id,
              TaskID: taskID,
              Status: "Task_Creation" as TaskStatus,
              TrainerEmail: userEmail,
              ...airtableData,
            },
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

        if (error instanceof TRPCError) {
          throw error;
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
        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User email not found.",
          });
        }

        // Validate rubric JSON format
        const validation = validateRubricJSON(input.rubricV1);
        if (!validation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid rubric format: ${validation.errors.join(", ")}`,
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

        // Update the record
        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: {
              Rubric_V1: input.rubricV1,
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
          "V1 Rubric saved:",
          input.taskId,
          "Items:",
          validation.rubricCount
        );

        return {
          success: true,
          message: `V1 Rubric saved successfully with ${validation.rubricCount} items!`,
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

  // Step 2: Update Rubric V2
  updateRubricV2: protectedProcedure
    .input(RubricV2InputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User email not found.",
          });
        }

        // Validate rubric JSON format
        const validation = validateRubricJSON(input.rubricV2);
        if (!validation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid rubric format: ${validation.errors.join(", ")}`,
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
          !["Rubric_V1", "Rubric_V2"].includes(existingRecord.fields.Status)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for V2 rubric creation.",
          });
        }

        // Update the record
        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: {
              Rubric_V2: input.rubricV2,
              Status: "Rubric_V2" as TaskStatus,
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
          "V2 Rubric saved:",
          input.taskId,
          "Items:",
          validation.rubricCount
        );

        return {
          success: true,
          message: `V2 Rubric enhanced successfully with ${validation.rubricCount} items!`,
          task: {
            id: updatedRecord.id,
            ...updatedRecord.fields,
          },
        };
      } catch (error) {
        console.error("Failed to update V2 rubric:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save V2 rubric.",
        });
      }
    }),

  // Step 3: Human Evaluation - Gemini
  updateHumanEvalGemini: protectedProcedure
    .input(HumanEvalInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User email not found.",
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
          !["Rubric_V2", "Human_Eval_Gemini"].includes(
            existingRecord.fields.Status
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for human evaluation.",
          });
        }

        // Validate scores against rubric
        if (!existingRecord.fields.Rubric_V2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "V2 Rubric not found. Please create V2 rubric first.",
          });
        }

        const scoreValidation = validateEvaluationScores(
          input.humanScores,
          existingRecord.fields.Rubric_V2
        );

        if (!scoreValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid evaluation scores: ${scoreValidation.errors.join(
              ", "
            )}`,
          });
        }

        // Update the record
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
        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User email not found.",
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
          !["Human_Eval_Gemini", "Model_Eval_Gemini"].includes(
            existingRecord.fields.Status
          )
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for model evaluation.",
          });
        }

        // Validate required fields
        if (
          !existingRecord.fields.Rubric_V2 ||
          !existingRecord.fields.Human_Eval_Gemini
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "V2 Rubric and Human evaluation are required.",
          });
        }

        // Validate scores against rubric
        const scoreValidation = validateEvaluationScores(
          input.modelScores,
          existingRecord.fields.Rubric_V2
        );

        if (!scoreValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid evaluation scores: ${scoreValidation.errors.join(
              ", "
            )}`,
          });
        }

        // Calculate alignment
        const alignment = calculateAlignment(
          existingRecord.fields.Human_Eval_Gemini,
          input.modelScores,
          existingRecord.fields.Rubric_V2
        );

        // Determine next status based on alignment
        const nextStatus: TaskStatus =
          alignment.percentage >= 80 ? "Model_Eval_Gemini" : "Rubric_V2"; // Send back to V2 if alignment < 80%

        // Update the record
        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: existingRecord.id,
            fields: {
              Model_Eval_Gemini: input.modelScores,
              Alignment_Gemini: alignment.percentage,
              Misaligned_Gemini: JSON.stringify(alignment.misalignedItems),
              Status: nextStatus,
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
          "Model evaluation for Gemini saved:",
          input.taskId,
          "Alignment:",
          alignment.percentage + "%"
        );

        const message =
          alignment.percentage >= 80
            ? `Model evaluation completed! Alignment: ${alignment.percentage}% - Ready for GPT evaluation.`
            : `Alignment too low: ${alignment.percentage}%. Please revise V2 rubric and re-evaluate.`;

        return {
          success: true,
          message,
          alignment: alignment.percentage,
          misalignedCount: alignment.misalignedItems.length,
          needsRevision: alignment.percentage < 80,
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
        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User email not found.",
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

        // Validate current status and Gemini alignment
        if (existingRecord.fields.Status !== "Model_Eval_Gemini") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for GPT evaluation.",
          });
        }

        // Check Gemini alignment requirement
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

        // Validate required fields
        if (!existingRecord.fields.Rubric_V2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "V2 Rubric not found.",
          });
        }

        // Validate scores against rubric
        const scoreValidation = validateEvaluationScores(
          input.humanScores,
          existingRecord.fields.Rubric_V2
        );

        if (!scoreValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid evaluation scores: ${scoreValidation.errors.join(
              ", "
            )}`,
          });
        }

        // Update the record
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
        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User email not found.",
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

        // Validate required fields
        if (
          !existingRecord.fields.Rubric_V2 ||
          !existingRecord.fields.Human_Eval_GPT
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "V2 Rubric and Human evaluation for GPT are required.",
          });
        }

        // Validate scores against rubric
        const scoreValidation = validateEvaluationScores(
          input.modelScores,
          existingRecord.fields.Rubric_V2
        );

        if (!scoreValidation.isValid) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid evaluation scores: ${scoreValidation.errors.join(
              ", "
            )}`,
          });
        }

        // Calculate alignment for GPT
        const alignment = calculateAlignment(
          existingRecord.fields.Human_Eval_GPT,
          input.modelScores,
          existingRecord.fields.Rubric_V2
        );

        // Update the record - GPT evaluation completes the task regardless of alignment
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
      const client = await clerkClient();
      const user = await client.users.getUser(ctx.userId);
      const userEmail = user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId
      )?.emailAddress;

      if (!userEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User email not found.",
        });
      }

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
        Progress: calculateTaskProgress(record.fields.Status),
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
        const client = await clerkClient();
        const user = await client.users.getUser(ctx.userId);
        const userEmail = user.emailAddresses.find(
          (email) => email.id === user.primaryEmailAddressId
        )?.emailAddress;

        if (!userEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User email not found.",
          });
        }

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
