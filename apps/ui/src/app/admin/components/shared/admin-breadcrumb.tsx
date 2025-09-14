import { Fragment } from "react";
import { Link, useLocation } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbItemData = {
  label: string;
  href?: string;
};

export function AdminBreadcrumb() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  // Build breadcrumb items
  const breadcrumbItems: BreadcrumbItemData[] = [];

  // Always start with Home
  breadcrumbItems.push({ label: "Home", href: "/" });

  // Add Admin
  if (pathSegments.includes("admin")) {
    breadcrumbItems.push({ label: "Admin", href: "/admin" });

    // Get the segment after admin
    const adminIndex = pathSegments.indexOf("admin");
    const nextSegment = pathSegments[adminIndex + 1];

    if (nextSegment) {
      const segmentLabels: Record<string, string> = {
        users: "User Management",
        analytics: "Analytics",
        settings: "Settings",
      };

      const label =
        segmentLabels[nextSegment] ||
        nextSegment.charAt(0).toUpperCase() + nextSegment.slice(1);
      breadcrumbItems.push({ label });
    }
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems.map((item, index) => (
          <Fragment key={`breadcrumb-${item.label}-${index}`}>
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link to={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {index < breadcrumbItems.length - 1 && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
