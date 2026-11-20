import "server-only";
import { createServerAuthClient } from "../../lib/supabase/server";
import { makeHandler, RepositoryError, type Repository, type Resource } from "./core";

const unavailable = async (): Promise<never> => {
  throw new RepositoryError("unavailable");
};
const unavailableRepository: Repository = {
  list: unavailable,
  create: unavailable,
  read: unavailable,
  update: unavailable,
};
async function authenticate(): Promise<Repository | null> {
  const client = await createServerAuthClient();
  if (!client) throw new RepositoryError("unavailable");
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous) return null;
  // A future adapter must use this same request-scoped client and user RLS context.
  return unavailableRepository;
}
export const handler = (resource: Resource, action: "list" | "create" | "read" | "update") =>
  makeHandler(resource, action, { authenticate });
