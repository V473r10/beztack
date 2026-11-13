import os from "node:os";
import process from "node:process";
import { createError, eventHandler } from "h3";
import { requireAdmin } from "@/server/utils/require-auth";

// Constants for calculations
const PERCENTAGE_MULTIPLIER = 100;
const SECONDS_IN_HOUR = 3600;
const BYTES_TO_KB = 1024;
const KB_TO_MB = 1024;
const CPU_LOAD_MULTIPLIER = 10;

// Threshold constants
const MEMORY_CRITICAL_THRESHOLD = 80;
const MEMORY_WARNING_THRESHOLD = 60;
const MAX_CPU_PERCENTAGE = 100;

/**
 * Get status based on value and thresholds
 */
function getStatusByThreshold(
  value: number,
  criticalThreshold: number,
  warningThreshold: number,
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
  // Platform metrics are for App admins only.
  await requireAdmin(event);

  try {
    // Get system metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * PERCENTAGE_MULTIPLIER;

    const loadAverage = os.loadavg();
    const cpuUsage = loadAverage[0] * CPU_LOAD_MULTIPLIER; // Approximate CPU usage

    // Get uptime
    const uptime = os.uptime();
    const uptimeHours = Math.floor(uptime / SECONDS_IN_HOUR);

    // Get Node.js process metrics
    const processMemory = process.memoryUsage();
    const processMemoryMB = Math.round(processMemory.heapUsed / BYTES_TO_KB / KB_TO_MB);

    return {
      metrics: [
        {
          label: "Memory Usage",
          value: Math.round(memoryUsage),
          unit: "%",
          status: getStatusByThreshold(
            memoryUsage,
            MEMORY_CRITICAL_THRESHOLD,
            MEMORY_WARNING_THRESHOLD,
          ),
        },
        {
          label: "CPU Load",
          value: Math.round(Math.min(cpuUsage, MAX_CPU_PERCENTAGE)),
          unit: "%",
          status: getStatusByThreshold(
            cpuUsage,
            MEMORY_CRITICAL_THRESHOLD,
            MEMORY_WARNING_THRESHOLD,
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
