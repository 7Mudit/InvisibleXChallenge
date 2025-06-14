import { z } from "zod";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  imageUrl: string;
  role: UserRole;
  createdAt: string;
  lastSignInAt: string | null;
  emailVerified: boolean;
}

export interface UsersResponse {
  users: User[];
  total: number;
  currentUserId: string;
}

export interface UpdateUserRoleInput {
  userId: string;
  newRole: UserRole;
}

export interface DeleteUserInput {
  userId: string;
}

export interface UserApiResponse {
  success: boolean;
  message: string;
  user?: User;
}

export const UserRoleSchema = z.enum(["operator", "leads", "admin"]);

export type UserRole = z.infer<typeof UserRoleSchema>;

// providing access to  both leads and admins to see admin routes currently
export const canAccessAdminRoutes = (userRole: UserRole): boolean => {
  return userRole == "admin" || userRole === "leads";
};
