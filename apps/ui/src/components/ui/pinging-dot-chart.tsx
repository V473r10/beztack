"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type ChartDataPoint = Record<string, string | number>;

type PingingDotChartProps = {
  data: ChartDataPoint[];
  config: ChartConfig;
  xAxisKey: string;
  yAxisKey: string;
  className?: string;
};

export function PingingDotChart({
  data,
  config,
  xAxisKey,
  yAxisKey,
  className,
}: PingingDotChartProps) {
  return (
    <ChartContainer className={className} config={config}>
      <LineChart
        accessibilityLayer
        data={data}
        margin={{
          left: 12,
          right: 12,
          top: 12,
          bottom: 12,
        }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur result="coloredBlur" stdDeviation="3" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid
          opacity={0.4}
          stroke="hsl(var(--border))"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          axisLine={false}
          dataKey={xAxisKey}
          tick={{
            fontSize: 12,
            fill: "hsl(var(--muted-foreground))",
            fontWeight: 500,
          }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tick={{
            fontSize: 12,
            fill: "hsl(var(--muted-foreground))",
            fontWeight: 500,
          }}
          tickLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
        <Line
          activeDot={<ActiveDot />}
          dataKey={yAxisKey}
          dot={<CustomizedDot />}
          filter="url(#glow)"
          stroke={`var(--color-${yAxisKey})`}
          strokeWidth={3}
          type="monotone"
        />
      </LineChart>
    </ChartContainer>
  );
}

const CustomizedDot = (props: React.SVGProps<SVGCircleElement>) => {
  const { cx, cy, stroke } = props;

  return (
    <g>
      {/* Main dot */}
      <circle cx={cx} cy={cy} fill={stroke} r={3} />
      {/* Ping animation circles */}
      <circle
        cx={cx}
        cy={cy}
        fill="none"
        opacity="0.8"
        r={3}
        stroke={stroke}
        strokeWidth="1"
      >
        <animate
          attributeName="r"
          dur="1s"
          repeatCount="indefinite"
          values="3;10"
        />
        <animate
          attributeName="opacity"
          dur="1s"
          repeatCount="indefinite"
          values="0.8;0"
        />
      </circle>
    </g>
  );
};

interface ActiveDotProps {
  cx?: number;
  cy?: number;
  stroke?: string;
}

const ActiveDot = (props: ActiveDotProps) => {
  const { cx, cy, stroke } = props;

  return (
    <g>
      {/* Active dot background */}
      <circle cx={cx} cy={cy} fill={stroke} opacity={0.3} r={8} />
      {/* Main active dot */}
      <circle
        cx={cx}
        cy={cy}
        fill={stroke}
        r={5}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    </g>
  );
};
