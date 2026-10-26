import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

// ─── .docx generation without any npm packages ────────────────────
// A .docx file is a ZIP archive containing Office Open XML files.
// We build the XML by hand and assemble the ZIP byte-by-byte using
// the STORE (no-compression) method. Works everywhere, zero deps.

export async function GET(request) {
  try {
    await requireAuth();
    const tenantId = await resolveTenantFromSession(request);

    const settings = await sql`
      SELECT key, value
      FROM settings
      WHERE tenant_id = ${tenantId}
      ORDER BY key ASC
    `;

    const categorized = {
      general: [],
      booking: [],
      messages: [],
      sms: [],
      data: [],
      system: [],
    };

    settings.forEach(({ key, value }) => {
      categorized[categorizeKey(key)].push({ key, value });
    });

    const generatedDate = new Date().toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const documentXml = buildDocumentXml(categorized, generatedDate);
    const docxBuffer = buildDocxZip(documentXml);

    return new Response(docxBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="settings-report-${new Date().toISOString().split("T")[0]}.docx"`,
      },
    });
  } catch (error) {
    console.error("[Settings Export DOCX] Error:", error);
    return Response.json(
      { error: "Failed to generate settings report" },
      { status: 500 },
    );
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function categorizeKey(key) {
  if (
    /^(business_|owner_|from_|custom_domain|google_review|services_url|provider_label|rate_per_mile|manual_mileage|additional_owner|send_emails|send_sms|suppress_driver|require_login|driver_language|passenger_language|logo_url|contact_phone|office_phone)/.test(
      key,
    )
  )
    return "general";
  if (/^(sms_|clicksend_|quo_)/.test(key)) return "sms";
  if (
    /^(booking_|prepay_|require_welcome|enable_tour|tour_|followup_|driver_portal|payment_|credit_card_fee|tipping_|venmo_|zelle_|square_)/.test(
      key,
    )
  )
    return "booking";
  if (/^(message_template_|confirmation_|reminder_)/.test(key))
    return "messages";
  if (/^(bypass_|rotation_)/.test(key)) return "system";
  return "data";
}

function formatKeyName(key) {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Word XML Builder ──────────────────────────────────────────────

function buildDocumentXml(categorized, generatedDate) {
  const sections = [
    { title: "General Settings", items: categorized.general },
    { title: "Booking & Online Form", items: categorized.booking },
    { title: "Message Templates", items: categorized.messages },
    { title: "SMS Configuration", items: categorized.sms },
    { title: "Data & Import/Export", items: categorized.data },
    { title: "System Settings", items: categorized.system },
  ];

  let body = "";

  // Title
  body += `<w:p>
      <w:pPr><w:pStyle w:val="Title"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>Settings Configuration Report</w:t></w:r>
    </w:p>`;

  // Date
  body += `<w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:i/><w:sz w:val="20"/></w:rPr>
        <w:t>Generated: ${esc(generatedDate)}</w:t>
      </w:r>
    </w:p><w:p/>`;

  for (const section of sections) {
    body += `<w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:t>${esc(section.title)}</w:t></w:r>
      </w:p>`;

    if (section.items.length === 0) {
      body += `<w:p>
          <w:r><w:rPr><w:i/><w:color w:val="888888"/></w:rPr>
            <w:t>No settings configured in this category.</w:t>
          </w:r>
        </w:p>`;
      continue;
    }

    // Table
    body += `<w:tbl>
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="4" w:color="CCCCCC"/>
            <w:left w:val="single" w:sz="4" w:color="CCCCCC"/>
            <w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/>
            <w:right w:val="single" w:sz="4" w:color="CCCCCC"/>
            <w:insideH w:val="single" w:sz="4" w:color="DDDDDD"/>
            <w:insideV w:val="single" w:sz="4" w:color="DDDDDD"/>
          </w:tblBorders>
        </w:tblPr>
        <w:tblGrid><w:gridCol w:w="3600"/><w:gridCol w:w="5400"/></w:tblGrid>`;

    // Header row
    body += `<w:tr>
          <w:tc>
            <w:tcPr><w:shd w:val="clear" w:fill="E8EBF0"/></w:tcPr>
            <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>Setting</w:t></w:r></w:p>
          </w:tc>
          <w:tc>
            <w:tcPr><w:shd w:val="clear" w:fill="E8EBF0"/></w:tcPr>
            <w:p><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>Value</w:t></w:r></w:p>
          </w:tc>
        </w:tr>`;

    for (const { key, value } of section.items) {
      const displayValue =
        !value && value !== "0"
          ? "(not set)"
          : String(value).length > 200
            ? String(value).substring(0, 200) + "..."
            : String(value);

      body += `<w:tr>
          <w:tc><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr>
            <w:t>${esc(formatKeyName(key))}</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr>
            <w:t xml:space="preserve">${esc(displayValue)}</w:t></w:r></w:p></w:tc>
        </w:tr>`;
    }

    body += `</w:tbl><w:p/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  mc:Ignorable="w14 wp14">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
               w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

// ─── Minimal ZIP builder (STORE method, pure JS, zero deps) ────────

function buildDocxZip(documentXml) {
  const enc = new TextEncoder();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:spacing w:after="200"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="52"/><w:color w:val="1F2937"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="1E40AF"/></w:rPr>
  </w:style>
</w:styles>`;

  const files = [
    { name: "[Content_Types].xml", data: enc.encode(contentTypesXml) },
    { name: "_rels/.rels", data: enc.encode(relsXml) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(wordRelsXml) },
    { name: "word/document.xml", data: enc.encode(documentXml) },
    { name: "word/styles.xml", data: enc.encode(stylesXml) },
  ];

  return assembleZip(files);
}

function assembleZip(files) {
  const localEntries = [];
  const centralEntries = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    // Local file header: 30 bytes + filename
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); // local header sig
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression = STORE
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true); // crc-32
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    lh.set(nameBytes, 30);

    localEntries.push({ header: lh, data: file.data, offset });

    // Central directory header: 46 bytes + filename
    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); // central dir sig
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true); // compression = STORE
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true); // offset of local header
    ch.set(nameBytes, 46);

    centralEntries.push(ch);
    offset += lh.length + file.data.length;
  }

  // End of central directory: 22 bytes
  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const c of centralEntries) centralDirSize += c.length;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true);

  // Total size
  let total = 0;
  for (const e of localEntries) total += e.header.length + e.data.length;
  for (const c of centralEntries) total += c.length;
  total += eocd.length;

  // Assemble
  const out = new Uint8Array(total);
  let pos = 0;
  for (const e of localEntries) {
    out.set(e.header, pos);
    pos += e.header.length;
    out.set(e.data, pos);
    pos += e.data.length;
  }
  for (const c of centralEntries) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(eocd, pos);

  return out.buffer;
}

// ─── CRC-32 (IEEE 802.3) ──────────────────────────────────────────

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
