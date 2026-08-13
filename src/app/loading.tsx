import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 space-y-3 max-w-2xl">
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[78px]" />
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-8 items-start">
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-64 mb-4" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[116px] w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}
