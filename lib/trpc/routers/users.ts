import { getUserInfoFromAPI } from "@/lib/utils/auth-utils";
import { router, protectedProcedure } from "../server";
import { TRPCError } from "@trpc/server";
import { UserRoleSchema } from "@/lib/schemas/users.schema";
import { z } from "zod";

export const usersRouter = router({
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    try {
      const session = ctx.session;

      if (!session?.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No session found",
        });
      }

      const userInfoResponse = await getUserInfoFromAPI(session);

      return {
        user: session.user,
        role: userInfoResponse.role,
        userInfo: userInfoResponse.userInfo,
        sessionData: session,
      };
    } catch (error) {
      console.error("Error getting current user:", error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch user info",
        cause: error,
      });
    }
  }),

  // Get user role from Management API (where app_metadata exists)
  getCurrentUserRole: protectedProcedure.query(async ({ ctx }) => {
    try {
      const session = ctx.session;

      if (!session?.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No session found",
        });
      }

      console.log("Getting user role for:", session.user.sub);

      const userInfoResponse = await getUserInfoFromAPI(session);

      if (!userInfoResponse?.userInfo) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user information from Auth0",
        });
      }

      const result = {
        userId: userInfoResponse.userInfo.user_id,
        email: userInfoResponse.userInfo.email,
        role: userInfoResponse.role,
        isAdmin: userInfoResponse.role === "admin",
      };

      console.log("User role result:", result);
      return result;
    } catch (error) {
      console.error("Error getting user role:", error);

      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch user role",
        cause: error,
      });
    }
  }),

  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    try {
      const session = ctx.session;

      if (!session?.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No session found",
        });
      }

      const currentUserInfo = await getUserInfoFromAPI(session);
      if (currentUserInfo.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin privileges required",
        });
      }

      const accessToken = currentUserInfo.tokenData.access_token;

      const usersResponse = await fetch(
        `https://${process.env.AUTH0_DOMAIN}/api/v2/users?include_totals=true&search_engine=v3&q=email:*@invisible.email`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!usersResponse.ok) {
        const errorText = await usersResponse.text();
        console.error("Users fetch failed:", usersResponse.status, errorText);
        throw new Error(`Failed to fetch users: ${usersResponse.status}`);
      }

      const usersData = await usersResponse.json();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformedUsers = usersData.users.map((user: any) => ({
        id: user.user_id,
        email: user.email,
        firstName: user.given_name || user.name?.split(" ")[0] || "",
        lastName:
          user.family_name || user.name?.split(" ").slice(1).join(" ") || "",
        username: user.username || user.email?.split("@")[0] || "",
        imageUrl: user.picture || "",
        role: user.app_metadata?.role?.sector_evals || user.app_metadata?.role,

        createdAt: user.created_at,
        lastSignInAt: user.last_login,
        emailVerified: user.email_verified,
      }));

      return {
        users: transformedUsers,
        total: transformedUsers.length,
        currentUserId: session.user.sub,
      };
    } catch (error) {
      console.error("Error getting all users:", error);
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch users",
        cause: error,
      });
    }
  }),
  updateUserRole: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        newRole: UserRoleSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const session = ctx.session;

        if (!session?.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No session found",
          });
        }

        // Check if current user is admin
        const currentUserInfo = await getUserInfoFromAPI(session);
        if (currentUserInfo.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Admin privileges required",
          });
        }

        // Prevent self-demotion
        if (session.user.sub === input.userId && input.newRole !== "admin") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot change your own admin role",
          });
        }

        const accessToken = currentUserInfo.tokenData.access_token;

        // Update user metadata in Auth0
        const updateResponse = await fetch(
          `https://${
            process.env.AUTH0_DOMAIN
          }/api/v2/users/${encodeURIComponent(input.userId)}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              app_metadata: {
                role: input.newRole,
              },
            }),
          }
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error(
            "Role update failed:",
            updateResponse.status,
            errorText
          );
          throw new Error(
            `Failed to update user role: ${updateResponse.status}`
          );
        }

        const updatedUser = await updateResponse.json();

        console.log(`Role updated for user ${input.userId}: ${input.newRole}`);

        return {
          success: true,
          message: `User role updated to ${input.newRole}`,
          user: updatedUser,
        };
      } catch (error) {
        console.error("Error updating user role:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update user role",
          cause: error,
        });
      }
    }),

  deleteUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const session = ctx.session;

        if (!session?.user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "No session found",
          });
        }

        const currentUserInfo = await getUserInfoFromAPI(session);
        if (currentUserInfo.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Admin privileges required",
          });
        }

        if (session.user.sub === input.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You cannot delete your own account",
          });
        }

        if (!currentUserInfo.userInfo) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        const accessToken = currentUserInfo.tokenData.access_token;

        const deleteResponse = await fetch(
          `https://${
            process.env.AUTH0_DOMAIN
          }/api/v2/users/${encodeURIComponent(input.userId)}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!deleteResponse.ok) {
          const errorText = await deleteResponse.text();
          console.error(
            "User deletion failed:",
            deleteResponse.status,
            errorText
          );
          throw new Error(`Failed to delete user: ${deleteResponse.status}`);
        }

        console.log(
          `User deleted: ${currentUserInfo.userInfo.email} (${input.userId})`
        );

        return {
          success: true,
          message: `User ${currentUserInfo.userInfo.email} has been deleted`,
        };
      } catch (error) {
        console.error("Error deleting user:", error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete user",
          cause: error,
        });
      }
    }),
});
