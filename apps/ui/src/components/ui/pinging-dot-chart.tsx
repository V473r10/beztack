"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface PingingDotChartProps {
  data: any[];
  config: ChartConfig;
  xAxisKey: string;
  yAxisKey: string;
  className?: string;
}

export function PingingDotChart({ 
  data, 
  config, 
  xAxisKey, 
  yAxisKey, 
  className 
}: PingingDotChartProps) {
  return (
    <ChartContainer config={config} className={className}>
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
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <CartesianGrid 
          vertical={false}
          stroke="hsl(var(--border))"
          strokeDasharray="3 3"
          opacity={0.4}
        />
        <XAxis
          dataKey={xAxisKey}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ 
            fontSize: 12, 
            fill: 'hsl(var(--muted-foreground))',
            fontWeight: 500
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ 
            fontSize: 12, 
            fill: 'hsl(var(--muted-foreground))',
            fontWeight: 500
          }}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent />}
        />
        <Line
          dataKey={yAxisKey}
          type="monotone"
          stroke={`var(--color-${yAxisKey})`}
          strokeWidth={3}
          dot={<CustomizedDot />}
          activeDot={<ActiveDot />}
          filter="url(#glow)"
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
      <circle cx={cx} cy={cy} r={3} fill={stroke} />
      {/* Ping animation circles */}
      <circle
        cx={cx}
        cy={cy}
        r={3}
        stroke={stroke}
        fill="none"
        strokeWidth="1"
        opacity="0.8"
      >
        <animate
          attributeName="r"
          values="3;10"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8;0"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};


const ActiveDot = (props: any) => {
  const { cx, cy, stroke } = props;

  return (
    <g>
      {/* Active dot background */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={8} 
        fill={stroke} 
        opacity={0.3}
      />
      {/* Main active dot */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={5} 
        fill={stroke}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    </g>
  );
};
