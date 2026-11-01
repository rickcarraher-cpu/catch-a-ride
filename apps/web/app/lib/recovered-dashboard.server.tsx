import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OriginalDashboard from "../../src/app/dashboard/page";

// Server render only: no effects, browser storage, API calls or legacy handlers run.
// This module and the recovered component never enter the browser bundle.
export function sampleDashboardLink(href: string): string | null {
  if (href === "/trips?new=true&dispatch=true" || href === "/trips?new=true") return "/preview/book";
  if (href === "/trips") return "#sample-trips";
  return null;
}

export function renderRecoveredDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: {
    enabled: false, retry: false, placeholderData: [],
  } } });
  try {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}><OriginalDashboard /></QueryClientProvider>,
    );
    // Preserve original layout/text, but make all operational controls inert.
    return html
      .replace(/<button\b/g, '<button disabled=""')
      .replace(/\bhref="([^"]*)"/g, (_match, href: string) => {
        const target = sampleDashboardLink(href.replace(/&amp;/g, "&"));
        return target ? `href="${target}"` : 'aria-disabled="true" tabindex="-1"';
      })
      .replace(/<input\b/g, '<input disabled=""');
  } finally { client.clear(); }
}

export function requireDashboardPreview() {
  if (process.env.VERCEL_ENV !== "preview") throw new Response("Not found", { status: 404 });
}
