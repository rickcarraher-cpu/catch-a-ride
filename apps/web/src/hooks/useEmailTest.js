import { useState } from "react";
import { toast } from "sonner";

export function useEmailTest() {
  const [testEmail, setTestEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const handleSendTestEmail = async (defaultEmail) => {
    setSendingTestEmail(true);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail || defaultEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast.success(data.message || "Test email sent!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingTestEmail(false);
    }
  };

  return { testEmail, setTestEmail, sendingTestEmail, handleSendTestEmail };
}
