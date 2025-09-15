import {
  Provider as TooltipProviderPrimitivePrimitive,
  Root as TooltipRootPrimitivePrimitive,
  Trigger as TooltipTriggerPrimitivePrimitive,
  Content as TooltipContentPrimitivePrimitive,
  Portal as TooltipPortalPrimitivePrimitive,
  Arrow as TooltipArrowPrimitivePrimitive,
} from "@radix-ui/react-tooltip";
import type React from "react";

import { cn } from "@/lib/utils";

function TooltipProviderPrimitive({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipProviderPrimitive>) {
  return (
    <TooltipProviderPrimitive
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipRootPrimitive>) {
  return (
    <TooltipProviderPrimitive>
      <TooltipRootPrimitive data-slot="tooltip" {...props} />
    </TooltipProviderPrimitive>
  );
}

function TooltipTriggerPrimitive({
  ...props
}: React.ComponentProps<typeof TooltipTriggerPrimitive>) {
  return <TooltipTriggerPrimitive data-slot="tooltip-trigger" {...props} />;
}

function TooltipContentPrimitive({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipContentPrimitive>) {
  return (
    <TooltipPortalPrimitive>
      <TooltipContentPrimitive
        className={cn(
          "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in text-balance rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs data-[state=closed]:animate-out",
          className
        )}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
      >
        {children}
        <TooltipArrowPrimitive className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
      </TooltipContentPrimitive>
    </TooltipPortalPrimitive>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
