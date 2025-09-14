import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AdminBreadcrumb } from "./admin-breadcrumb";

interface AdminHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AdminHeader({ title, description, action }: AdminHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator className="mr-2 h-4" orientation="vertical" />
      <div className="flex flex-1 items-center justify-between">
        <div className="flex flex-col gap-1">
          <AdminBreadcrumb />
          <div className="flex items-center gap-4">
            <h1 className="font-semibold text-lg">{title}</h1>
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
