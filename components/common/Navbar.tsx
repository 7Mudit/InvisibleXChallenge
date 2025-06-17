"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/common/ThemeSwitcher";
import { Menu, LogOut, User, Shield, ChevronDown } from "lucide-react";
import { UserRole } from "@/lib/schemas/users.schema";
import { useUser } from "@auth0/nextjs-auth0";
import { api } from "@/lib/trpc/client";

interface NavbarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  isMobile: boolean;
}

export function Navbar({ sidebarOpen, setSidebarOpen, isMobile }: NavbarProps) {
  const pathname = usePathname();
  const { user, isLoading } = useUser();

  const { data: userRole } = api.users.getCurrentUserRole.useQuery(undefined, {
    enabled: !!user,
  });

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";

  const getPageTitle = () => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) return "Dashboard";

    const lastSegment = segments[segments.length - 1];
    return lastSegment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "lead":
        return "default";
      default:
        return "secondary";
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "admin":
        return <Shield className="h-3 w-3" />;
      case "lead":
        return <User className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-border/50" />

      <div className="relative">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            <div className="flex flex-col">
              <h1 className="text-lg font-semibold text-foreground">
                {getPageTitle()}
              </h1>
              <div className="hidden sm:flex items-center space-x-1 text-xs text-muted-foreground">
                <span>Dashboard</span>
                {pathname !== "/dashboard" && (
                  <>
                    <span>/</span>
                    <span className="text-foreground">{getPageTitle()}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />

            {user && !isLoading && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 h-auto py-1.5 px-2 hover:bg-muted/50"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user?.picture || ""}
                        alt={displayName}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.name?.[0] || user.email?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-sm font-medium text-foreground">
                        {displayName}
                      </span>
                      <div className="flex items-center space-x-1">
                        {userRole?.role && (
                          <Badge
                            variant={getRoleBadgeVariant(userRole.role)}
                            className="text-xs h-4 px-1"
                          >
                            <span className="flex items-center space-x-1">
                              {getRoleIcon(userRole.role)}
                              <span className="capitalize">
                                {userRole.role}
                              </span>
                            </span>
                          </Badge>
                        )}
                      </div>
                    </div>

                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-card/95 backdrop-blur-xl border-border/50"
                >
                  <div className="flex items-center space-x-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.picture} alt={displayName} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {userEmail}
                      </p>
                    </div>
                  </div>

                  <DropdownMenuSeparator />
                  <a href="/auth/logout" className="">
                    <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </a>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
