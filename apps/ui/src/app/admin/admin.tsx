import { IconPlus, IconUsers } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/admin-utils";
import { authClient } from "@/lib/auth-client";
import { AdminStats } from "./components/analytics/admin-stats";
import { AdminHeader } from "./components/shared/admin-header";

// Mock function for recent activity - replace with actual admin API call
async function fetchRecentActivity() {
  const response = await authClient.admin.listUsers({
    query: {
      limit: 5,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
  });

  if (!response.data) {
    return [];
  }

  return response.data.users.map((user) => ({
    id: user.id,
    type: "user_created" as const,
    message: `New user ${user.name || user.email} registered`,
    timestamp: user.createdAt,
    user: {
      name: user.name,
      email: user.email,
    },
  }));
}

export default function AdminDashboard() {
  const { data: recentActivity, isLoading } = useQuery({
    queryKey: ["admin", "recent-activity"],
    queryFn: fetchRecentActivity,
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminHeader
        action={
          <Button asChild>
            <Link to="/admin/users">
              <IconUsers className="mr-2 h-4 w-4" />
              Manage Users
            </Link>
          </Button>
        }
        description="Manage users and view system analytics"
        title="Admin Dashboard"
      />

      {/* Stats Overview */}
      <AdminStats />

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest user registrations and system events
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => `loading-${i}`).map(
                  (key) => (
                    <div className="flex items-center space-x-3" key={key}>
                      <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                      <div className="flex-1 space-y-1">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div>
                {recentActivity && recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div
                        className="flex items-center space-x-3"
                        key={activity.id}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                          <IconUsers className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="font-medium text-sm">
                            {activity.message}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {formatRelativeTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No recent activity to display
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start" variant="outline">
              <Link to="/admin/users">
                <IconUsers className="mr-2 h-4 w-4" />
                View All Users
              </Link>
            </Button>
            <Button asChild className="w-full justify-start" variant="outline">
              <Link to="/admin/users?action=create">
                <IconPlus className="mr-2 h-4 w-4" />
                Create New User
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
