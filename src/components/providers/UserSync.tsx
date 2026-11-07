"use client";

import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

export function UserSync() {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensure);
  useEffect(() => {
    if (isAuthenticated) void ensure({});
  }, [isAuthenticated, ensure]);
  return null;
}
