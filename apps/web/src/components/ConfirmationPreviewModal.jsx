"use client";

import { useState, useEffect } from "react";
import { X, Mail, MessageSquare, Loader2, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function ConfirmationPreviewModal({ isOpen, onClose, tripId }) {
  const [activeTab, setActiveTab] = useState("email");

  // Reset to email tab when modal opens
  useEffect(() => {
    if (isOpen) setActiveTab("email");
  }, [isOpen]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["confirmation-preview", tripId],
    queryFn: async () => {
      const res = await fetch(
        `/api/appointments/${tripId}/preview-confirmation`,
      );
      if (!res.ok) throw new Error("Failed to load preview");
      return res.json();
    },
    enabled: isOpen && !!tripId,
    staleTime: 0,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <Eye size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Preview Confirmation
              </h2>
              <p className="text-xs text-gray-500">
                What the passenger will receive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-gray-200 shrink-0">
          <button
            onClick={() => setActiveTab("email")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === "email"
                ? "text-blue-600 border-blue-600 bg-blue-50"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <Mail size={14} />
            Email
          </button>
          <button
            onClick={() => setActiveTab("sms")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              activeTab === "sms"
                ? "text-blue-600 border-blue-600 bg-blue-50"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <MessageSquare size={14} />
            SMS
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-sm font-medium">Building preview...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
              <p className="text-red-600 font-medium text-sm">
                Failed to load preview
              </p>
              <p className="text-gray-400 text-xs">{error.message}</p>
            </div>
          )}

          {data && activeTab === "email" && (
            <iframe
              srcDoc={data.emailHtml}
              className="w-full h-full border-0"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          )}

          {data && activeTab === "sms" && (
            <div className="h-full overflow-y-auto p-6">
              {/* Phone mockup */}
              <div className="max-w-sm mx-auto">
                <div className="bg-gray-100 rounded-2xl p-1">
                  <div className="bg-white rounded-xl shadow-inner">
                    {/* SMS header bar */}
                    <div className="bg-gray-50 rounded-t-xl px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(data.app?.business_name || "C").charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900">
                          {data.app?.employee_name
                            ? `From: Dispatch`
                            : "Dispatch"}
                        </p>
                        <p className="text-[10px] text-gray-400">SMS Message</p>
                      </div>
                    </div>

                    {/* Bubble */}
                    <div className="p-4">
                      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                        <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                          {data.smsText}
                        </pre>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 text-right">
                        ~{Math.ceil(data.smsText?.length / 160)} segment
                        {Math.ceil(data.smsText?.length / 160) !== 1 ? "s" : ""}
                        {" · "}
                        {data.smsText?.length} chars
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
