export function PaymentSummaryCard({ trip, transactions }) {
  if (!trip) return null;

  const fmt = (n) => `$${Math.abs(Number(n) || 0).toFixed(2)}`;

  // ══════════════════════════════════════════════════════════════
  // THE TRIP IS KING — all financial totals come directly from the
  // stored trip record. Nothing is recalculated from transactions
  // or services here.
  // ══════════════════════════════════════════════════════════════
  const servicesTotal = Number(trip.services_total || 0);
  const ccFeeAmount = Number(trip.cc_fee_amount || 0);
  const tipsTotal = Number(trip.tips_total || 0);
  const paymentsTotal = Number(trip.payments_total || 0);
  const balanceDue = Number(trip.balance_due || 0);

  // ── Payment method display ─────────────────────────────────────
  // (transactions used only to detect cash tips for the display label)
  const paymentTxns = (transactions || []).filter(
    (t) => t.category === "payment" && Number(t.amount) > 0,
  );
  const tipTxns = (transactions || []).filter(
    (t) =>
      (t.category === "tip" ||
        (t.category === "payment" && Number(t.tip_amount || 0) > 0)) &&
      Number(t.tip_amount || 0) > 0,
  );
  const hasCashTip = tipTxns.some((t) => t.method === "Cash");
  const tripPaymentMethod =
    trip.payment_method || paymentTxns[0]?.method || "—";
  const paymentMethodDisplay = [
    tripPaymentMethod,
    hasCashTip && tripPaymentMethod !== "Cash" ? "Cash Tip" : null,
    hasCashTip && tripPaymentMethod === "Cash" ? "(+ Tip)" : null,
  ]
    .filter(Boolean)
    .join(", ");

  // ── Date paid display ──────────────────────────────────────────
  const datePaid = trip.payment_date
    ? new Date(trip.payment_date).toLocaleDateString("en-US", {
        timeZone: "America/Chicago",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  // ── Optional service breakdown — informational sub-rows only ───
  // These help the user see the composition of the price.
  // The TOTALS above are the authoritative values from the trip record.
  const tripServices = trip?.appointment_services || trip?.services || [];
  const gasFeeAmt = tripServices.reduce((sum, s) => {
    const name = (s.service_name || s.name || "").toLowerCase();
    return name.includes("gas")
      ? sum + Number(s.service_price || 0) * Number(s.quantity || 1)
      : sum;
  }, 0);
  const nonGasAddonAmt = tripServices.reduce((sum, s) => {
    const name = (s.service_name || s.name || "").toLowerCase();
    return s.is_addon && !name.includes("gas")
      ? sum + Number(s.service_price || 0) * Number(s.quantity || 1)
      : sum;
  }, 0);

  // ── Data inconsistency check ───────────────────────────────────
  const hasPaymentDate = !!trip.payment_date;
  // Zero-charge trips (services_total = 0 and balance settled) are legitimately
  // marked paid with $0 in payment transactions — matches the backend's
  // isZeroChargePaid logic. Do NOT flag those as inconsistent.
  const isZeroChargePaid = servicesTotal === 0 && balanceDue <= 0;
  const hasInconsistency =
    hasPaymentDate &&
    !isZeroChargePaid &&
    (paymentsTotal === 0 || balanceDue > 0);

  // Gas fee is already shown as its own line — subtract it from tipsTotal for display
  // so it isn't counted twice. tips_total in the DB includes gas fees by design.
  const displayTip = Math.max(0, tipsTotal - gasFeeAmt);

  const rows = [
    {
      label: "Trip Amount",
      value: fmt(servicesTotal),
      valueClass: "text-gray-900 font-semibold",
    },
    // Non-gas addon sub-row — informational only, from loaded services
    ...(nonGasAddonAmt > 0
      ? [
          {
            label: "Add-ons",
            value: fmt(nonGasAddonAmt),
            valueClass: "text-purple-700 font-semibold",
            labelClass: "text-purple-700",
            rowBg: "bg-purple-50",
          },
        ]
      : []),
    // Gas Fee sub-row — informational only, from loaded services
    ...(gasFeeAmt > 0
      ? [
          {
            label: "Gas Fee",
            value: fmt(gasFeeAmt),
            valueClass: "text-orange-700 font-semibold",
            labelClass: "text-orange-700",
            rowBg: "bg-orange-50",
          },
        ]
      : []),
    // Tip — display only the actual tip (gas fee is already shown above)
    ...(displayTip > 0
      ? [
          {
            label: "Tip Amount",
            value: fmt(displayTip),
            valueClass: "text-green-700 font-semibold",
            labelClass: "text-green-700",
            rowBg: "bg-green-50",
          },
        ]
      : [
          {
            label: "Tip Amount",
            value: fmt(0),
            valueClass: "text-gray-400 font-semibold",
          },
        ]),
    // CC Fee — from trip record (trip.cc_fee_amount, locked at booking time)
    {
      label: "Credit Card Fee",
      value: ccFeeAmount > 0 ? `+${fmt(ccFeeAmount)}` : fmt(0),
      valueClass:
        ccFeeAmount > 0
          ? "text-amber-700 font-semibold"
          : "text-gray-400 font-semibold",
      labelClass: ccFeeAmount > 0 ? "text-amber-700" : undefined,
      rowBg: ccFeeAmount > 0 ? "bg-amber-50" : undefined,
    },
    // Payment Amount — from trip record (trip.payments_total)
    {
      label: "Payment Amount",
      value: paymentsTotal > 0 ? fmt(paymentsTotal) : fmt(0),
      valueClass:
        paymentsTotal > 0
          ? "text-blue-700 font-semibold"
          : "text-gray-400 font-semibold",
      labelClass: paymentsTotal > 0 ? "text-blue-700" : undefined,
      rowBg: paymentsTotal > 0 ? "bg-blue-50" : undefined,
    },
    // Balance Due — from trip record (trip.balance_due) — THE SOURCE OF TRUTH
    {
      label: "Balance Due",
      value: fmt(balanceDue),
      valueClass:
        balanceDue > 0
          ? "text-red-700 font-bold"
          : balanceDue < 0
            ? "text-green-700 font-semibold"
            : "text-gray-400 font-semibold",
      labelClass:
        balanceDue > 0
          ? "text-red-700"
          : balanceDue < 0
            ? "text-green-700"
            : undefined,
      rowBg:
        balanceDue > 0
          ? "bg-red-50"
          : balanceDue < 0
            ? "bg-green-50"
            : undefined,
    },
    {
      label: "Payment Method",
      value: paymentMethodDisplay,
      valueClass: "text-gray-700 font-semibold",
    },
    {
      label: "Date Paid",
      value: datePaid,
      valueClass: trip.payment_date
        ? "text-blue-700 font-semibold"
        : "text-gray-400 font-semibold",
      labelClass: trip.payment_date ? "text-blue-700" : undefined,
      rowBg: trip.payment_date ? "bg-blue-50" : undefined,
      noBorder: true,
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden text-xs">
      {/* ── DATA INCONSISTENCY WARNING ────────────────────────────── */}
      {hasInconsistency && (
        <div className="bg-red-50 border-b-2 border-red-300 px-4 py-3 flex items-start gap-2.5">
          <div className="text-red-600 mt-0.5 flex-shrink-0">⚠️</div>
          <div className="flex-1">
            <p className="text-xs font-bold text-red-800 mb-1">
              Data Inconsistency Detected
            </p>
            <p className="text-xs text-red-700 leading-relaxed">
              This trip shows a <strong>Date Paid</strong> (
              {new Date(trip.payment_date).toLocaleDateString("en-US", {
                timeZone: "America/Chicago",
              })}
              ) but has{" "}
              {paymentsTotal === 0 ? (
                <strong>$0.00 in payments</strong>
              ) : (
                <strong>${balanceDue.toFixed(2)} still owed</strong>
              )}
              . This happens when payments are deleted or reversed without
              clearing the date.
            </p>
            <p className="text-xs text-red-600 mt-1.5 font-semibold">
              💡 The system will automatically fix this when you save any
              changes to this trip.
            </p>
          </div>
        </div>
      )}

      {rows.map((row, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-4 py-2.5 ${
            row.noBorder ? "" : "border-b border-gray-100"
          } ${row.rowBg || ""}`}
        >
          <span
            className={`font-semibold ${row.labelClass || "text-gray-700"}`}
          >
            {row.label}
          </span>
          <span className={row.valueClass}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}
