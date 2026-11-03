export function printDrivers(filteredDrivers, vehiclesByDriver) {
  const driversToPrint = filteredDrivers || [];
  const rows = driversToPrint
    .map((driver) => {
      const driverVehicles = vehiclesByDriver[driver.id] || [];
      const vehicleText =
        driverVehicles
          .map((v) =>
            [v.name, v.year, v.color, v.plate].filter(Boolean).join(" · "),
          )
          .join("; ") || "—";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:${driver.color || "#888"};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;">${driver.name.charAt(0)}</div>
            <span style="font-weight:700;color:#000;">${driver.name}</span>
          </div>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${driver.is_active ? '<span style="color:#16a34a;font-weight:700;">Active</span>' : '<span style="color:#6b7280;font-weight:600;">Inactive</span>'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#000;">${driver.email || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#000;">${driver.phone || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:#000;">${Math.round((driver.salary_rate || 0) * 100)}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:#000;">#${driver.rotation_order || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;color:#000;">${vehicleText}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html><head><title>Driver List</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; color: #000; }
  h1 { font-size: 22px; margin: 0 0 4px; font-weight: 800; color: #000; }
  p.sub { font-size: 13px; color: #000; margin: 0 0 20px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: #f9fafb; border-bottom: 2px solid #000; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #000; font-weight: 700; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<h1>Driver List</h1>
<p class="sub">Printed ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} &mdash; ${driversToPrint.length} driver${driversToPrint.length !== 1 ? "s" : ""}</p>
<table>
  <thead><tr>
    <th>Name</th><th>Status</th><th>Email</th><th>Phone</th><th style="text-align:center;">Comm.</th><th style="text-align:center;">Rotation</th><th>Vehicles</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

  const printWindow =
    typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }
}
