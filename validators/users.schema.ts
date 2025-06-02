import { z } from "zod";

export const UserRoleSchema = z.enum(["operator", "leads", "admin"]);

export type UserRole = z.infer<typeof UserRoleSchema>;

// providing access to  both leads and admins to see admin routes currently
export const canAccessAdminRoutes = (userRole: UserRole): boolean => {
  return userRole == "admin" || userRole === "leads";
};
