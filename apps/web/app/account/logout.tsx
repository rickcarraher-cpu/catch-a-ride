import { redirect } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { getAuth, authUnavailable } from "../lib/auth.server";
import { requireSameOrigin } from "../lib/auth-core.server";

export async function loader() { return redirect("/account/signin"); }
export async function action({ request }: ActionFunctionArgs) {
  requireSameOrigin(request);
  if (request.method !== "POST") throw new Response("Method not allowed", { status: 405 });
  let cookie;
  try { cookie = await getAuth().signOut(request); }
  catch (error) { throw authUnavailable(error); }
  return redirect("/account/signin", { headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
}

export function headers() { return { "Cache-Control": "no-store" }; }
