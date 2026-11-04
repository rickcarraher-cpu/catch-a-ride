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
 if(href==='/preview/feature?destination=%2Freceipts-needed')return '/preview/receipts-needed';
 if(href.startsWith('/preview/feature?destination='))return href;
 if(['/drivers','/vehicles','/passengers','/services'].includes(href))return '/preview/manage/'+href.slice(1);
 if(href==='/messages'||href==='/messages?unread=true')return '/preview/database-messages'+(href.includes('?')?'?unread=true':'');
 if(href==='/trips?status=needs_review')return '/preview/database?status=needs_review#database-trips';
 if(href==='/book/catch-a-ride')return '/preview/online-book';
 if(['/reports/all-trips','/reports/by-driver','/reports/unpaid-trips','/reports/weekly-payments','/reports/payments-by-method'].includes(href))return '/preview'+href;
 if(href==='/third-party-trips'||href==='/third-party-trips?new=true')return '/preview/advanced/third-party';
 if(href==='/tours')return '/preview/advanced/tours';
 if(href==='/weddings')return '/preview/advanced/weddings';
 if(href==='/recurring')return '/preview/recurring';
 if(href==='/expenses')return '/preview/expenses';
 if(href==='/five-pm-reminder')return '/preview/five-pm-reminder';
 if(href==='/receipts-needed')return '/preview/receipts-needed';
 if(href==='/blocked-times')return '/preview/blocked-times';
 if(href==='/dashboard/admin/manage-availability')return '/preview/manage-availability';
 if(href==='/communication-log')return '/preview/communication-log';
 if(href==='/calendar')return '/preview/calendar';
 if(href==='/calendar-glance')return '/preview/calendar-glance';
 if(href==='/schedule')return '/preview/daily-schedule';
 if(href==='/print-schedule')return '/preview/print-schedule';
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
