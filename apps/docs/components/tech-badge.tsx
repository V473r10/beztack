/** biome-ignore-all lint/nursery/useConsistentTypeDefinitions: <explanation> */
import Image from "next/image";

interface TechBadgeProps {
  name: string;
  logoUrl: string;
  logoUrlLight?: string;
  logoComponent?: React.ReactNode;
}

export function TechBadge({
  name,
  logoUrl,
  logoUrlLight,
  logoComponent,
}: Partial<TechBadgeProps>) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3 transition-colors hover:bg-secondary/50">
      <div className="flex h-6 w-6 items-center justify-center">
        {logoComponent}
        {logoUrl && logoUrlLight && (
          <>
            <Image
              alt={`${name} logo`}
              className="hidden h-full w-full object-contain transition-transform group-hover:scale-110 dark:block"
              height={24}
              src={logoUrl}
              width={24}
            />
            <Image
              alt={`${name} logo`}
              className="block h-full w-full object-contain transition-transform group-hover:scale-110 dark:hidden"
              height={24}
              src={logoUrlLight}
              width={24}
            />
          </>
        )}
        {logoUrl && !logoUrlLight && (
          <Image
            alt={`${name} logo`}
            className="h-full w-full object-contain transition-transform group-hover:scale-110"
            height={24}
            src={logoUrl}
            width={24}
          />
        )}
      </div>
      <span className="font-mono text-foreground text-sm">{name}</span>
    </div>
  );
}
