import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  KeyRound,
  CheckCircle,
  Mail,
  MessageSquare,
} from "lucide-react-native";

export default function ResetPasswordScreen() {
  const [step, setStep] = useState(1); // 1=email, 2=verify code, 3=new password
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // Pre-fill email if provided via query params
  useEffect(() => {
    if (params.email) {
      setEmail(params.email);
    }
  }, [params.email]);

  // Step 1: Send reset code via SMS
  const handleSendCode = async () => {
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/send-driver-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send verification code");
        setLoading(false);
        return;
      }

      setMaskedPhone(data.maskedPhone || "your phone");
      setStep(2);
      setLoading(false);
    } catch (error) {
      console.error("Send code error:", error);
      setError("Failed to send verification code. Please try again.");
      setLoading(false);
    }
  };

  // Step 2: Verify SMS code
  const handleVerifyCode = async () => {
    setError("");

    if (!code.trim()) {
      setError("Please enter the verification code");
      return;
    }

    if (code.trim().length !== 4) {
      setError("Verification code must be 4 digits");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Invalid verification code");
        setLoading(false);
        return;
      }

      setResetToken(data.resetToken);
      setStep(3);
      setLoading(false);
    } catch (error) {
      console.error("Verify code error:", error);
      setError("Failed to verify code. Please try again.");
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleSetNewPassword = async () => {
    setError("");

    const pw1 = (newPassword || "").trim();
    const pw2 = (confirmPassword || "").trim();

    if (!pw1) {
      setError("Please enter a new password");
      return;
    }
    if (!pw2) {
      setError("Please confirm your new password");
      return;
    }
    if (pw1 !== pw2) {
      setError("Passwords do not match — please retype both carefully");
      return;
    }
    if (pw1.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/set-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password: pw1,
          resetToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password. Please try again.");
        setLoading(false);
        return;
      }

      setShowSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error("Reset password error:", err);
      setError("Failed to reset password. Please try again.");
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setCode("");
    setError("");
    await handleSendCode();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}
        >
          {/* Header */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "#3B82F6",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              {step === 1 ? (
                <Mail size={40} color="#FFFFFF" />
              ) : step === 2 ? (
                <MessageSquare size={40} color="#FFFFFF" />
              ) : (
                <KeyRound size={40} color="#FFFFFF" />
              )}
            </View>
            <Text
              style={{
                fontSize: 32,
                fontWeight: "bold",
                color: "#FFFFFF",
                marginBottom: 8,
              }}
            >
              {step === 1
                ? "Forgot Password?"
                : step === 2
                  ? "Verify Code"
                  : "New Password"}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: "#94A3B8",
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              {step === 1
                ? "Enter your email to receive a verification code"
                : step === 2
                  ? `Enter the 4-digit code sent to ${maskedPhone}`
                  : "Enter your new password"}
            </Text>
          </View>

          {/* Step 1: Email Entry */}
          {step === 1 && (
            <View style={{ gap: 16 }}>
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#E2E8F0",
                    marginBottom: 8,
                  }}
                >
                  Email Address
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#1E293B",
                    borderWidth: 1,
                    borderColor: error ? "#EF4444" : "#334155",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    color: "#FFFFFF",
                  }}
                  placeholder="your@email.com"
                  placeholderTextColor="#64748B"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleSendCode}
                  editable={!loading}
                />
              </View>

              {error && (
                <View
                  style={{
                    backgroundColor: "#7F1D1D",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <Text style={{ color: "#FCA5A5", fontSize: 14 }}>
                    {error}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: loading ? "#64748B" : "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
                onPress={handleSendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    Send Code
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ alignItems: "center" }}
                onPress={() => router.replace("/login")}
                disabled={loading}
              >
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>
                  Back to Login
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Verify Code */}
          {step === 2 && (
            <View style={{ gap: 16 }}>
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#E2E8F0",
                    marginBottom: 8,
                  }}
                >
                  Verification Code
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#1E293B",
                    borderWidth: 1,
                    borderColor: error ? "#EF4444" : "#334155",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 24,
                    color: "#FFFFFF",
                    textAlign: "center",
                    letterSpacing: 8,
                  }}
                  placeholder="0000"
                  placeholderTextColor="#64748B"
                  value={code}
                  onChangeText={(text) => {
                    // Only allow digits
                    const cleaned = text.replace(/[^0-9]/g, "");
                    setCode(cleaned.slice(0, 4));
                    if (error) setError("");
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  returnKeyType="go"
                  onSubmitEditing={handleVerifyCode}
                  editable={!loading}
                />
              </View>

              {error && (
                <View
                  style={{
                    backgroundColor: "#7F1D1D",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <Text style={{ color: "#FCA5A5", fontSize: 14 }}>
                    {error}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: loading ? "#64748B" : "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
                onPress={handleVerifyCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    Verify Code
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ alignItems: "center" }}
                onPress={handleResendCode}
                disabled={loading}
              >
                <Text
                  style={{ color: "#3B82F6", fontSize: 14, fontWeight: "600" }}
                >
                  Resend Code
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ alignItems: "center", marginTop: 8 }}
                onPress={() => {
                  setStep(1);
                  setCode("");
                  setError("");
                }}
                disabled={loading}
              >
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <View style={{ gap: 16 }}>
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#E2E8F0",
                    marginBottom: 8,
                  }}
                >
                  New Password
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#1E293B",
                    borderWidth: 1,
                    borderColor: error ? "#EF4444" : "#334155",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    color: "#FFFFFF",
                  }}
                  placeholder="Enter new password"
                  placeholderTextColor="#64748B"
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (error) setError("");
                  }}
                  secureTextEntry={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  editable={!loading}
                />
              </View>

              <View>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: "#E2E8F0",
                    marginBottom: 8,
                  }}
                >
                  Confirm Password
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#1E293B",
                    borderWidth: 1,
                    borderColor: error ? "#EF4444" : "#334155",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    color: "#FFFFFF",
                  }}
                  placeholder="Confirm new password"
                  placeholderTextColor="#64748B"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (error) setError("");
                  }}
                  secureTextEntry={true}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleSetNewPassword}
                  editable={!loading}
                />
              </View>

              {error && (
                <View
                  style={{
                    backgroundColor: "#7F1D1D",
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <Text style={{ color: "#FCA5A5", fontSize: 14 }}>
                    {error}
                  </Text>
                </View>
              )}

              {/* Step 3 submit button */}
              <TouchableOpacity
                onPress={handleSetNewPassword}
                disabled={loading}
                style={{
                  backgroundColor: loading ? "#64748B" : "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    Reset Password
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ alignItems: "center" }}
                onPress={() => router.replace("/login")}
                disabled={loading}
              >
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>
                  Back to Login
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 24,
              padding: 32,
              alignItems: "center",
              width: "100%",
              maxWidth: 400,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: "#10B981",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <CheckCircle size={48} color="#FFFFFF" />
            </View>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "bold",
                color: "#FFFFFF",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Password Reset!
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: "#94A3B8",
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              You can now sign in with your new password
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
