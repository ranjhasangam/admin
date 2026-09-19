import type { Metadata } from "next";
import { RequestsPageServer } from "@/components/requests/requests-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contact Requests" };

export default async function ContactRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <RequestsPageServer
      scope="contact"
      title="Contact Requests"
      subtitle="Live from the existing contact_requests table. View, update status, delete (with permission) and export — the submitted customer data itself is never edited."
      searchParams={searchParams}
    />
  );
}
