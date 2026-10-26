#!/usr/bin/env node

/**
 * Script to remove "Current Dispatcher" text from dashboard
 * Run this with: node remove-dispatcher-text.js
 */

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/app/dashboard/page.jsx");

console.log("Reading dashboard file...");
let content = fs.readFileSync(filePath, "utf8");

// Find and remove the "Current Dispatcher" div
const before = content;
content = content.replace(
  /<div className="text-sm text-gray-600 text-right">\s*<span className="font-semibold text-gray-800">\s*Current Dispatcher: \{employee\?\.name \|\| "Admin"\}\s*<\/span>\s*<\/div>/g,
  "",
);

if (content === before) {
  console.log('❌ Could not find the "Current Dispatcher" section to remove');
  console.log(
    "The section may have already been removed or the format changed.",
  );
  process.exit(1);
}

console.log("Writing updated file...");
fs.writeFileSync(filePath, content, "utf8");

console.log(
  '✅ Successfully removed "Current Dispatcher" text from dashboard!',
);
