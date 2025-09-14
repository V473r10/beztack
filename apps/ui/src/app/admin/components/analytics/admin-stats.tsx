import {
  IconClock,
  IconUserCheck,
  IconUsers,
  IconUserX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  recentSignups: number;
}

// Mock function - replace with actual admin API call
async function fetchAdminStats(): Promise<AdminStats> {
  // This will be replaced with actual authClient.admin calls
  const response = await authClient.admin.listUsers({
    query: {
      limit: 1000, // Get all users for stats
    },
  });

  if (!response.data) {
    throw new Error("Failed to fetch admin stats");
  }

  const users = response.data.users;
  const totalUsers = users.length;
  const bannedUsers = users.filter((user) => user.banned).length;
  const activeUsers = totalUsers - bannedUsers;

  // Count recent signups (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSignups = users.filter(
    (user) => new Date(user.createdAt) > sevenDaysAgo
  ).length;

  return {
    totalUsers,
    activeUsers,
    bannedUsers,
    recentSignups,
  };
}

export function AdminStats() {
  const {
    data: stats,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: fetchAdminStats,
    refetchInterval: 30_000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            Failed to load admin statistics
          </p>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: IconUsers,
      description: "All registered users",
    },
    {
      title: "Active Users",
      value: stats.activeUsers,
      icon: IconUserCheck,
      description: "Currently active users",
    },
    {
      title: "Banned Users",
      value: stats.bannedUsers,
      icon: IconUserX,
      description: "Currently banned users",
    },
    {
      title: "Recent Signups",
      value: stats.recentSignups,
      icon: IconClock,
      description: "New users this week",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{stat.value}</div>
              <p className="text-muted-foreground text-xs">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
