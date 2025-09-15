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

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipProviderPrimitivePrimitive>) {
  return (
    <TooltipProviderPrimitivePrimitive
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipRootPrimitivePrimitive>) {
  return (
    <TooltipProvider>
      <TooltipRootPrimitivePrimitive data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipTriggerPrimitivePrimitive>) {
  return <TooltipTriggerPrimitivePrimitive data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipContentPrimitivePrimitive>) {
  return (
    <TooltipPortalPrimitivePrimitive>
      <TooltipContentPrimitivePrimitive
        className={cn(
          "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in text-balance rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs data-[state=closed]:animate-out",
          className
        )}
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        {...props}
      >
        {children}
        <TooltipArrowPrimitivePrimitive className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-primary fill-primary" />
      </TooltipContentPrimitivePrimitive>
    </TooltipPortalPrimitivePrimitive>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
