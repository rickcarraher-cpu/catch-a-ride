import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import OriginalDashboard from "../../src/app/dashboard/page";

// Server render only: no effects, browser storage, API calls or legacy handlers run.
// This module and the recovered component never enter the browser bundle.
export function sampleDashboardLink(href: string): string | null {
  if (href === "/trips?new=true&dispatch=true" || href === "/trips?new=true") return "/preview/book";
  if (href === "/settings-2") return "/preview/settings";
  if (href === "/schedule-timeline" || href === "/schedule-builder") return "/preview/assignments";
  if (href === "/trips") return "#sample-trips";
  return null;
}

export function databaseDashboardLink(href:string):string|null {
 if(href.startsWith('/preview/feature?destination='))return href;
 if(href==='/messages'||href==='/messages?unread=true')return '/preview/database-messages'+(href.includes('?')?'?unread=true':'');
 if(href==='/trips?status=needs_review')return '/preview/database?status=needs_review#database-trips';
 if(href==='/book/catch-a-ride')return '/preview/online-book';
 if(href==='/trips')return '/preview/database#database-trips';
 if(href==='/trips?new=true&dispatch=true'||href==='/trips?new=true')return '/preview/database-book';
 if(href==='/settings-2')return '/preview/database-settings';
 if(href==='/schedule-timeline'||href==='/schedule-builder')return '/preview/database-assignments';
 if(href.startsWith('/')&&!href.startsWith('//'))return '/preview/feature?destination='+encodeURIComponent(href);
 return null;
}
export function renderRecoveredDashboard(mode:'sample'|'database'='sample') {
  const client = new QueryClient({ defaultOptions: { queries: {
    enabled: false, retry: false, placeholderData: [],
  } } });
  try {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}><OriginalDashboard /></QueryClientProvider>,
    );
    // Preserve original layout/text, but make all operational controls inert.
    const navigable = mode==='database' ? html.replace(/<button([^>]*)>([\s\S]*?)<\/button>/g, (_match, attrs:string, content:string) => {
      const label = content.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      const destination = label.includes('Close Up') ? 'close-up' : label.includes('Receipts Needed') ? 'receipts-needed' : 'unfinished-action';
      return `<a${attrs} href="/preview/feature?destination=%2F${destination}">${content}</a>`;
    }) : html;
    return navigable
      .replace(/<button\b/g, '<button disabled=""')
      .replace(/\bhref="([^"]*)"/g, (_match, href: string) => {
        const target = (mode==='database'?databaseDashboardLink:sampleDashboardLink)(href.replace(/&amp;/g, "&"));
        return target ? `href="${target}"` : 'aria-disabled="true" tabindex="-1"';
      })
      .replace(/<input\b/g, '<input disabled=""');
  } finally { client.clear(); }
}

export function requireDashboardPreview() {
  if (process.env.VERCEL_ENV !== "preview") throw new Response("Not found", { status: 404 });
}
