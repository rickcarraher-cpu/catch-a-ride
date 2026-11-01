import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  X,
  Calendar,
  Clock,
  User,
  Car,
  Phone,
  MapPin,
  Luggage,
  PlaneTakeoff,
  PlaneLanding,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Download,
  CreditCard,
  Loader2,
  FileText,
  Mail,
  ExternalLink,
  Link2,
  Copy,
} from "lucide-react";

function formatLongDate(dt) {
  return new Date(dt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });
}

function formatTime(dt) {
  return new Date(dt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
}

function formatDateOnlyLocal(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const str =
      typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "N/A";
    const [, year, month, day] = match;
    const d = new Date(`${year}-${month}-${day}T12:00:00Z`);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "N/A";
  }
}

// Always show trip number in 26-XXXX format
function getTripNumber(booking) {
  if (booking?.booking_number) return booking.booking_number;
  if (booking?.id) return `26-${String(booking.id).padStart(4, "0")}`;
  return "—";
}

function DetailRow({ icon: Icon, label, value, accent }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`mt-0.5 shrink-0 ${accent || "text-gray-400"}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="text-sm font-medium text-gray-900 break-words">{value}</p>
      </div>
    </div>
  );
}

const PAYMENT_METHODS = [
  { value: "Cash", label: "Cash" },
  { value: "Square Invoice", label: "Square Invoice" },
  { value: "Venmo", label: "Venmo" },
  { value: "Zelle", label: "Zelle" },
  { value: "Stripe", label: "Stripe" },
];

export function InvoiceModal({ tripId, onClose }) {
  const [paymentMethod, setPaymentMethod] = useState("");
  const [sent, setSent] = useState(false);
  const [paymentLink, setPaymentLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [venmoLink, setVenmoLink] = useState("");
  const [generatingVenmoLink, setGeneratingVenmoLink] = useState(false);
  const [tipAmount, setTipAmount] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const {
    data: booking,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["booking-detail", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${tripId}`);
      if (!res.ok) throw new Error("Booking not found");
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: paymentStatus, refetch: refetchPaymentStatus } = useQuery({
    queryKey: ["payment-status", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/payments/trip/${tripId}/status`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!tripId,
    refetchInterval: (query) => {
      const data = query.state.data;
      const tripStatus = data?.trip?.payment_status;
      // Poll every 5s if there's an active unpaid payment
      if (
        tripStatus &&
        tripStatus !== "paid" &&
        tripStatus !== "unpaid" &&
        tripStatus !== "refunded"
      ) {
        return 5000;
      }
      // Also poll if we just generated a link in this session
      if (paymentLink) return 5000;
      return false;
    },
  });

  const { data: venmoPaymentStatus, refetch: refetchVenmoStatus } = useQuery({
    queryKey: ["venmo-payment-status", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/payments/venmo/status/${tripId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!tripId,
    refetchInterval: venmoLink ? 10000 : false,
  });

  // Derive the actual payment status from the correct nested path
  const currentPaymentStatus =
    paymentStatus?.trip?.payment_status ||
    venmoPaymentStatus?.payment_status ||
    "unpaid";

  // Auto-load existing Venmo link if present
  useEffect(() => {
    if (venmoPaymentStatus?.payment_url && !venmoLink) {
      setVenmoLink(venmoPaymentStatus.payment_url);
    }
  }, [venmoPaymentStatus, venmoLink]);

  const businessName = settings?.business_name || "Catch A Ride";
  const logoUrl = settings?.logo_url;
  const squareConfigured =
    settings?.square_access_token && settings?.square_location_id;
  const squareEnabled = settings?.payment_square_enabled === "true";
  const venmoEnabled = settings?.payment_venmo_enabled === "true";
  const venmoHandle = settings?.venmo_handle;
  const venmoConfigured = venmoEnabled && venmoHandle;

  const servicesSubtotal =
    booking?.services?.reduce(
      (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    ) ?? 0;

  // Calculate credit card fee based on the trip's payment method from database
  const tripPaymentMethod = booking?.payment_method || "";
  const tripPaymentMethodLower = tripPaymentMethod.toLowerCase();
  const tripHasCardPayment =
    tripPaymentMethodLower.includes("card") ||
    tripPaymentMethodLower.includes("credit") ||
    tripPaymentMethodLower.includes("square");

  const feePercent = Number(settings?.credit_card_fee_percent || 4);
  const tripCreditCardFee =
    tripHasCardPayment && servicesSubtotal > 0
      ? Math.round((Math.ceil(servicesSubtotal) * feePercent) / 100)
      : 0;

  // Use original_amount from database for final total
  const finalTotal =
    Number(booking?.original_amount || 0) > 0
      ? Number(booking.original_amount)
      : Math.ceil(servicesSubtotal) + tripCreditCardFee;

  // Calculate balance due (what the customer still owes)
  const paidToDate = Number(booking?.payments_total ?? 0);
  const existingTips = Number(booking?.tips_total ?? 0);
  const balanceDue = Number(booking?.balance_due ?? finalTotal - paidToDate);

  // The tip the user is adding on this invoice
  const parsedTip = Number(tipAmount) || 0;

  // Invoice amount = balance due + new tip
  const invoiceAmount = Math.max(balanceDue + parsedTip, 0);

  const bagParts = [];
  if (booking?.num_bags_checked)
    bagParts.push(`${booking.num_bags_checked} Checked`);
  if (booking?.num_bags_carry_on)
    bagParts.push(`${booking.num_bags_carry_on} Carry-on`);

  const sendInvoiceMutation = useMutation({
    mutationFn: async () => {
      const pref = booking?.client_notification_preference || "both";
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: tripId,
          payment_method: paymentMethod,
          send_via: "email",
          tip_amount: parsedTip,
          notification_preference: pref,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send invoice");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const sentVia = [];
      if (data.emailSent || (data.sentEmails && data.sentEmails.length > 0))
        sentVia.push("email");
      if (data.smsSent) sentVia.push("SMS");

      if (
        data.skippedEmails &&
        data.skippedEmails.length > 0 &&
        (!data.sentEmails || data.sentEmails.length === 0) &&
        !data.smsSent
      ) {
        toast.warning(
          data.emailSkippedReason ||
            "Invoice email was skipped — a duplicate was already sent recently. Wait a few minutes and try again.",
        );
      } else if (sentVia.length === 0) {
        toast.error(
          "Invoice created but notifications failed to send. Check communication log for details.",
        );
      } else {
        setSent(true);
        toast.success(`Invoice sent via ${sentVia.join(" + ")}!`);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send invoice");
    },
  });

  const generateVenmoLinkMutation = useMutation({
    mutationFn: async () => {
      setGeneratingVenmoLink(true);
      const res = await fetch(`/api/payments/trip/${tripId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "venmo" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate Venmo payment link");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setVenmoLink(data.payment?.payment_url || data.payment_url);
      setGeneratingVenmoLink(false);
      toast.success("Venmo payment link generated!");
      refetchVenmoStatus();
    },
    onError: (err) => {
      setGeneratingVenmoLink(false);
      toast.error(err.message || "Failed to generate Venmo payment link");
    },
  });

  const copyVenmoLink = () => {
    if (venmoPaymentStatus?.payment_url || venmoLink) {
      navigator.clipboard.writeText(
        venmoPaymentStatus?.payment_url || venmoLink,
      );
      toast.success("Venmo payment link copied!");
    }
  };

  const statusBadge = () => {
    const status = currentPaymentStatus;
    const badges = {
      unpaid: { bg: "bg-gray-100", text: "text-gray-700", label: "Unpaid" },
      pending: { bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
      link_created: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        label: "Link Sent",
      },
      manual_pending: {
        bg: "bg-amber-100",
        text: "text-amber-700",
        label: "Awaiting Payment",
      },
      paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
      refunded: { bg: "bg-red-100", text: "text-red-700", label: "Refunded" },
    };
    const badge = badges[status] || badges.unpaid;
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}
      >
        {status === "paid" && <CheckCircle2 size={12} />}
        {badge.label}
      </div>
    );
  };

  const sortedServices = [...(booking?.services || [])].sort((a, b) => {
    const aVal = a.is_addon ? 1 : 0;
    const bVal = b.is_addon ? 1 : 0;
    return aVal - bVal;
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header bar */}
        <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            <h2 className="font-bold text-gray-900">Invoice</h2>
            {paymentStatus && statusBadge()}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-gray-400">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              Loading trip details…
            </div>
          ) : error || !booking ? (
            <div className="py-12 text-center">
              <AlertTriangle className="mx-auto mb-3 text-red-400" size={32} />
              <p className="font-semibold text-gray-800">Trip not found</p>
              <p className="text-sm text-gray-400 mt-1">
                Could not load this booking
              </p>
            </div>
          ) : (
            <>
              {/* Hero card — Booking Reference */}
              <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">
                      Invoice
                    </p>
                    <p className="text-3xl font-bold tracking-tight">
                      #{getTripNumber(booking)}
                    </p>
                    <p className="text-blue-200 text-xs mt-1">
                      Trip #: {getTripNumber(booking)}
                    </p>
                  </div>
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt={businessName}
                      className="h-8 object-contain"
                    />
                  )}
                </div>
                <p className="text-blue-200 text-xs mt-2">
                  Issued{" "}
                  {new Date().toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* Bill To */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Bill To
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {booking.client_name}
                </p>
                {booking.client_phone && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {booking.client_phone}
                  </p>
                )}
                {booking.client_email && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {booking.client_email}
                  </p>
                )}
              </div>

              {/* Trip Details — same layout as confirmation */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Trip Details
                </p>
                <DetailRow
                  icon={Calendar}
                  label="Date"
                  value={formatLongDate(booking.start_time)}
                  accent="text-blue-500"
                />
                <DetailRow
                  icon={Clock}
                  label="Pickup Time"
                  value={formatTime(booking.start_time)}
                  accent="text-blue-500"
                />
                {booking.return_date && (
                  <DetailRow
                    icon={CalendarClock}
                    label="Return Date"
                    value={formatDateOnlyLocal(booking.return_date)}
                    accent="text-purple-500"
                  />
                )}
                <DetailRow
                  icon={User}
                  label="Passenger"
                  value={booking.client_name}
                />
                <DetailRow
                  icon={Phone}
                  label="Phone"
                  value={booking.client_phone}
                />
                <DetailRow
                  icon={Car}
                  label="Driver"
                  value={booking.employee_name}
                  accent="text-green-500"
                />
                {booking.vehicle_name && (
                  <DetailRow
                    icon={Car}
                    label="Vehicle"
                    value={booking.vehicle_name}
                  />
                )}
                {booking.destination && (
                  <DetailRow
                    icon={MapPin}
                    label="Destination"
                    value={booking.destination}
                    accent="text-red-400"
                  />
                )}
                {booking.num_people && (
                  <DetailRow
                    icon={User}
                    label="Passengers"
                    value={String(booking.num_people)}
                  />
                )}
                {bagParts.length > 0 && (
                  <DetailRow
                    icon={Luggage}
                    label="Baggage"
                    value={bagParts.join(" + ")}
                  />
                )}
                {booking.outgoing_flight_info && (
                  <DetailRow
                    icon={PlaneTakeoff}
                    label="Outgoing Flight"
                    value={booking.outgoing_flight_info}
                    accent="text-sky-500"
                  />
                )}
                {booking.returning_flight_info && (
                  <DetailRow
                    icon={PlaneLanding}
                    label="Return Flight Info"
                    value={booking.returning_flight_info}
                    accent="text-indigo-500"
                  />
                )}
              </div>

              {/* Pricing */}
              {sortedServices.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Pricing
                  </p>
                  <div className="space-y-2">
                    {sortedServices.map((s, i) => {
                      const lineTotal =
                        Number(s.service_price) * Number(s.quantity || 1);
                      const isAddon = s.is_addon === true;
                      return (
                        <div
                          key={i}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="text-gray-600">
                            {isAddon ? "Plus" : "Cost"}: {s.service_name}
                            {s.quantity > 1 && (
                              <span className="text-gray-400 ml-1">
                                ×{s.quantity}
                              </span>
                            )}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {isAddon ? "+" : ""}${lineTotal.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                    {tripCreditCardFee > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Credit Card Fee ({feePercent}%)
                        </span>
                        <span className="font-semibold text-gray-900">
                          +${tripCreditCardFee.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between items-center">
                      <span className="font-semibold text-gray-700 text-sm">
                        Trip Total
                      </span>
                      <span className="font-bold text-gray-900">
                        ${finalTotal.toFixed(2)}
                      </span>
                    </div>
                    {paidToDate > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-green-600">Paid to Date</span>
                        <span className="font-semibold text-green-600">
                          -${paidToDate.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {existingTips > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-green-600">Tips Received</span>
                        <span className="font-semibold text-green-600">
                          ${existingTips.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 mt-1 border-t border-gray-200 flex justify-between items-center">
                      <span className="font-bold text-gray-900">
                        Balance Due
                      </span>
                      <span
                        className={`text-lg font-bold ${balanceDue <= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {balanceDue <= 0
                          ? "✓ Paid"
                          : `$${balanceDue.toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tip */}
              {!sent && currentPaymentStatus !== "paid" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Add Tip (Optional)
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-lg font-semibold">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0.00"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    />
                  </div>
                  {parsedTip > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Tip of ${parsedTip.toFixed(2)} will be added to the
                      invoice
                    </p>
                  )}
                  {(parsedTip > 0 || paidToDate > 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="font-bold text-gray-900">
                        Invoice Amount
                      </span>
                      <span className="text-lg font-bold text-blue-600">
                        ${invoiceAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Active Payment Link Display */}
              {(() => {
                const activePaymentLink =
                  paymentStatus?.activePayment?.payment_url ||
                  paymentLink ||
                  venmoLink;
                const activePaymentProvider =
                  paymentStatus?.activePayment?.provider ||
                  (paymentLink ? "square" : venmoLink ? "venmo" : null);

                if (!activePaymentLink) return null;

                return (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 size={16} className="text-green-600" />
                      <p className="text-sm font-bold text-green-900">
                        Payment Link Available
                      </p>
                    </div>
                    <p className="text-xs text-green-700 mb-3">
                      Share this link with the passenger to complete payment via{" "}
                      {activePaymentProvider === "venmo"
                        ? "Venmo"
                        : activePaymentProvider === "zelle"
                          ? "Zelle"
                          : "Square"}
                    </p>
                    <div className="flex items-center gap-2 p-3 bg-white border border-green-200 rounded-lg">
                      <input
                        type="text"
                        value={activePaymentLink}
                        readOnly
                        className="flex-1 text-xs text-green-800 bg-transparent outline-none font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activePaymentLink);
                          toast.success("Payment link copied!");
                        }}
                        className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                      <a
                        href={activePaymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-600 hover:bg-green-100 rounded transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Payment Method Selector */}
              {!sent && currentPaymentStatus !== "paid" && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Payment Method
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const isSelected = paymentMethod === m.value;
                      return (
                        <button
                          key={m.value}
                          onClick={() => setPaymentMethod(m.value)}
                          className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Venmo Payment Integration */}
                  {paymentMethod === "Venmo" && venmoConfigured && (
                    <div className="mt-4 space-y-3">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard size={16} className="text-blue-600" />
                          <p className="text-sm font-semibold text-blue-800">
                            Venmo Payment
                          </p>
                        </div>
                        <p className="text-xs text-blue-600 mb-3">
                          Generate a Venmo payment link to send to the
                          passenger. They can pay via Venmo app or web.
                        </p>

                        {!venmoLink && !venmoPaymentStatus?.payment_url ? (
                          <button
                            onClick={() => generateVenmoLinkMutation.mutate()}
                            disabled={generatingVenmoLink}
                            className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {generatingVenmoLink ? (
                              <>
                                <Loader2 size={15} className="animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Link2 size={15} />
                                Generate Venmo Link
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-3 bg-white border border-blue-200 rounded-lg">
                              <input
                                type="text"
                                value={
                                  venmoPaymentStatus?.payment_url || venmoLink
                                }
                                readOnly
                                className="flex-1 text-xs text-blue-800 bg-transparent outline-none font-mono"
                              />
                              <button
                                onClick={copyVenmoLink}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={
                                  venmoPaymentStatus?.payment_url || venmoLink
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"
                              >
                                <ExternalLink size={12} />
                                Open Venmo (Web)
                              </a>
                              {venmoPaymentStatus?.venmo_app_url && (
                                <>
                                  <span className="text-xs text-gray-400">
                                    •
                                  </span>
                                  <a
                                    href={venmoPaymentStatus.venmo_app_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"
                                  >
                                    <ExternalLink size={12} />
                                    Open Venmo App
                                  </a>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-blue-600">
                              Send to:{" "}
                              <span className="font-semibold">
                                @{venmoHandle?.replace(/^@/, "")}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {paymentMethod === "Venmo" && !venmoConfigured && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <AlertTriangle
                        size={16}
                        className="text-amber-600 mb-2"
                      />
                      <p className="text-xs text-amber-700">
                        Venmo is not configured. Please enable Venmo and add
                        your Venmo handle in Settings to use Venmo payments.
                      </p>
                    </div>
                  )}

                  {/* Square Invoice section */}
                  {paymentMethod === "Square Invoice" && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <CreditCard size={16} className="text-blue-600" />
                        <p className="text-sm font-semibold text-blue-800">
                          Square Invoice
                        </p>
                      </div>
                      <p className="text-xs text-blue-600 mb-3">
                        When "Send Invoice" is clicked, the passenger will
                        receive a Square Invoice by email with a payment link.
                        Payment will be automatically detected via webhook.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Success state */}
              {sent && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                  <CheckCircle2
                    size={32}
                    className="text-green-500 mx-auto mb-2"
                  />
                  <p className="font-semibold text-green-800 text-sm">
                    Invoice sent!
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {booking?.client_email
                      ? `Sent to ${booking.client_email}${booking.client_phone ? " + SMS" : ""}`
                      : booking?.client_phone
                        ? `Sent via SMS to ${booking.client_phone}`
                        : "Notification sent"}
                  </p>
                </div>
              )}

              {/* Paid Status */}
              {currentPaymentStatus === "paid" && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
                  <CheckCircle2
                    size={32}
                    className="text-green-500 mx-auto mb-2"
                  />
                  <p className="font-semibold text-green-800 text-sm">
                    Payment Received
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Paid $
                    {Number(paymentStatus?.trip?.payment_amount || 0).toFixed(
                      2,
                    )}{" "}
                    via {paymentStatus?.trip?.payment_method || "payment"}
                  </p>
                  {paymentStatus?.trip?.payment_date && (
                    <p className="text-xs text-green-500 mt-1">
                      {new Date(
                        paymentStatus.trip.payment_date,
                      ).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-white border-t border-gray-200 px-5 py-4 shrink-0 flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sent ? "Close" : "Cancel"}
          </button>
          <div className="flex-1" />
          {!sent && currentPaymentStatus !== "paid" && (
            <>
              <a
                href={`/booking/${tripId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ExternalLink size={13} />
                Preview
              </a>
              <button
                onClick={() => sendInvoiceMutation.mutate()}
                disabled={
                  sendInvoiceMutation.isPending ||
                  !paymentMethod ||
                  (!booking?.client_email && !booking?.client_phone)
                }
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {sendInvoiceMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    Send Invoice
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Warning if no contact info at all */}
        {booking && !booking.client_email && !booking.client_phone && !sent && (
          <div className="bg-amber-50 border-t border-amber-200 px-5 py-3 shrink-0 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">
              This passenger has no email or phone on file. Add contact info to
              their profile before sending.
            </p>
          </div>
        )}
        {/* Info: SMS-only preference */}
        {booking && !booking.client_email && booking.client_phone && !sent && (
          <div className="bg-blue-50 border-t border-blue-200 px-5 py-3 shrink-0 flex items-center gap-2">
            <Send size={14} className="text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700">
              No email on file — invoice will be sent via SMS to{" "}
              {booking.client_phone}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
