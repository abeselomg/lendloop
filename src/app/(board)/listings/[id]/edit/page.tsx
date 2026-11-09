"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { EmptyState } from "@/components/EmptyState";
import { ToolForm } from "@/components/ToolForm";
import { FormSkeleton } from "@/components/Skeleton";

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const toolId = params.id as Id<"tools">;
  const tool = useQuery(api.tools.get, { toolId });
  const update = useMutation(api.tools.update);
  const router = useRouter();

  if (tool === undefined) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit listing</h1>
        <div className="mt-6">
          <FormSkeleton label="Loading listing" />
        </div>
      </div>
    );
  }

  if (tool === null || !tool.owner.isMe) {
    return (
      <EmptyState
        title="Listing not found"
        body="It may have been removed, or it isn't yours."
        action={
          <Link
            href="/listings"
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90"
          >
            Back to my listings
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Edit listing</h1>
      <div className="mt-6">
        <ToolForm
          initial={{
            name: tool.name,
            category: tool.category,
            condition: tool.condition,
            description: tool.description,
          }}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await update({ toolId, ...values });
            router.push("/listings");
          }}
        />
      </div>
    </div>
  );
}
