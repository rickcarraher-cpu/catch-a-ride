/**
 * notify.js — drop-in replacement for `import { toast } from 'sonner'`
 *
 * Usage (identical to sonner):
 *   import { toast } from '@/utils/notify';
 *   toast.success("Saved!");
 *   toast.error("Something went wrong");
 *   toast.warning("Check your input");
 *   toast.info("FYI...");
 *   toast("Plain message");       // treated as info
 */

function dispatch(type, titleOrMsg, maybeMsg, opts = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("__sysMsg", {
      detail: {
        type,
        title: maybeMsg !== undefined ? titleOrMsg : null,
        message: maybeMsg !== undefined ? maybeMsg : titleOrMsg,
        opts,
      },
    }),
  );
}

function buildToast(defaultType) {
  return (msg, opts = {}) => {
    // sonner supports toast.success("msg", { description: "..." })
    // We treat description as a second line under the title
    if (opts && opts.description) {
      dispatch(defaultType, msg, opts.description, opts);
    } else {
      dispatch(defaultType, msg, undefined, opts);
    }
  };
}

export const toast = Object.assign(buildToast("info"), {
  success: buildToast("success"),
  error: buildToast("error"),
  warning: buildToast("warning"),
  info: buildToast("info"),
  // Stubs for sonner API compat — no-ops or forward to info
  loading: buildToast("info"),
  message: buildToast("info"),
  promise: () => {},
  dismiss: () => {},
  custom: (render, opts = {}) => {
    // For custom toasts we can't easily forward — just no-op
    console.warn("[notify] toast.custom() is not supported in modal mode");
  },
});

export default toast;
