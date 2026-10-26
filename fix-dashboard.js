/**
 * Script to remove "Current Dispatcher: Admin" from dashboard page
 * Run with: node fix-dashboard.js
 */

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/app/dashboard/page.jsx");

// Read the file
let content = fs.readFileSync(filePath, "utf8");

// Pattern to find and replace
const oldPattern = `          {/* ===== HEADER ===== */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <span className="text-5xl leading-none">🚖</span>
              <div>
                <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
                  Catch A Ride
                </h1>
                <div className="text-yellow-400 text-xl mt-0.5">⭐⭐⭐⭐⭐</div>
              </div>
            </div>
            <div className="text-sm text-gray-600 text-right">
              <span className="font-semibold text-gray-800">
                Current Dispatcher: {employee?.name || "Admin"}
              </span>
            </div>
          </div>`;

const newPattern = `          {/* ===== HEADER ===== */}
          <div className="flex items-center">
            <div className="flex items-start gap-3">
              <span className="text-5xl leading-none">🚖</span>
              <div>
                <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
                  Catch A Ride
                </h1>
                <div className="text-yellow-400 text-xl mt-0.5">⭐⭐⭐⭐⭐</div>
              </div>
            </div>
          </div>`;

// Replace
if (content.includes(oldPattern)) {
  content = content.replace(oldPattern, newPattern);
  fs.writeFileSync(filePath, content, "utf8");
  console.log(
    '✅ Successfully removed "Current Dispatcher: Admin" from dashboard',
  );
} else {
  console.log(
    "❌ Pattern not found. The file may have already been updated or the structure is different.",
  );
  console.log("Searching for partial match...");

  if (content.includes("Current Dispatcher:")) {
    console.log('✓ Found "Current Dispatcher:" text in file');
    console.log("Manual fix required - see DASHBOARD_FIX_INSTRUCTIONS.md");
  } else {
    console.log('✓ "Current Dispatcher:" not found - may already be fixed');
  }
}
