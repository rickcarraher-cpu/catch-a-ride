export function ServicesSection({ formData, services, settings, trip }) {
  // Helper: gas fee addons are treated like tips — no commission, shown in green
  // Check both the entry's service_name AND the catalog name (entry.service_name can be empty)
  const isGasFee = (entry) => {
    const serviceDef = services?.find((ser) => ser.id == entry.service_id);
    const name = (serviceDef?.name || entry.service_name || "").toLowerCase();
    return name.includes("gas");
  };

  // Calculate totals
  const serviceEntries = formData.services.map((s, i) => {
    const serviceDef = services?.find((ser) => ser.id == s.service_id);
    return { ...s, _origIdx: i, _isAddon: serviceDef?.is_addon || false };
  });
  const mainEntries = serviceEntries.filter((s) => !s._isAddon);
  const addonEntries = serviceEntries.filter((s) => s._isAddon);

  // Split addon entries into gas fees (tip-like) and regular addons
  const gasFeeEntries = addonEntries.filter(isGasFee);
  const regularAddonEntries = addonEntries.filter((s) => !isGasFee(s));

  const baseCost = mainEntries.reduce(
    (sum, s) => sum + Number(s.service_price),
    0,
  );
  // Regular addons only — gas fees excluded from commission base
  const regularAddOnsTotal = regularAddonEntries.reduce(
    (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
    0,
  );
  const gasFeesTotal = gasFeeEntries.reduce(
    (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
    0,
  );
  const subtotal = baseCost + regularAddOnsTotal;

  // Calculate credit card fee if payment method is Credit Card, Square, or Square Invoice
  // CC fee applies only to commission base (excluding gas fees, same as tips)
  const shouldApplyFee =
    formData.payment_method === "Credit Card" ||
    formData.payment_method === "Square" ||
    formData.payment_method === "Square Invoice";
  const feePercent = Number(settings?.credit_card_fee_percent || 4);
  const creditCardFee = shouldApplyFee ? (subtotal * feePercent) / 100 : 0;
  // Round the credit card fee to match backend calculation (Math.round, not Math.ceil)
  const roundedCreditCardFee = Math.round(creditCardFee);

  // If an existing trip has a locked-in cc_fee_amount, use that instead of recalculating.
  // This prevents showing a stale/wrong fee when settings have changed since booking.
  const storedCcFee =
    trip && Number(trip.cc_fee_amount || 0) > 0
      ? Number(trip.cc_fee_amount)
      : null;

  // When cc_fee_amount isn't stored, infer from original_amount - services_total
  // (same logic as PaymentSummaryCard) so both sections always agree on the actual fee charged.
  const inferredCcFee =
    storedCcFee === null &&
    shouldApplyFee &&
    trip &&
    Number(trip.original_amount || 0) > 0 &&
    Number(trip.services_total || 0) > 0
      ? Math.max(0, Number(trip.original_amount) - Number(trip.services_total))
      : null;

  const displayCcFee =
    storedCcFee !== null
      ? storedCcFee
      : inferredCcFee !== null
        ? inferredCcFee
        : roundedCreditCardFee;

  const grandTotal = subtotal + displayCcFee + gasFeesTotal;

  if (formData.services.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <label className="text-xs font-semibold text-gray-500 uppercase">
        Services & Pricing
      </label>

      {/* Totals */}
      <div className="flex justify-end pt-2 border-t border-gray-200">
        <div className="text-right space-y-1">
          {(regularAddonEntries.length > 0 || gasFeeEntries.length > 0) && (
            <p className="text-xs text-gray-500">
              Base:{" "}
              <span className="font-semibold">${baseCost.toFixed(2)}</span>
            </p>
          )}
          {regularAddonEntries.length > 0 && (
            <p className="text-xs text-gray-500">
              Add-ons:{" "}
              <span className="font-semibold">
                +${regularAddOnsTotal.toFixed(2)}
              </span>
            </p>
          )}
          {shouldApplyFee && displayCcFee > 0 && (
            <p className="text-xs text-gray-500">
              Credit Card Fee
              {storedCcFee !== null || inferredCcFee !== null
                ? ""
                : ` (${feePercent}%)`}
              :{" "}
              <span className="font-semibold">+${displayCcFee.toFixed(2)}</span>
            </p>
          )}
          {gasFeeEntries.map((entry, i) => {
            const serviceDef = services?.find(
              (ser) => ser.id == entry.service_id,
            );
            const displayName =
              serviceDef?.name || entry.service_name || "Gas Fee";
            return (
              <p key={i} className="text-xs text-green-700">
                {displayName}:{" "}
                <span className="font-semibold text-green-600">
                  +$
                  {(
                    Number(entry.service_price) * Number(entry.quantity || 1)
                  ).toFixed(2)}{" "}
                  <span className="font-normal text-green-500">
                    (no commission)
                  </span>
                </span>
              </p>
            );
          })}
          <p className="text-sm font-bold text-gray-900">
            TOTAL: ${grandTotal.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
