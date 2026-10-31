import { Form, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth, authUnavailable } from "../lib/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Signed-out requests do not require a database connection.
  let user;
  try {
    if (!request.headers.get("Cookie")?.includes("car_session=")) return redirect("/account/signin", { headers: { "Cache-Control": "no-store" } });
    user = await getAuth().getUser(request);
  } catch { throw authUnavailable(); }
  if (!user) return redirect("/account/signin", { headers: { "Cache-Control": "no-store" } });
  return Response.json({ user }, { headers: { "Cache-Control": "no-store" } });
}

export default function DashboardPage() {
  const { user } = useLoaderData<{ user: { name: string | null; email: string } }>();
  return (
    <main className="dashboard">
      <header><h1>Dashboard</h1><Form method="post" action="/account/logout"><button type="submit">Sign Out</button></Form></header>
      <section className="panel"><h2>Welcome{user.name ? `, ${user.name}` : ""}</h2><p>Signed in as {user.email}.</p></section>
    </main>
  );
}

export function headers() { return { "Cache-Control": "no-store" }; }
