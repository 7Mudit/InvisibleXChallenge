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
} from "@/lib/schemas/task";
import { generateTaskId } from "@/lib/utils/task-utils";
import { clerkClient } from "@clerk/nextjs/server";
import z from "zod";

export const tasksRouter = router({
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
              "Task created successfully! You can now create a rubric for evaluation.",
            task: {
              id: createdRecord.id,
              TaskID: taskID,
              Status: "Task Creation" as TaskStatus,
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

  // Get all tasks for the current user
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

  // Get a specific task by ID
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

  // Update task with rubric data
  updateRubric: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        rubric: z.string(),
        humanScores: z.string(),
        aiScores: z.string(),
        alignmentPercentage: z.number().min(0).max(100),
        misalignedItems: z.string().optional(),
        comments: z.string().optional(),
      })
    )
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

        if (existingRecord.fields.Status !== "Task Creation") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Task is not in the correct state for rubric creation.",
          });
        }

        try {
          const rubricData = JSON.parse(input.rubric);
          const humanScoresData = JSON.parse(input.humanScores);
          const aiScoresData = JSON.parse(input.aiScores);

          console.log("Parsed rubric data:", {
            rubricCount: Object.keys(rubricData).length,
            humanScoresCount: Object.keys(humanScoresData).length,
            aiScoresCount: Object.keys(aiScoresData).length,
            alignmentPercentage: input.alignmentPercentage,
          });

          const rubricCount = Object.keys(rubricData).length;
          if (rubricCount < 15) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `At least 15 rubric items are required for submission. Found ${rubricCount}.`,
            });
          }

          const humanScoresCount = Object.keys(humanScoresData).length;
          const aiScoresCount = Object.keys(aiScoresData).length;

          if (
            humanScoresCount !== rubricCount ||
            aiScoresCount !== rubricCount
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Mismatch between rubric items (${rubricCount}) and scores (Human: ${humanScoresCount}, AI: ${aiScoresCount}).`,
            });
          }

          const validScoreValues = ["Yes", "No"];
          const invalidHumanScores = Object.values(humanScoresData).filter(
            (score) => !validScoreValues.includes(score as string)
          );
          const invalidAiScores = Object.values(aiScoresData).filter(
            (score) => !validScoreValues.includes(score as string)
          );

          if (invalidHumanScores.length > 0 || invalidAiScores.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "All scores must be either 'Yes' or 'No'.",
            });
          }

          console.log(
            `Updating rubric for task ${input.taskId} with ${rubricCount} items, ${input.alignmentPercentage}% alignment`
          );
        } catch (parseError) {
          console.error("Failed to parse rubric data:", parseError);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid rubric data format. Please check your input.",
          });
        }

        const recordId = existingRecord.id;

        const updatedRecords = await ctx.airtable.tasksTable.update([
          {
            id: recordId,
            fields: {
              Rubric: input.rubric,
              HumanScores: input.humanScores,
              AIScores: input.aiScores,
              AlignmentPercentage: input.alignmentPercentage,
              MisalignedItems: input.misalignedItems || "[]",
              Comments: input.comments || "",
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
          "Rubric created and task completed:",
          input.taskId,
          "Alignment:",
          input.alignmentPercentage + "%"
        );

        return {
          success: true,
          message: `Evaluation completed successfully! Human-AI alignment: ${input.alignmentPercentage}%`,
          task: {
            id: updatedRecord.id,
            ...updatedRecord.fields,
          },
          stats: {
            rubricCount: Object.keys(JSON.parse(input.rubric)).length,
            alignmentPercentage: input.alignmentPercentage,
            misalignedCount: input.misalignedItems
              ? JSON.parse(input.misalignedItems).length
              : 0,
          },
        };
      } catch (error) {
        console.error("Failed to update rubric:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to complete evaluation.",
        });
      }
    }),
});
