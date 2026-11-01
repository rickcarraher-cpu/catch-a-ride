import { getDatabase } from "./auth.server";
import { logResetStage, sendResetEmail } from "./reset-diagnostics.server";
import { createPasswordReset } from "./password-reset-core.server";

export function requirePreviewReset() {
  if (process.env.VERCEL_ENV !== "preview") throw new Response("Not found", { status: 404 });
}
export function getPasswordReset() {
  requirePreviewReset();
  const key = process.env.RESEND_KEY;
  const host = process.env.VERCEL_URL;
  if (!key || !host || !/^[a-zA-Z0-9.-]+\.vercel\.app$/.test(host)) {
    logResetStage('configuration');
    throw new Error("Preview reset configuration missing");
  }
  let database;
  try { database = getDatabase(); }
  catch (error) { logResetStage('database', error); throw error; }
  // Preserve pg query semantics while classifying failures without logging SQL/params.
  const diagnosed = { query: async (...args: unknown[]) => {
    try { return await Reflect.apply(database.query, database, args); }
    catch (error) { logResetStage('database', error); throw error; }
  } } as Pick<typeof database, 'query'>;
  return createPasswordReset(diagnosed, (email, link) => sendResetEmail(key, email, link), `https://${host}`);
}
