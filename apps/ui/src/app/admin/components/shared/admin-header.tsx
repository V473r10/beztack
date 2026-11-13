import { AdminBreadcrumb } from "./admin-breadcrumb";

type AdminHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

/** Page header for admin screens. The sidebar toggle lives in the app shell header above it. */
export function AdminHeader({ title, description, action }: AdminHeaderProps) {
  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2">
      <div className="flex min-w-0 flex-col gap-1">
        <AdminBreadcrumb />
        <div className="flex min-w-0 items-center gap-4">
          <h2 className="min-w-0 truncate font-semibold text-lg">{title}</h2>
          {description && (
            <p className="hidden min-w-0 truncate text-muted-foreground text-sm md:block">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
