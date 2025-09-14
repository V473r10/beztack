import { motion } from "motion/react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface GlowingLineChartProps {
  data: Array<{
    time: string;
    value: number;
  }>;
  title?: string;
}

export function GlowingLineChart({
  data,
  title = "Metric",
}: GlowingLineChartProps) {
  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className="h-[200px] w-full"
      initial={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.7, delay: 0.1 }}
    >
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <filter height="300%" id="glow" width="300%" x="-75%" y="-75%">
              <feMorphology operator="dilate" radius="2" />
              <feGaussianBlur result="coloredBlur" stdDeviation="3" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
              <stop
                offset="0%"
                stopColor="hsl(var(--chart-3))"
                stopOpacity={0.8}
              />
              <stop
                offset="50%"
                stopColor="hsl(var(--chart-3))"
                stopOpacity={1}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--chart-3))"
                stopOpacity={0.8}
              />
            </linearGradient>
          </defs>
          <XAxis
            axisLine={false}
            dataKey="time"
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fontSize: 10, fill: "#6b7280" }}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <motion.div
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-lg border bg-background/90 p-2 shadow-xl backdrop-blur-sm"
                    initial={{ opacity: 0, scale: 0.8 }}
                  >
                    <p className="font-medium text-xs">{label}</p>
                    <p
                      className="text-xs"
                      style={{ color: "hsl(var(--chart-3))" }}
                    >
                      {title}: {payload[0].value}
                    </p>
                  </motion.div>
                );
              }
              return null;
            }}
          />
          <Line
            activeDot={{
              r: 6,
              fill: "hsl(var(--chart-3))",
              stroke: "hsl(var(--background))",
              strokeWidth: 2,
              filter: "url(#glow)",
            }}
            dataKey="value"
            dot={{
              r: 4,
              fill: "hsl(var(--chart-3))",
              strokeWidth: 2,
              stroke: "hsl(var(--background))",
            }}
            filter="url(#glow)"
            stroke="url(#lineGradient)"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
