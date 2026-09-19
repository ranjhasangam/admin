import { CardsSkeleton, TableSkeleton } from "@/components/ui/spinner";

export default function AdminLoading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200" />
      <CardsSkeleton count={5} />
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
