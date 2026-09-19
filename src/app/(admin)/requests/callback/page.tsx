import type { Metadata } from "next";
import { RequestsPageServer } from "@/components/requests/requests-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Callback Requests" };

export default async function CallbackRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <RequestsPageServer
      scope="callback"
      title="Callback Requests"
      subtitle="Live from the existing callback_requests table. View, update status, delete (with permission) and export — the submitted customer data itself is never edited."
      searchParams={searchParams}
    />
  );
}
