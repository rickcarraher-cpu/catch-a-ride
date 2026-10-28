import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useAuth from "@/utils/auth/useAuth";

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1=email, 2=password, 3=role choice
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [employee, setEmployee] = useState(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuth();

  // Step 1: Email lookup
  const handleEmailSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/check-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Store employee info and move to password step
      setEmployee(data.employee);
      setHasPassword(data.hasPassword);
      setStep(2);
      setLoading(false);
    } catch (err) {
      console.error("Email check error:", err);
      setError("Failed to check email. Please try again.");
      setLoading(false);
    }
  };

  // Step 2a: Create new password (first-time)
  const handleCreatePassword = async () => {
    if (!password.trim() || !confirmPassword.trim()) {
      setError("Please enter and confirm your password");
      return;
    }

    if (password !== confirmPassword || password.length < 6) {
      setError("Passwords do not match or are not valid. Try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/set-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          password: password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create password");
        setLoading(false);
        return;
      }

      // Password created - now authenticate
      await authenticateUser(data.employee);
    } catch (err) {
      console.error("Create password error:", err);
      setError("Failed to create password. Please try again.");
      setLoading(false);
    }
  };

  // Step 2b: Validate existing password
  const handleValidatePassword = async () => {
    if (!password.trim()) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid password");
        setLoading(false);
        return;
      }

      // Password validated - now authenticate
      await authenticateUser(data.employee);
    } catch (err) {
      console.error("Validate password error:", err);
      setError("Failed to verify password. Please try again.");
      setLoading(false);
    }
  };

  // Authenticate user and handle role routing
  const authenticateUser = async (employeeData) => {
    try {
      // Sync with auth system
      const authRes = await fetch("/api/auth/driver-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeData.id }),
      });

      const authData = await authRes.json();

      if (!authRes.ok) {
        setError(authData.error || "Authentication failed");
        setLoading(false);
        return;
      }

      // Check for neither admin nor driver
      if (!employeeData.isAdmin && !employeeData.isDriver) {
        setError(
          "This account has no portal assigned. Contact an administrator.",
        );
        setLoading(false);
        return;
      }

      // Store auth in secure storage
      await setAuth({
        passwordVerified: true, // Only set after completing password step
        user: {
          id: employeeData.id,
          name: employeeData.name,
          email: employeeData.email,
          isAdmin: employeeData.isAdmin,
          isDriver: employeeData.isDriver,
        },
        internalPassword: authData.internalPassword,
      });

      // If both admin and driver, show choice screen
      if (employeeData.isAdmin && employeeData.isDriver) {
        setLoading(false);
        router.replace("/driver-choice");
      }
      // If admin only, go to admin dashboard
      else if (employeeData.isAdmin) {
        setLoading(false);
        router.replace("/(tabs)/today");
      }
      // If driver only, go to driver portal
      else if (employeeData.isDriver) {
        setLoading(false);
        router.replace("/(tabs)/schedule");
      }
    } catch (err) {
      console.error("Authentication error:", err);
      setError("Failed to sign in. Please try again.");
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep(1);
    setPassword("");
    setConfirmPassword("");
    setEmployee(null);
    setHasPassword(false);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Title */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: "#3B82F6",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 32 }}>🚗</Text>
          </View>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "bold",
              color: "#FFFFFF",
              marginBottom: 8,
            }}
          >
            {step === 1 ? "Sign In" : employee?.name || "Sign In"}
          </Text>
          <Text style={{ fontSize: 15, color: "#94A3B8", textAlign: "center" }}>
            {step === 1
              ? "Enter your email to sign in"
              : !hasPassword
                ? "No password on file. Enter a new password."
                : "Enter password"}
          </Text>
        </View>

        {/* Form */}
        <View
          style={{
            backgroundColor: "#1E293B",
            borderRadius: 20,
            padding: 24,
            gap: 16,
          }}
        >
          {/* Step 1: Email Entry */}
          {step === 1 && (
            <>
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Email Address
                </Text>
                <TextInput
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError(null);
                  }}
                  placeholder="your@email.com"
                  placeholderTextColor="#475569"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="go"
                  onSubmitEditing={handleEmailSubmit}
                  style={{
                    backgroundColor: "#0F172A",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    color: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: error ? "#EF4444" : "#334155",
                  }}
                />
              </View>

              {error && (
                <View
                  style={{
                    backgroundColor: "#450A0A",
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#7F1D1D",
                  }}
                >
                  <Text
                    style={{
                      color: "#FCA5A5",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleEmailSubmit}
                disabled={loading}
                style={{
                  backgroundColor: loading ? "#1D4ED8" : "#3B82F6",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                  opacity: loading ? 0.7 : 1,
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Continue
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Step 2a: Create New Password (First-time) */}
          {step === 2 && !hasPassword && (
            <>
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  New Password
                </Text>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError(null);
                  }}
                  placeholder="Enter new password"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  style={{
                    backgroundColor: "#0F172A",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    color: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: error ? "#EF4444" : "#334155",
                  }}
                />
              </View>

              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Confirm Password
                </Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (error) setError(null);
                  }}
                  placeholder="Enter again to confirm"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleCreatePassword}
                  style={{
                    backgroundColor: "#0F172A",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    color: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: error ? "#EF4444" : "#334155",
                  }}
                />
              </View>

              {error && (
                <View
                  style={{
                    backgroundColor: "#450A0A",
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#7F1D1D",
                  }}
                >
                  <Text
                    style={{
                      color: "#FCA5A5",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleCreatePassword}
                disabled={loading}
                style={{
                  backgroundColor: loading ? "#1D4ED8" : "#3B82F6",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                  opacity: loading ? 0.7 : 1,
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Create Password
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBackToEmail}
                disabled={loading}
                style={{ alignItems: "center", marginTop: 8 }}
              >
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>
                  Back to Email
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 2b: Validate Existing Password */}
          {step === 2 && hasPassword && (
            <>
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Password
                </Text>
                <TextInput
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError(null);
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleValidatePassword}
                  style={{
                    backgroundColor: "#0F172A",
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    color: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: error ? "#EF4444" : "#334155",
                  }}
                />
              </View>

              {error && (
                <View
                  style={{
                    backgroundColor: "#450A0A",
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#7F1D1D",
                  }}
                >
                  <Text
                    style={{
                      color: "#FCA5A5",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    {error}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleValidatePassword}
                disabled={loading}
                style={{
                  backgroundColor: loading ? "#1D4ED8" : "#3B82F6",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                  opacity: loading ? 0.7 : 1,
                  marginTop: 4,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/reset-password",
                    params: { email: employee.email },
                  })
                }
                disabled={loading}
                style={{ alignItems: "center", marginTop: 8 }}
              >
                <Text
                  style={{ color: "#3B82F6", fontSize: 14, fontWeight: "600" }}
                >
                  Forgot Password?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBackToEmail}
                disabled={loading}
                style={{ alignItems: "center", marginTop: 8 }}
              >
                <Text style={{ color: "#94A3B8", fontSize: 14 }}>
                  Back to Email
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
