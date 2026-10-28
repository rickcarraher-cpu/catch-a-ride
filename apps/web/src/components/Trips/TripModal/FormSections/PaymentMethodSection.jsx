import { CreditCard } from "lucide-react";

const PAYMENT_METHODS = [
  { value: "", label: "Not specified" },
  { value: "Cash", label: "Cash" },
  { value: "Farm", label: "Farm" },
  { value: "Square Invoice", label: "Square Invoice" },
  { value: "Venmo", label: "Venmo" },
  { value: "Zelle", label: "Zelle" },
  { value: "Comp", label: "🎁 Comp" },
  { value: "Other", label: "Other" },
];

const HINTS = {
  "Square Invoice": {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    message:
      "A Square Invoice will be automatically created and sent when you save.",
  },
  Venmo: {
    bg: "bg-purple-50 border-purple-200",
    text: "text-purple-700",
    message:
      "A Venmo payment request link will be generated automatically when you save.",
  },
  Zelle: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-700",
    message: "Passenger will receive Zelle payment instructions after saving.",
  },
  Comp: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    message:
      "Trip will be marked as fully paid at no charge to the passenger. Driver still earns their full commission.",
  },
};

export function PaymentMethodSection({ formData, setFormData }) {
  const hint = HINTS[formData.payment_method];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CreditCard size={18} className="text-gray-400" />
        <label className="text-sm font-semibold text-gray-700">
          Payment Method
        </label>
      </div>

      <select
        value={formData.payment_method || ""}
        onChange={(e) =>
          setFormData({ ...formData, payment_method: e.target.value })
        }
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
      >
        {PAYMENT_METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {hint && (
        <div className={`border rounded-lg p-3 ${hint.bg}`}>
          <p className={`text-xs font-medium ${hint.text}`}>✓ {hint.message}</p>
        </div>
      )}
    </div>
  );
}
