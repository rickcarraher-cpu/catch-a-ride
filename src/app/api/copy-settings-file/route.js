import fs from "fs";
import path from "path";

export async function POST(request) {
  try {
    const sourceFile = path.join(process.cwd(), "src/app/settings/page.jsx");
    const targetFile = path.join(
      process.cwd(),
      "src/app/settings-data/page.jsx",
    );

    // Read the settings file
    const content = fs.readFileSync(sourceFile, "utf-8");

    // Write to settings-data
    fs.writeFileSync(targetFile, content, "utf-8");

    return new Response(
      JSON.stringify({
        success: true,
        message: "File copied successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
