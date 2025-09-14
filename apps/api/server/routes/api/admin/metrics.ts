import os from "node:os";
import process from "node:process";
import { createError, eventHandler } from "h3";
import { requireAuth } from "@/server/utils/require-auth";

// Constants for calculations
const PERCENTAGE_MULTIPLIER = 100;
const SECONDS_IN_HOUR = 3600;
const BYTES_TO_KB = 1024;
const KB_TO_MB = 1024;
const CPU_LOAD_MULTIPLIER = 10;

// Threshold constants
const MEMORY_CRITICAL_THRESHOLD = 80;
const MEMORY_WARNING_THRESHOLD = 60;
const NETWORK_CRITICAL_THRESHOLD = 100;
const NETWORK_WARNING_THRESHOLD = 50;
const MAX_CPU_PERCENTAGE = 100;

// Simulation ranges
const DISK_USAGE_VARIATION = 30;
const DISK_USAGE_BASE = 40;
const NETWORK_LATENCY_VARIATION = 50;
const NETWORK_LATENCY_BASE = 20;

/**
 * Get status based on value and thresholds
 */
function getStatusByThreshold(
  value: number,
  criticalThreshold: number,
  warningThreshold: number
): "critical" | "warning" | "good" {
  if (value > criticalThreshold) {
    return "critical";
  }
  if (value > warningThreshold) {
    return "warning";
  }
  return "good";
}

export default eventHandler(async (event) => {
  // Require authentication and admin role
  await requireAuth(event);

  try {
    // Get system metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage =
      ((totalMemory - freeMemory) / totalMemory) * PERCENTAGE_MULTIPLIER;

    const loadAverage = os.loadavg();
    const cpuUsage = loadAverage[0] * CPU_LOAD_MULTIPLIER; // Approximate CPU usage

    // Get uptime
    const uptime = os.uptime();
    const uptimeHours = Math.floor(uptime / SECONDS_IN_HOUR);

    // Get Node.js process metrics
    const processMemory = process.memoryUsage();
    const processMemoryMB = Math.round(
      processMemory.heapUsed / BYTES_TO_KB / KB_TO_MB
    );

    // Simulate some additional metrics
    const diskUsage = Math.random() * DISK_USAGE_VARIATION + DISK_USAGE_BASE; // 40-70%
    const networkLatency =
      Math.random() * NETWORK_LATENCY_VARIATION + NETWORK_LATENCY_BASE; // 20-70ms

    return {
      metrics: [
        {
          label: "Memory Usage",
          value: Math.round(memoryUsage),
          unit: "%",
          status: getStatusByThreshold(
            memoryUsage,
            MEMORY_CRITICAL_THRESHOLD,
            MEMORY_WARNING_THRESHOLD
          ),
        },
        {
          label: "CPU Load",
          value: Math.round(Math.min(cpuUsage, MAX_CPU_PERCENTAGE)),
          unit: "%",
          status: getStatusByThreshold(
            cpuUsage,
            MEMORY_CRITICAL_THRESHOLD,
            MEMORY_WARNING_THRESHOLD
          ),
        },
        {
          label: "Disk Usage",
          value: Math.round(diskUsage),
          unit: "%",
          status: getStatusByThreshold(
            diskUsage,
            MEMORY_CRITICAL_THRESHOLD,
            MEMORY_WARNING_THRESHOLD
          ),
        },
        {
          label: "Network Latency",
          value: Math.round(networkLatency),
          unit: "ms",
          status: getStatusByThreshold(
            networkLatency,
            NETWORK_CRITICAL_THRESHOLD,
            NETWORK_WARNING_THRESHOLD
          ),
        },
      ],
      systemInfo: {
        uptime: `${uptimeHours}h`,
        processMemory: `${processMemoryMB}MB`,
        nodeVersion: process.version,
        platform: `${os.type()} ${os.release()}`,
        cpuCount: os.cpus().length,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (_error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to retrieve system metrics",
    });
  }
});
