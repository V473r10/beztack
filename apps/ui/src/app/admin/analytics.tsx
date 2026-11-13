import {
  IconActivity,
  IconDatabase,
  IconShield,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { PingingDotChart } from "@/components/ui/pinging-dot-chart";
import { authClient } from "@/lib/auth-client";
import { AnimatedBarChart } from "./components/charts/animated-bar-chart";
import { StatsCard } from "./components/charts/stats-card";
import { AdminHeader } from "./components/shared/admin-header";
import { adminApi, adminUrl } from "@/lib/admin-api";
import { requestJson } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

// Types for API responses
type SystemMetric = {
  label: string;
  value: number;
  unit: string;
  status: "good" | "warning" | "critical";
};

type SystemMetricsResponse = {
  metrics: SystemMetric[];
  systemInfo?: Record<string, unknown>;
  timestamp: string;
};

// Enhanced data fetching functions
async function fetchUserGrowthData() {
  const response = await authClient.admin.listUsers({
    query: {
      limit: 1000,
      sortBy: "createdAt",
      sortDirection: "asc",
    },
  });

  if (!response.data) {
    throw new Error(response.error?.message ?? "Failed to load users");
  }

  // Group users by month for growth chart
  const usersByMonth = response.data.users.reduce(
    (acc, user) => {
      const date = new Date(user.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = formatDate(date, {
        month: "short",
        year: "2-digit",
      });
      acc[monthKey] = {
        month: monthLabel,
        users: (acc[monthKey]?.users || 0) + 1,
      };
      return acc;
    },
    {} as Record<string, { month: string; users: number }>,
  );

  return Object.values(usersByMonth).sort((a, b) => a.month.localeCompare(b.month));
}

// Real data fetchers
export async function fetchSystemMetrics(): Promise<SystemMetric[]> {
  const data = await requestJson<SystemMetricsResponse>(adminUrl(adminApi.metrics));
  return Array.isArray(data?.metrics) ? data.metrics : [];
}

export async function fetchUserStats() {
  const response = await authClient.admin.listUsers({
    query: {
      limit: 1000,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
  });

  if (!response.data) {
    throw new Error(response.error?.message ?? "Failed to load users");
  }

  const users = response.data.users;
  const totalUsers = users.length;
  const bannedUsers = users.filter((user) => user.banned).length;
  const activeUsers = totalUsers - bannedUsers;

  // Count recent signups (last 7 days)
  const RECENT_SIGNUP_DAYS = 7;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - RECENT_SIGNUP_DAYS);
  const recentSignups = users.filter((user) => new Date(user.createdAt) > sevenDaysAgo).length;

  return { totalUsers, activeUsers, bannedUsers, recentSignups };
}

type UserStats = Awaited<ReturnType<typeof fetchUserStats>>;

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unknown error";
}

export function UserStatsCards({ stats, error }: { stats: UserStats | undefined; error: unknown }) {
  if (error) {
    return (
      <Card role="alert">
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          <p>Failed to load user stats</p>
          <p className="mt-1 text-xs">{errorMessage(error)}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        description="Registered users"
        icon={<IconUsers className="h-5 w-5" />}
        title="Total Users"
        value={stats.totalUsers.toLocaleString()}
      />
      <StatsCard
        description="Currently active"
        icon={<IconActivity className="h-5 w-5" />}
        title="Active Users"
        value={stats.activeUsers.toLocaleString()}
      />
      <StatsCard
        description="Recent signups"
        icon={<IconTrendingUp className="h-5 w-5" />}
        title="New This Week"
        value={stats.recentSignups.toLocaleString()}
      />
      <StatsCard
        description="Restricted accounts"
        icon={<IconShield className="h-5 w-5" />}
        title="Banned Users"
        value={stats.bannedUsers.toLocaleString()}
      />
    </div>
  );
}

export function SystemMetricsPanelBody({
  metrics,
  isLoading,
  error,
}: {
  metrics: SystemMetric[] | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return (
      <div className="h-[250px] animate-pulse rounded bg-linear-to-r from-muted/50 to-muted" />
    );
  }

  if (error) {
    return (
      <div className="flex h-[250px] items-center justify-center text-center" role="alert">
        <div className="text-muted-foreground text-sm">
          <p>Failed to load system metrics</p>
          <p className="mt-1 text-xs">{errorMessage(error)}</p>
        </div>
      </div>
    );
  }

  if (metrics && metrics.length > 0) {
    return <AnimatedBarChart data={metrics} />;
  }

  return (
    <div className="flex h-[250px] items-center justify-center">
      <p className="text-muted-foreground text-sm">No metrics available</p>
    </div>
  );
}

export default function AdminAnalytics() {
  const {
    data: growthData,
    isLoading,
    error: growthError,
  } = useQuery({
    queryKey: queryKeys.admin.growth(),
    queryFn: fetchUserGrowthData,
  });

  // Chart configuration for user growth
  const growthChartConfig: ChartConfig = {
    users: {
      label: "New Users",
      color: "hsl(220 70% 50%)",
    },
  };

  const { data: userStats, error: userStatsError } = useQuery({
    queryKey: queryKeys.admin.userStats(),
    queryFn: fetchUserStats,
  });

  const {
    data: systemMetrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
  } = useQuery({
    queryKey: queryKeys.admin.systemMetrics(),
    queryFn: fetchSystemMetrics,
    refetchInterval: 30_000, // Refresh every 30 seconds
    retry: 3, // Retry failed requests up to 3 times
    staleTime: 25_000, // Consider data stale after 25 seconds (before refetch)
  });

  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <AdminHeader
          description="Monitor system performance and user metrics"
          title="Analytics Dashboard"
        />
      </div>

      {/* User Stats Cards */}
      <UserStatsCards error={userStatsError} stats={userStats} />

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Growth Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTrendingUp className="h-5 w-5" />
              User Growth
            </CardTitle>
            <CardDescription>Monthly user registration trends</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            {isLoading ? (
              <div className="h-[300px] animate-pulse rounded bg-linear-to-r from-muted/50 to-muted" />
            ) : growthError ? (
              <div
                className="flex h-[300px] flex-col items-center justify-center text-center text-muted-foreground text-sm"
                role="alert"
              >
                <p>Failed to load user growth</p>
                <p className="mt-1 text-xs">{errorMessage(growthError)}</p>
              </div>
            ) : (
              <div>
                {growthData && growthData.length > 0 ? (
                  <PingingDotChart
                    className="aspect-auto h-[300px] w-full"
                    config={growthChartConfig}
                    data={growthData}
                    xAxisKey="month"
                    yAxisKey="users"
                  />
                ) : (
                  <p className="flex h-[300px] items-center justify-center text-center text-muted-foreground text-sm">
                    No growth data available
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Metrics */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconDatabase className="h-5 w-5" />
              System Metrics
            </CardTitle>
            <CardDescription>Real-time performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <SystemMetricsPanelBody
              error={metricsError}
              isLoading={isLoadingMetrics}
              metrics={systemMetrics}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
