import { redirect } from "react-router";
export function loader() { return redirect("/dashboard", { headers: { "Cache-Control": "no-store" } }); }
export default function HomePage() { return null; }
