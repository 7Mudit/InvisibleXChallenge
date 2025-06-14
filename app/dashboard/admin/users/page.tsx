"use client";

import React, { useState, useMemo } from "react";

import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Users,
  MoreVertical,
  Crown,
  Shield,
  Trash2,
  Search,
  Filter,
  Loader2,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Calendar,
  Mail,
  UserIcon,
} from "lucide-react";

import { api } from "@/lib/trpc/client";
import { User, UserRole } from "@/lib/schemas/users.schema";
import { cn } from "@/lib/utils";

const getRoleBadge = (role: UserRole) => {
  switch (role) {
    case "admin":
      return {
        label: "Admin",
        icon: Crown,
        className:
          "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200",
      };
    case "leads":
      return {
        label: "Lead",
        icon: Shield,
        className:
          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200",
      };
    case "operator":
    default:
      return {
        label: "Operator",
        icon: UserIcon,
        className:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200",
      };
  }
};

const getRoleHierarchy = (role: UserRole): number => {
  switch (role) {
    case "admin":
      return 3;
    case "leads":
      return 2;
    case "operator":
      return 1;
    default:
      return 0;
  }
};

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [sortBy, setSortBy] = useState<
    "name" | "role" | "created" | "lastSignIn"
  >("created");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch users
  const {
    data: usersData,
    isLoading,
    error,
    refetch,
  } = api.users.getAllUsers.useQuery();

  // Update role mutation
  const updateRoleMutation = api.users.updateUserRole.useMutation({
    onSuccess: (data) => {
      toast.success("Role updated successfully!", {
        description: data.message,
      });
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to update role", {
        description: error.message,
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = api.users.deleteUser.useMutation({
    onSuccess: (data) => {
      toast.success("User deleted successfully!", {
        description: data.message,
      });
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to delete user", {
        description: error.message,
      });
    },
  });

  // Handle role update
  const handleRoleUpdate = async (userId: string, newRole: UserRole) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, newRole });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Error handled in mutation
    }
  };

  // Handle user deletion
  const handleUserDelete = async (userId: string) => {
    try {
      await deleteUserMutation.mutateAsync({ userId });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // Error handled in mutation
    }
  };

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    if (!usersData?.users) return [];

    const filtered = usersData.users.filter((user: User) => {
      const hasValidRole = user.role && user.role.trim() !== "";
      if (!hasValidRole) {
        return false;
      }
      const matchesSearch =
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });

    // Sort users
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filtered.sort((a: any, b: any) => {
      let aValue, bValue;

      switch (sortBy) {
        case "name":
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case "role":
          aValue = getRoleHierarchy(a.role);
          bValue = getRoleHierarchy(b.role);
          break;
        case "created":
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case "lastSignIn":
          aValue = a.lastSignInAt || 0;
          bValue = b.lastSignInAt || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [usersData?.users, searchTerm, roleFilter, sortBy, sortOrder]);

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("desc");
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return (
      `${firstName?.charAt(0) || ""}${
        lastName?.charAt(0) || ""
      }`.toUpperCase() || "U"
    );
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Users</AlertTitle>
          <AlertDescription>
            {error.message}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions across the platform.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            {usersData?.total || 0} total users
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      {usersData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{usersData.total}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {["admin", "leads", "operator"].map((role) => {
            const count = usersData.users.filter(
              (u: { role: string }) => u.role === role
            ).length;
            const badge = getRoleBadge(role as UserRole);
            const IconComponent = badge.icon;

            return (
              <Card key={role}>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">
                        {badge.label}s
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters & Search</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <Select
                value={roleFilter}
                onValueChange={(value) =>
                  setRoleFilter(value as UserRole | "all")
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {filteredAndSortedUsers.length} user
            {filteredAndSortedUsers.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            </div>
          ) : filteredAndSortedUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No users found</h3>
              <p className="text-muted-foreground">
                {searchTerm || roleFilter !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "No users available to display."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-muted/30 rounded-lg text-sm font-medium text-muted-foreground">
                <div className="col-span-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("name")}
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    User
                    {sortBy === "name" &&
                      (sortOrder === "asc" ? (
                        <ChevronUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ChevronDown className="ml-1 h-3 w-3" />
                      ))}
                  </Button>
                </div>
                <div className="col-span-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("role")}
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    Role
                    {sortBy === "role" &&
                      (sortOrder === "asc" ? (
                        <ChevronUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ChevronDown className="ml-1 h-3 w-3" />
                      ))}
                  </Button>
                </div>
                <div className="col-span-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("created")}
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    Created
                    {sortBy === "created" &&
                      (sortOrder === "asc" ? (
                        <ChevronUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ChevronDown className="ml-1 h-3 w-3" />
                      ))}
                  </Button>
                </div>
                <div className="col-span-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("lastSignIn")}
                    className="h-auto p-0 hover:bg-transparent"
                  >
                    Last Sign In
                    {sortBy === "lastSignIn" &&
                      (sortOrder === "asc" ? (
                        <ChevronUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ChevronDown className="ml-1 h-3 w-3" />
                      ))}
                  </Button>
                </div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {/* Table Rows */}
              {filteredAndSortedUsers.map((user: User) => {
                const roleBadge = getRoleBadge(user.role);
                const IconComponent = roleBadge.icon;
                const isCurrentUser = user.id === usersData?.currentUserId;

                return (
                  <div
                    key={user.id}
                    className={cn(
                      "grid grid-cols-12 gap-4 p-4 rounded-lg border transition-colors hover:bg-muted/30",
                      isCurrentUser && "bg-primary/5 border-primary/20"
                    )}
                  >
                    {/* User Info */}
                    <div className="col-span-4 flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.imageUrl} />
                        <AvatarFallback>
                          {getInitials(user.firstName, user.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-foreground truncate">
                            {user.firstName} {user.lastName}
                          </p>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="col-span-2 flex items-center">
                      <Badge variant="outline" className={roleBadge.className}>
                        <IconComponent className="h-3 w-3 mr-1" />
                        {roleBadge.label}
                      </Badge>
                    </div>

                    {/* Created Date */}
                    <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>

                    {/* Last Sign In */}
                    <div className="col-span-3 flex items-center text-sm text-muted-foreground">
                      {user.lastSignInAt ? (
                        <>
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(user.lastSignInAt).toLocaleDateString()}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={isCurrentUser}>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isCurrentUser}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {/* Role Management */}
                          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                            Change Role
                          </DropdownMenuLabel>
                          {(["operator", "leads", "admin"] as UserRole[]).map(
                            (role) => {
                              if (role === user.role) return null;
                              const targetBadge = getRoleBadge(role);
                              const TargetIcon = targetBadge.icon;

                              return (
                                <DropdownMenuItem
                                  key={role}
                                  onClick={() =>
                                    handleRoleUpdate(user.id, role)
                                  }
                                  disabled={updateRoleMutation.isPending}
                                >
                                  <TargetIcon className="h-4 w-4 mr-2" />
                                  Make {targetBadge.label}
                                </DropdownMenuItem>
                              );
                            }
                          )}

                          <DropdownMenuSeparator />

                          {/* Delete User */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete User Account
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete{" "}
                                  <strong>{user.email}</strong>? This action
                                  cannot be undone and will permanently remove
                                  their account and all associated data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleUserDelete(user.id)}
                                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                                  disabled={deleteUserMutation.isPending}
                                >
                                  {deleteUserMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 mr-2" />
                                  )}
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
