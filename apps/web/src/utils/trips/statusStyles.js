export function getStatusStyles(status) {
  switch (status) {
    case "in-progress":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "tentative":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "quote":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "needs_review":
      return "bg-red-50 text-red-700 border-red-500";
    case "confirmed":
      return "bg-green-50 text-green-700 border-green-100";
    case "approved":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "unpaid":
      return "bg-yellow-50 text-yellow-700 border-yellow-100";
    case "paid":
      return "bg-purple-50 text-purple-700 border-purple-100";
    case "partial":
      return "bg-yellow-50 text-yellow-700 border-yellow-100";
    case "pending":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "completed":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "cancelled":
      return "bg-gray-50 text-gray-700 border-gray-100";
    case "no-show":
      return "bg-red-50 text-red-700 border-red-100";
    default:
      return "bg-gray-50 text-gray-700 border-gray-100";
  }
}
