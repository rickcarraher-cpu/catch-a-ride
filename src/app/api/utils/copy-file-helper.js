import fs from "fs";
import path from "path";

export async function GET(request) {
  try {
    const sourceFile = path.join(process.cwd(), "src/app/settings/page.jsx");
    const content = fs.readFileSync(sourceFile, "utf-8");

    return new Response(JSON.stringify({ content }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
