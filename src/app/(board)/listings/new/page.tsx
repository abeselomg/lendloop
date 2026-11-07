"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import { ToolForm } from "@/components/ToolForm";

export default function NewListingPage() {
  const create = useMutation(api.tools.create);
  const router = useRouter();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">List a tool</h1>
      <p className="mt-1 text-sm text-muted">Tell neighbors what you can lend.</p>
      <div className="mt-6">
        <ToolForm
          submitLabel="List tool"
          onSubmit={async (values) => {
            await create(values);
            router.push("/listings");
          }}
        />
      </div>
    </div>
  );
}
