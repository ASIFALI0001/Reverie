import { Skeleton } from "@/components/ui/Skeleton";

/** Same footprint as the auth forms, shown while search params resolve. */
export function FormSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="h-12 w-48" />
      <Skeleton className="mt-4 h-4 w-64" />
      <Skeleton className="mt-10 h-13 w-full rounded-full" />
      <Skeleton className="mt-7 h-px w-full" />
      <Skeleton className="mt-7 h-12 w-full" />
      <Skeleton className="mt-6 h-12 w-full" />
      <Skeleton className="mt-8 h-13 w-full rounded-full" />
    </div>
  );
}
