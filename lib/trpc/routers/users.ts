import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  UserRole,
  UserRoleSchema,
  canAccessAdminRoutes,
} from "@/lib/schemas/users.schema";

export const usersRouter = router({
  // Get all users (admin only)
  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    try {
      const client = await clerkClient();
      const currentUser = await client.users.getUser(ctx.userId);
      const currentUserEmail = currentUser.emailAddresses.find(
        (email) => email.id === currentUser.primaryEmailAddressId
      )?.emailAddress;

      const currentUserRole = currentUser.publicMetadata?.role as UserRole;

      // Check if current user has admin access
      if (!canAccessAdminRoutes(currentUserRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to access user management.",
        });
      }

      console.log("Fetching all users for admin:", currentUserEmail);

      const users = await client.users.getUserList({
        limit: 500,
      });

      const formattedUsers = users.data.map((user) => ({
        id: user.id,
        email:
          user.emailAddresses.find(
            (email) => email.id === user.primaryEmailAddressId
          )?.emailAddress || "No email",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        role: (user.publicMetadata?.role as UserRole) || "operator",
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        imageUrl: user.imageUrl,
        username:
          user.username ||
          user.emailAddresses[0]?.emailAddress?.split("@")[0] ||
          "",
      }));

      return {
        users: formattedUsers,
        total: users.totalCount,
        currentUserId: ctx.userId,
      };
    } catch (error) {
      console.error("Failed to fetch users:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch users.",
      });
    }
  }),

  // Update user role (admin only)
  updateUserRole: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        newRole: UserRoleSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const client = await clerkClient();
        const currentUser = await client.users.getUser(ctx.userId);
        const currentUserRole = currentUser.publicMetadata?.role as UserRole;

        // Check if current user has admin access
        if (!canAccessAdminRoutes(currentUserRole)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to update user roles.",
          });
        }

        // Prevent users from updating their own role
        if (input.userId === ctx.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot update your own role.",
          });
        }

        // Get the target user
        const targetUser = await client.users.getUser(input.userId);
        const targetUserEmail = targetUser.emailAddresses.find(
          (email) => email.id === targetUser.primaryEmailAddressId
        )?.emailAddress;

        if (!targetUserEmail?.endsWith("@invisible.email")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only manage users with @invisible.email domain.",
          });
        }

        // Update the user's role in metadata
        await client.users.updateUserMetadata(input.userId, {
          publicMetadata: {
            ...targetUser.publicMetadata,
            role: input.newRole,
          },
        });

        console.log(
          `Role updated: ${targetUserEmail} from ${targetUser.publicMetadata?.role} to ${input.newRole}`
        );

        return {
          success: true,
          message: `Successfully updated ${targetUserEmail} to ${input.newRole}`,
          user: {
            id: targetUser.id,
            email: targetUserEmail,
            oldRole: targetUser.publicMetadata?.role as UserRole,
            newRole: input.newRole,
          },
        };
      } catch (error) {
        console.error("Failed to update user role:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user role.",
        });
      }
    }),

  // Delete user (admin only)
  deleteUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const client = await clerkClient();
        const currentUser = await client.users.getUser(ctx.userId);
        const currentUserRole = currentUser.publicMetadata?.role as UserRole;

        // Check if current user has admin access
        if (!canAccessAdminRoutes(currentUserRole)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to delete users.",
          });
        }

        // Prevent users from deleting themselves
        if (input.userId === ctx.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot delete your own account.",
          });
        }

        // Get the target user before deletion
        const targetUser = await client.users.getUser(input.userId);
        const targetUserEmail = targetUser.emailAddresses.find(
          (email) => email.id === targetUser.primaryEmailAddressId
        )?.emailAddress;

        if (!targetUserEmail?.endsWith("@invisible.email")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only delete users with @invisible.email domain.",
          });
        }

        // Delete the user
        await client.users.deleteUser(input.userId);

        console.log(`User deleted: ${targetUserEmail} by admin`);

        return {
          success: true,
          message: `Successfully deleted user ${targetUserEmail}`,
          deletedUser: {
            id: targetUser.id,
            email: targetUserEmail,
            role: targetUser.publicMetadata?.role as UserRole,
          },
        };
      } catch (error) {
        console.error("Failed to delete user:", error);
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete user.",
        });
      }
    }),
});
