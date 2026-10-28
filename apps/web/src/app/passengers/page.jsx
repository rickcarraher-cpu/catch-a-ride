"use client";

import React, { useState, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Mail,
  Phone,
  History,
  Trash2,
  XCircle,
  FileText,
  Bell,
  MapPin,
  MessageSquare,
  CheckCircle,
  XOctagon,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { PageWithBackButton } from "@/components/PageWithBackButton";

const NOTIF_OPTIONS = [
  { value: "email", label: "Email", emoji: "📧" },
  { value: "sms", label: "Text", emoji: "💬" },
  { value: "both", label: "Both", emoji: "📧💬" },
  { value: "none", label: "None", emoji: "🔕" },
];

function NotifBadge({ pref }) {
  const map = {
    email: {
      label: "Email",
      color: "bg-purple-50 text-purple-700 border-purple-100",
    },
    sms: {
      label: "Text",
      color: "bg-green-50 text-green-700 border-green-100",
    },
    both: { label: "Both", color: "bg-blue-50 text-blue-700 border-blue-100" },
    none: { label: "None", color: "bg-gray-50 text-gray-500 border-gray-200" },
  };
  const opt = map[pref] || map["both"];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${opt.color}`}
    >
      <Bell size={10} />
      {opt.label}
    </span>
  );
}

export default function PassengersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState(null);
  const [showBookingPrompt, setShowBookingPrompt] = useState(false);
  const [newlyCreatedClient, setNewlyCreatedClient] = useState(null);
  const [isBookingWizardOpen, setIsBookingWizardOpen] = useState(false);

  const {
    data: clients,
    isLoading,
    error: clientsError,
  } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("UNAUTHORIZED");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load passengers");
      }
      return res.json();
    },
    retry: (failureCount, error) => {
      if (error?.message === "UNAUTHORIZED") return false;
      return failureCount < 2;
    },
  });

  // Redirect to sign-in if auth has expired
  React.useEffect(() => {
    if (
      clientsError?.message === "UNAUTHORIZED" &&
      typeof window !== "undefined"
    ) {
      window.location.href =
        "/account/signin?callbackUrl=" +
        encodeURIComponent(window.location.pathname);
    }
  }, [clientsError]);

  // Fetch drivers and services for booking wizard
  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: () => fetch("/api/services").then((r) => r.json()),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error("Failed to update passenger status");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(["clients"]);
      toast.success(
        data.is_active ? "Passenger activated" : "Passenger inactivated",
      );
    },
  });

  const filteredClients = clients?.filter((c) => {
    // Always filter out inactive passengers
    if (c.is_active === false) return false;
    // Filter by search
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(search) ||
      c.street_address?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.state?.toLowerCase().includes(q) ||
      c.zip_code?.includes(search) ||
      c.address?.toLowerCase().includes(q)
    );
  });

  const activeCount = clients?.filter((c) => c.is_active !== false).length || 0;
  const inactiveCount =
    clients?.filter((c) => c.is_active === false).length || 0;

  return (
    <PageWithBackButton>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Passengers
              </h1>
              {!isLoading && clients && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-50 text-green-700 border border-green-100">
                    {activeCount} Active
                  </span>
                  {inactiveCount > 0 && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200">
                      {inactiveCount} Inactive
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-gray-500 mt-1">
              Manage your customer database and trip history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Navigate to trips page to create a new trip using the admin TripModal
                window.location.href = "/trips?new=true";
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus size={18} />
              Add A New Trip
            </button>
            <button
              onClick={() => {
                setEditingClient(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              New Passenger
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name, email, phone, or address..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
                  Passenger
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
                  Contact
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
                  Notify Via
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
                  Notes
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Loading state */}
              {isLoading && (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    Loading passengers...
                  </td>
                </tr>
              )}

              {/* Auth/API error state */}
              {!isLoading &&
                clientsError &&
                clientsError.message !== "UNAUTHORIZED" && (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Failed to load passengers
                    </td>
                  </tr>
                )}

              {/* No passengers found */}
              {!isLoading && !clientsError && filteredClients?.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No passengers found.
                  </td>
                </tr>
              )}

              {filteredClients?.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => {
                    setEditingClient(client);
                    setIsModalOpen(true);
                  }}
                  className={`hover:bg-gray-50 transition-colors group cursor-pointer ${
                    client.is_active === false ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-semibold text-xs border border-blue-100">
                        {client.name.charAt(0)}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {client.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Mail size={12} className="text-gray-400" />
                        {client.email || "N/A"}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        {client.phone || "N/A"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <NotifBadge
                      pref={client.notification_preference || "both"}
                    />
                  </td>
                  <td className="px-6 py-4">
                    {client.is_active === false ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-50 text-gray-600 border-gray-200">
                        <XOctagon size={10} />
                        Inactive
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-100">
                        <CheckCircle size={10} />
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-gray-500 line-clamp-1 max-w-[200px]">
                      {client.notes || "-"}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isSmsModalOpen && smsRecipient && (
        <SmsModal
          recipient={smsRecipient}
          onClose={() => {
            setIsSmsModalOpen(false);
            setSmsRecipient(null);
          }}
        />
      )}

      {isModalOpen && (
        <PassengerModal
          client={editingClient}
          onClose={() => {
            setIsModalOpen(false);
            setEditingClient(null);
          }}
          onSuccess={(createdClient) => {
            queryClient.invalidateQueries(["clients"]);
            queryClient.refetchQueries(["clients"]);

            // If this was a new passenger (not editing), show booking prompt
            if (!editingClient && createdClient) {
              setNewlyCreatedClient(createdClient);
              setShowBookingPrompt(true);
              setIsModalOpen(false);
              setEditingClient(null);
            } else {
              // Editing existing passenger - just close
              setIsModalOpen(false);
              setEditingClient(null);
            }
          }}
        />
      )}

      {/* Book a Trip Now? Prompt */}
      {showBookingPrompt && newlyCreatedClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-500 flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Passenger Added!
                </h2>
                <p className="text-gray-500 mt-2">
                  {newlyCreatedClient.name} has been added to your database.
                </p>
              </div>
              <div className="pt-2">
                <p className="text-lg font-semibold text-gray-900">
                  Book a trip now?
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowBookingPrompt(false);
                  setNewlyCreatedClient(null);
                }}
                className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
              >
                No, Go to Dashboard
              </button>
              <button
                onClick={() => {
                  // Navigate to trips page and open trip modal with this passenger pre-selected
                  window.location.href = `/trips?client_id=${newlyCreatedClient.id}&open_modal=true`;
                }}
                className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Yes, Book a Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWithBackButton>
  );
}

function SmsModal({ recipient, onClose }) {
  const [message, setMessage] = useState("");
  const maxChars = 160;

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/sms/send-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send SMS");
      return json;
    },
    onSuccess: () => {
      toast.success("SMS sent successfully!");
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send SMS");
    },
  });

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    mutation.mutate({
      phone: recipient.phone,
      message: message.trim(),
    });
  };

  const charsRemaining = maxChars - message.length;
  const isOverLimit = charsRemaining < 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare size={20} className="text-green-600" />
              Send SMS
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              To: {recipient.name} ({recipient.phone})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Message
              </label>
              <span
                className={`text-xs font-medium ${
                  isOverLimit
                    ? "text-red-600"
                    : charsRemaining < 20
                      ? "text-amber-600"
                      : "text-gray-400"
                }`}
              >
                {charsRemaining} chars remaining
              </span>
            </div>
            <textarea
              className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-green-600 min-h-[120px] ${
                isOverLimit ? "border-red-300" : "border-gray-200"
              }`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              autoFocus
            />
            <p className="text-[11px] text-gray-400">
              💬 Standard SMS rates apply. Keep it under 160 characters for best
              delivery.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={mutation.isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={mutation.isLoading || !message.trim() || isOverLimit}
            className="px-6 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {mutation.isLoading ? (
              <>Sending...</>
            ) : (
              <>
                <MessageSquare size={16} />
                Send SMS
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const CITY_ZIP_MAP = {
  hendersonville: "37075",
  gallatin: "37066",
  whitehouse: "37188",
  "white house": "37188",
  goodlettsville: "37072",
  goodletsville: "37072",
  portland: "37148",
  madison: "37155",
  springfield: "37172",
  greenbrier: "37073",
};

function PassengerModal({ client, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: client?.name || "",
    email: client?.email || "",
    phone: client?.phone || "",
    notes: client?.notes || "",
    notification_preference: client?.notification_preference || "both",
    street_address: client?.street_address || "",
    city: client?.city || "",
    state: client?.state || "",
    zip_code: client?.zip_code || "",
    is_active: client?.is_active !== false, // default to true
    referral_source: client?.referral_source || "",
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCannotDeleteModal, setShowCannotDeleteModal] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data) => {
      const url = client ? `/api/clients/${client.id}` : "/api/clients";
      const method = client ? "PATCH" : "POST";

      // When creating new passenger, don't send is_active (defaults to true in DB)
      const payload = client ? data : { ...data };
      if (!client) {
        delete payload.is_active;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save passenger");
      }

      return json;
    },
    onSuccess: (createdOrUpdatedClient) => {
      toast.success(client ? "Passenger updated" : "Passenger added");
      onSuccess(createdOrUpdatedClient);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save passenger");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // First check if passenger has trips
      const checkRes = await fetch(`/api/clients/${client.id}/appointments`);
      const trips = await checkRes.json();

      if (trips && trips.length > 0) {
        // Has trips - mark as inactive instead
        const res = await fetch(`/api/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: false }),
        });
        return { hasTrips: true, data: await res.json() };
      } else {
        // No trips - physically delete
        const res = await fetch(`/api/clients/${client.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete passenger");
        return { hasTrips: false, data: await res.json() };
      }
    },
    onSuccess: (result) => {
      setShowDeleteConfirm(false);
      if (result.hasTrips) {
        // Show cannot delete modal
        setShowCannotDeleteModal(true);
      } else {
        // Successfully deleted
        toast.success("Passenger deleted successfully");
        onSuccess();
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete passenger");
      setShowDeleteConfirm(false);
    },
  });

  const handleCityChange = (cityValue) => {
    const updates = { city: cityValue };
    const key = cityValue.trim().toLowerCase();
    if (CITY_ZIP_MAP[key]) {
      updates.state = "TN";
      updates.zip_code = CITY_ZIP_MAP[key];
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const needsPhone =
    (formData.notification_preference === "sms" ||
      formData.notification_preference === "both") &&
    !formData.phone.trim();
  const needsEmail =
    (formData.notification_preference === "email" ||
      formData.notification_preference === "both") &&
    !formData.email.trim();

  let validationMsg = "";
  if (needsPhone && needsEmail) {
    validationMsg =
      "Phone and email required for this notification preference.";
  } else if (needsPhone) {
    validationMsg = "Phone number required to send text notifications.";
  } else if (needsEmail) {
    validationMsg = "Email address required to send email notifications.";
  }

  const isSaveDisabled =
    mutation.isLoading || !formData.name || needsPhone || needsEmail;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {client ? "Edit Passenger" : "New Passenger"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Full Name *
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g. Jane Smith"
            />
          </div>

          {/* Delete Button - only show when editing existing passenger */}
          {client && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 size={16} />
                Delete Passenger
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                Remove this passenger from your database
              </p>
            </div>
          )}

          {/* Notification preference */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Bell size={12} /> Notification Preference
            </label>
            <div className="grid grid-cols-4 gap-2">
              {NOTIF_OPTIONS.map((opt) => {
                const selected = formData.notification_preference === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        notification_preference: opt.value,
                      })
                    }
                    className={`py-2 px-2 rounded-lg border text-center transition-all ${
                      selected
                        ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="text-base mb-0.5">{opt.emoji}</div>
                    <p
                      className={`text-[10px] font-semibold ${selected ? "text-blue-700" : "text-gray-500"}`}
                    >
                      {opt.label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {validationMsg && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              <Bell size={13} className="mt-0.5 shrink-0 text-amber-500" />
              <span>{validationMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {formData.notification_preference === "sms" ||
              formData.notification_preference === "both"
                ? "Phone Number *"
                : "Phone Number"}
            </label>
            <input
              type="tel"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="(555) 000-0000"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {formData.notification_preference === "email" ||
              formData.notification_preference === "both"
                ? "Email Address *"
                : "Email Address"}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="jane@example.com, spouse@example.com"
            />
            <p className="text-[11px] text-gray-400">
              Separate multiple emails with commas
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={12} /> Home Address
            </label>
            <div className="space-y-2">
              <input
                type="text"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.street_address}
                onChange={(e) =>
                  setFormData({ ...formData, street_address: e.target.value })
                }
                placeholder="Street address (e.g. 123 Main St)"
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                    value={formData.city}
                    onChange={(e) => handleCityChange(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    placeholder="State"
                    maxLength={2}
                  />
                </div>
              </div>
              <input
                type="text"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.zip_code}
                onChange={(e) =>
                  setFormData({ ...formData, zip_code: e.target.value })
                }
                placeholder="ZIP code"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Used as default pickup when booking a trip
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Notes
            </label>
            <textarea
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[80px]"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Frequent traveler, prefers front seat..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Referred By
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.referral_source}
              onChange={(e) =>
                setFormData({ ...formData, referral_source: e.target.value })
              }
              placeholder="Friend, Google, Facebook, etc."
            />
            <p className="text-[11px] text-gray-400">
              How did this passenger hear about you?
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate(formData)}
            disabled={isSaveDisabled}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {mutation.isLoading
              ? "Saving..."
              : client
                ? "Update Passenger"
                : "Add Passenger"}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-500 flex items-center justify-center mx-auto">
                <Trash2 size={32} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Delete Passenger?
                </h3>
                <p className="text-gray-500 mt-2">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-gray-900">
                    {client?.name}
                  </span>
                  ?
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isLoading}
                className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isLoading}
                className="px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {deleteMutation.isLoading ? (
                  "Deleting..."
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cannot Delete Modal - Passenger has trips */}
      {showCannotDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md">
            <div className="p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-400 flex items-center justify-center mx-auto">
                <History size={40} className="text-amber-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Can't Delete
                </h3>
                <p className="text-gray-600 mt-3 leading-relaxed">
                  This passenger has trips associated with this name.
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  The passenger has been marked as{" "}
                  <span className="font-semibold text-gray-700">inactive</span>{" "}
                  instead. They won't appear in new bookings, but their trip
                  history is preserved.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100">
              <button
                onClick={() => {
                  setShowCannotDeleteModal(false);
                  onSuccess();
                }}
                className="w-full px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
