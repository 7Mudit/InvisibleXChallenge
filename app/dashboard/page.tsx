"use client";

import { Card, CardContent } from "@/components/ui/card";
import { UserRole } from "@/lib/schemas/users.schema";
import { useUser } from "@clerk/nextjs";
import { AdminDashboard } from "./_components/dashboard/AdminDashboard";
import { OperatorDashboard } from "./_components/dashboard/OperatorDashboard";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Loading Dashboard...
          </h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card
              key={i}
              className="bg-card/50 backdrop-blur-sm border-border/50"
            >
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-8 bg-muted rounded w-16"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const userRole = user?.publicMetadata?.role as UserRole;

  if (userRole === "admin") {
    return <AdminDashboard />;
  }

  return <OperatorDashboard />;
}
