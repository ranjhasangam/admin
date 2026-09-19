import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="card max-w-md p-10 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Compass className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          That route does not exist in the Admin Panel.
        </p>
        <a href="/dashboard" className="btn btn-primary mt-6">Back to Dashboard</a>
      </div>
    </div>
  );
}
