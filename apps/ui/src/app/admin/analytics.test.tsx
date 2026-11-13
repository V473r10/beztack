import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestJson: vi.fn(),
  listUsers: vi.fn(),
}));

vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/api-client", () => ({ requestJson: mocks.requestJson }));
vi.mock("@/lib/auth-client", () => ({ authClient: { admin: { listUsers: mocks.listUsers } } }));
vi.mock("@/lib/format", () => ({ formatDate: () => "Nov 26" }));
vi.mock("./components/charts/animated-bar-chart", () => ({
  AnimatedBarChart: ({ data }: { data: Array<{ label: string; value: number }> }) => (
    <ul data-testid="metrics-chart">
      {data.map((metric) => (
        <li key={metric.label}>{`${metric.label}: ${metric.value}`}</li>
      ))}
    </ul>
  ),
}));

import {
  fetchSystemMetrics,
  fetchUserStats,
  SystemMetricsPanelBody,
  UserStatsCards,
} from "./analytics";

describe("Analytics system metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the metrics from the admin metrics route", async () => {
    mocks.requestJson.mockResolvedValue({
      metrics: [{ label: "Memory Usage", value: 41, unit: "%", status: "good" }],
      timestamp: "2026-11-12T00:00:00.000Z",
    });

    await expect(fetchSystemMetrics()).resolves.toEqual([
      { label: "Memory Usage", value: 41, unit: "%", status: "good" },
    ]);
    expect(mocks.requestJson).toHaveBeenCalledWith("/api/auth/admin/metrics");
  });

  it("rejects instead of returning stand-in numbers when the route fails", async () => {
    mocks.requestJson.mockRejectedValue(new Error("Not Found"));

    await expect(fetchSystemMetrics()).rejects.toThrow("Not Found");
  });

  it("shows an explicit error, no chart and no invented numbers, when loading failed", () => {
    const html = renderToStaticMarkup(
      <SystemMetricsPanelBody
        error={new Error("Forbidden")}
        isLoading={false}
        metrics={undefined}
      />,
    );

    expect(html).toContain("Failed to load system metrics");
    expect(html).toContain("Forbidden");
    expect(html).not.toContain("metrics-chart");
    expect(html).not.toMatch(/fallback/i);
  });

  it("shows the measured metrics when loading worked", () => {
    const html = renderToStaticMarkup(
      <SystemMetricsPanelBody
        error={null}
        isLoading={false}
        metrics={[{ label: "CPU Load", value: 12, unit: "%", status: "good" }]}
      />,
    );

    expect(html).toContain("CPU Load: 12");
  });
});

describe("Analytics user stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects instead of reporting zero users when the user list fails to load", async () => {
    mocks.listUsers.mockResolvedValue({ data: null, error: { message: "Forbidden" } });

    await expect(fetchUserStats()).rejects.toThrow("Forbidden");
  });

  it("shows an explicit error instead of zeroed cards when stats failed", () => {
    const html = renderToStaticMarkup(
      <UserStatsCards error={new Error("Forbidden")} stats={undefined} />,
    );

    expect(html).toContain("Failed to load user stats");
    expect(html).not.toContain(">0<");
  });
});
