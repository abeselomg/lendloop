/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as automation_actions from "../automation/actions.js";
import type * as automation_internal from "../automation/internal.js";
import type * as automation_outbox from "../automation/outbox.js";
import type * as automation_queries from "../automation/queries.js";
import type * as categories_internal from "../categories/internal.js";
import type * as categories_mutations from "../categories/mutations.js";
import type * as categories_queries from "../categories/queries.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_signature from "../lib/signature.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_views from "../lib/views.js";
import type * as loans_mutations from "../loans/mutations.js";
import type * as loans_queries from "../loans/queries.js";
import type * as n8n_internal from "../n8n/internal.js";
import type * as seed from "../seed.js";
import type * as tools_mutations from "../tools/mutations.js";
import type * as tools_queries from "../tools/queries.js";
import type * as users_mutations from "../users/mutations.js";
import type * as users_queries from "../users/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "automation/actions": typeof automation_actions;
  "automation/internal": typeof automation_internal;
  "automation/outbox": typeof automation_outbox;
  "automation/queries": typeof automation_queries;
  "categories/internal": typeof categories_internal;
  "categories/mutations": typeof categories_mutations;
  "categories/queries": typeof categories_queries;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/env": typeof lib_env;
  "lib/signature": typeof lib_signature;
  "lib/validation": typeof lib_validation;
  "lib/views": typeof lib_views;
  "loans/mutations": typeof loans_mutations;
  "loans/queries": typeof loans_queries;
  "n8n/internal": typeof n8n_internal;
  seed: typeof seed;
  "tools/mutations": typeof tools_mutations;
  "tools/queries": typeof tools_queries;
  "users/mutations": typeof users_mutations;
  "users/queries": typeof users_queries;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
