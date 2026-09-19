import type { Metadata } from "next";
import { RequestsPageServer } from "@/components/requests/requests-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All Requests" };

export default async function AllRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <RequestsPageServer
      scope="all"
      title="All Requests"
      subtitle="Unified view over the existing service_requests, contact_requests and callback_requests tables — one source of truth, no duplicates."
      searchParams={searchParams}
    />
  );
}
