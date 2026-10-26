import { useState } from "react";
import { toast } from "sonner";

export function useSmsTest() {
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const handleSendTestSms = async () => {
    setSendingTest(true);
    try {
      const res = await fetch("/api/sms/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast.success(data.message || "Test SMS sent!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingTest(false);
    }
  };

  return { testPhone, setTestPhone, sendingTest, handleSendTestSms };
}
