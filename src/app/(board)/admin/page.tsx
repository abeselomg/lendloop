"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton, RowsSkeleton } from "@/components/Skeleton";
import { Tabs, useTabParam } from "@/components/ui/Tabs";
import { useCategories } from "@/lib/hooks/useCategories";
import { CategoriesTab } from "@/components/admin/CategoriesTab";
import { FailuresTab } from "@/components/admin/FailuresTab";
import { ListingsTab } from "@/components/admin/ListingsTab";
import { LoansTab } from "@/components/admin/LoansTab";
import { UsersTab } from "@/components/admin/UsersTab";

export default function AdminPage() {
  const me = useQuery(api.users.queries.me);
  if (me === undefined) return <PageSkeleton label="Loading" pathname="/admin" />;
  if (me === null || me.role !== "admin") {
    return <EmptyState title="This page is for admins." body="Ask an admin to promote you if you need access." />;
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <div className="mt-6">
        <Suspense fallback={<RowsSkeleton label="Loading admin console" />}>
          <AdminTabs />
        </Suspense>
      </div>
    </div>
  );
}

function AdminTabs() {
  const [tab, setTab] = useTabParam("tab", "loans");
  const categories = useCategories();
  const tabs = [
    { id: "loans", label: "Loans" },
    { id: "listings", label: "Listings" },
    { id: "users", label: "Users" },
    { id: "categories", label: "Categories", count: categories.isLoading ? undefined : categories.all.length },
    { id: "failures", label: "Automation failures" },
  ];
  return (
    <Tabs tabs={tabs} value={tab} onChange={setTab} label="Admin sections">
      {tab === "listings" ? (
        <ListingsTab />
      ) : tab === "users" ? (
        <UsersTab />
      ) : tab === "categories" ? (
        <CategoriesTab />
      ) : tab === "failures" ? (
        <FailuresTab />
      ) : (
        <LoansTab />
      )}
    </Tabs>
  );
}
