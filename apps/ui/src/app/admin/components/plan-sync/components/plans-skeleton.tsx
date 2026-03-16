import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SKELETON_ITEMS } from "../constants";

export function PlansSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6">
      {SKELETON_ITEMS.map((i) => (
        <Card className="flex flex-col" key={i}>
          <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="ml-auto h-8 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="mt-4 h-10 w-full" />
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
