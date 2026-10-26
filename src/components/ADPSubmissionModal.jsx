import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Send,
  Eye,
  History,
  Building2,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Users,
  TrendingUp,
  MinusCircle,
  ChevronDown,
  ChevronUp,
  Printer,
} from "lucide-react";

function fmt(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export function ADPSubmissionModal({
  report,
  periodLabel,
  startDate,
  endDate,
  onClose,
}) {
  const [view, setView] = useState("preview"); // preview, history
  const [expandedDrivers, setExpandedDrivers] = useState({});

  // Fetch payroll submission history
  const { data: history } = useQuery({
    queryKey: ["payroll-history"],
    queryFn: async () => {
      const res = await fetch("/api/payroll/adp?limit=10");
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
  });

  // Submit to ADP mutation
  const submitMutation = useMutation({
    mutationFn: async ({ testMode }) => {
      const res = await fetch("/api/payroll/adp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          testMode,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit payroll");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (!data.testMode) {
        // Show success and close after delay
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    },
  });

  const toggleDriver = (driverId) => {
    setExpandedDrivers((prev) => ({
      ...prev,
      [driverId]: !prev[driverId],
    }));
  };

  const handleSubmit = (testMode) => {
    submitMutation.mutate({ testMode });
  };

  const handlePrint = () => {
    const drivers = report?.drivers || [];
    const summary = report?.summary || {};

    const rows = drivers
      .map((dr) => {
        const d = dr.driver;
        const s = dr.summary;
        const workerId = d.adp_worker_id || d.id;
        const missingId = !d.adp_worker_id;
        return `
        <tr>
          <td>${d.name}</td>
          <td style="font-family:monospace">${workerId}${missingId ? ' <em style="color:#b45309;font-size:11px">(db id)</em>' : ""}</td>
          <td class="num">${s.total_trips}</td>
          <td class="num">$${Number(s.total_commission || 0).toFixed(2)}</td>
          <td class="num">$${Number(s.total_tips || 0).toFixed(2)}</td>
          <td class="num red">${s.total_cash_collected > 0 ? "-$" + Number(s.total_cash_collected).toFixed(2) : "—"}</td>
          <td class="num bold">$${Number(s.net_payroll || 0).toFixed(2)}</td>
        </tr>`;
      })
      .join("");

    const missingIdDrivers = drivers.filter((dr) => !dr.driver.adp_worker_id);

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>ADP Payroll Report – ${periodLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; padding: 40px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 32px; }
    .meta { display: flex; gap: 32px; margin-bottom: 32px; }
    .meta-item { }
    .meta-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 4px; }
    .meta-value { font-size: 22px; font-weight: 700; color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { border-bottom: 2px solid #111; }
    th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    .num { text-align: right; }
    .bold { font-weight: 700; }
    .red { color: #c2410c; }
    tfoot tr { border-top: 2px solid #111; }
    tfoot td { font-weight: 700; padding-top: 12px; }
    .warning { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px; font-size: 12px; color: #92400e; }
    .warning strong { display: block; margin-bottom: 4px; font-size: 13px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <h1>ADP Payroll Submission Report</h1>
  <div class="subtitle">Period: ${periodLabel} &nbsp;·&nbsp; Dates: ${startDate} → ${endDate}</div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Drivers</div>
      <div class="meta-value">${drivers.length}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Total Commission</div>
      <div class="meta-value">$${Number(summary.total_commission || 0).toFixed(2)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Total Tips</div>
      <div class="meta-value">$${Number(summary.total_tips || 0).toFixed(2)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Net Payroll</div>
      <div class="meta-value">$${Number(summary.total_payroll || 0).toFixed(2)}</div>
    </div>
  </div>

  ${
    missingIdDrivers.length > 0
      ? `
  <div class="warning">
    <strong>⚠ ${missingIdDrivers.length} driver(s) missing ADP Worker ID — using database ID as fallback:</strong>
    ${missingIdDrivers.map((dr) => dr.driver.name).join(", ")}
  </div>`
      : ""
  }

  <table>
    <thead>
      <tr>
        <th>Driver</th>
        <th>ADP Worker ID</th>
        <th class="num">Trips</th>
        <th class="num">Commission</th>
        <th class="num">Tips</th>
        <th class="num">Cash Deduction</th>
        <th class="num">Net Payroll</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2">Total</td>
        <td class="num">${summary.total_trips || 0}</td>
        <td class="num">$${Number(summary.total_commission || 0).toFixed(2)}</td>
        <td class="num">$${Number(summary.total_tips || 0).toFixed(2)}</td>
        <td class="num red">${summary.total_cash_collected > 0 ? "-$" + Number(summary.total_cash_collected).toFixed(2) : "—"}</td>
        <td class="num">$${Number(summary.total_payroll || 0).toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>Generated ${new Date().toLocaleString()}</span>
    <span>DRAFT – not yet submitted to ADP</span>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">ADP Payroll</h2>
              <p className="text-sm text-gray-500">{periodLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-8 pt-4 border-b border-gray-200">
          <div className="flex gap-6">
            <button
              onClick={() => setView("preview")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                view === "preview"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Preview Submission
              </div>
            </button>
            <button
              onClick={() => setView("history")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                view === "history"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Submission History
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {view === "preview" && (
            <div className="space-y-6">
              {/* Success/Error Message */}
              {submitMutation.isSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-900">
                      {submitMutation.data.testMode
                        ? "Test Preview Successful"
                        : "Payroll Submitted Successfully"}
                    </h4>
                    <p className="text-sm text-green-700 mt-1">
                      {submitMutation.data.testMode
                        ? "The data is valid and ready to submit to ADP."
                        : "Payroll data has been sent to ADP and recorded in the system."}
                    </p>
                    {submitMutation.data.summary && (
                      <div className="mt-2 text-sm text-green-700">
                        Submitted {submitMutation.data.summary.driver_count}{" "}
                        drivers with total compensation of{" "}
                        {fmt(submitMutation.data.summary.total_compensation)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {submitMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-900">
                      Submission Failed
                    </h4>
                    <p className="text-sm text-red-700 mt-1">
                      {submitMutation.error.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">
                      Drivers
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {report.drivers.length}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">
                      Commission
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {fmt(report.summary.total_commission)}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">Tips</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {fmt(report.summary.total_tips)}
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-orange-600 mb-2">
                    <MinusCircle className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase">
                      Cash Deduct
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-orange-900">
                    {fmt(report.summary.total_cash_collected)}
                  </div>
                </div>
              </div>

              {/* Driver Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Driver Breakdown
                </h3>
                {report.drivers.map((driverReport) => {
                  const driver = driverReport.driver;
                  const summary = driverReport.summary;
                  const isExpanded = expandedDrivers[driver.id];

                  return (
                    <div
                      key={driver.id}
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleDriver(driver.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: driver.color }}
                          />
                          <div className="text-left">
                            <div className="font-medium text-gray-900">
                              {driver.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              ADP ID:{" "}
                              {driver.adp_worker_id ||
                                `${driver.id} (database ID)`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              {fmt(summary.net_payroll)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {summary.total_trips} trips
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Commission</span>
                              <span className="font-medium text-gray-900">
                                {fmt(summary.total_commission)}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Tips</span>
                              <span className="font-medium text-gray-900">
                                {fmt(summary.total_tips)}
                              </span>
                            </div>
                            {summary.total_cash_collected > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                  Cash Deduction
                                </span>
                                <span className="font-medium text-orange-600">
                                  -{fmt(summary.total_cash_collected)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                              <span className="font-semibold text-gray-900">
                                Net Payroll
                              </span>
                              <span className="font-bold text-gray-900">
                                {fmt(summary.net_payroll)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "history" && (
            <div className="space-y-4">
              {history?.submissions?.length > 0 ? (
                history.submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="bg-white border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {new Date(submission.startDate).toLocaleDateString()}{" "}
                          - {new Date(submission.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {submission.driverCount} drivers ·{" "}
                          {fmt(submission.totalCompensation)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          {new Date(submission.submittedAt).toLocaleString()}
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {submission.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No previous submissions</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {view === "preview" && (
          <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 border border-gray-200"
              >
                <Printer className="w-4 h-4" />
                Print Report
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                Test Preview
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitMutation.isPending}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {submitMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit to ADP
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
