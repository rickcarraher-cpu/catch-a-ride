import { X, CheckCircle, XCircle, Mail, MessageSquare } from "lucide-react";

export function ConfirmationStatusModal({ isOpen, onClose, status }) {
  if (!isOpen || !status) return null;

  const getStatusIcon = (sent) => {
    return sent ? (
      <CheckCircle className="text-green-600" size={18} />
    ) : (
      <XCircle className="text-gray-400" size={18} />
    );
  };

  const getStatusText = (sent) => {
    return sent ? "Sent" : "Not Sent";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Confirmation Status</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-6">
            The following confirmations have been sent:
          </p>

          {/* Passenger Section */}
          {status.passenger && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">P</span>
                </div>
                <h4 className="font-semibold text-gray-900">Passenger</h4>
              </div>
              <div className="ml-10 space-y-2">
                {/* Email Status */}
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.passenger.email)}
                    <span
                      className={`text-sm font-medium ${
                        status.passenger.email
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {getStatusText(status.passenger.email)}
                    </span>
                  </div>
                </div>
                {/* SMS Status */}
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Text</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.passenger.sms)}
                    <span
                      className={`text-sm font-medium ${
                        status.passenger.sms
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {getStatusText(status.passenger.sms)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Driver Section */}
          {status.driver && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-semibold text-sm">
                    D
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900">Driver</h4>
              </div>
              <div className="ml-10 space-y-2">
                {/* Email Status */}
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.driver.email)}
                    <span
                      className={`text-sm font-medium ${
                        status.driver.email ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {getStatusText(status.driver.email)}
                    </span>
                  </div>
                </div>
                {/* SMS Status */}
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Text</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.driver.sms)}
                    <span
                      className={`text-sm font-medium ${
                        status.driver.sms ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {getStatusText(status.driver.sms)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dispatch Section */}
          {status.dispatch && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-semibold text-sm">
                    A
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900">Dispatch</h4>
              </div>
              <div className="ml-10 space-y-2">
                {/* Email Status */}
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.dispatch.email)}
                    <span
                      className={`text-sm font-medium ${
                        status.dispatch.email
                          ? "text-green-600"
                          : "text-gray-500"
                      }`}
                    >
                      {getStatusText(status.dispatch.email)}
                    </span>
                  </div>
                </div>
                {/* SMS Status */}
                <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-gray-500" />
                    <span className="text-sm text-gray-700">Text</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(status.dispatch.sms)}
                    <span
                      className={`text-sm font-medium ${
                        status.dispatch.sms ? "text-green-600" : "text-gray-500"
                      }`}
                    >
                      {getStatusText(status.dispatch.sms)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
