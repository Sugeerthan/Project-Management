import "server-only";

import { redirect } from "next/navigation";
import { createServerAuthClient } from "../../lib/supabase/server";
import { LOGIN_PATH } from "./routing";

export async function getAuthenticatedUser() {
  const client = await createServerAuthClient();
  if (!client) return null;
  try {
    // Fresh, Auth-server-verified identity; never trust getSession().user.
    const { data, error } = await client.auth.getUser();
    return !error && data.user && !data.user.is_anonymous ? data.user : null;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}
