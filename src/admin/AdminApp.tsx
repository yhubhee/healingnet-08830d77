// Admin console entry (lazy-loaded from App.tsx behind <RequireAdmin>). Each page is its own chunk.
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminLayout } from "./AdminLayout";

const NotFound = lazy(() => import("./pages/NotFound"));

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

export default function AdminApp() {
  return (
    <AdminLayout>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}
