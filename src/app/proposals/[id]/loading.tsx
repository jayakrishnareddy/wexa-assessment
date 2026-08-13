import { Skeleton } from "@/components/ui";

/**
 * Streamed immediately while the screening queries run.
 *
 * The screening page issues three statements against a remote instance, so
 * without this the browser would sit on a blank document for the round trip.
 * The skeleton mirrors the real layout closely enough that nothing jumps when
 * the data arrives.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Skeleton className="h-4 w-28 mb-6" />

      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-7 w-[32rem] max-w-full" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
        <div className="flex gap-6 pt-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Skeleton className="h-[86px]" />
        <Skeleton className="h-[86px]" />
        <Skeleton className="h-[86px]" />
      </div>

      <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
        <div className="space-y-2">
          <Skeleton className="h-9 w-full mb-4" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px] w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
