import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import useAuth from "@/utils/auth/useAuth";

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [requireLogin, setRequireLogin] = useState(true);
  const { isReady, auth, initiate } = useAuth();

  useEffect(() => {
    // Initialize the auth system
    initiate();
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      checkSettings();
    }
  }, [isReady]);

  const checkSettings = async () => {
    try {
      // Check if login is required from settings
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/settings`,
      );
      if (res.ok) {
        const settings = await res.json();
        // Default to requiring login if setting is not found or is "yes"
        const loginRequired = settings?.require_login !== "no";
        setRequireLogin(loginRequired);
      }
    } catch (error) {
      console.error("Error checking settings:", error);
      // On error, default to requiring login
      setRequireLogin(true);
    } finally {
      setChecking(false);
    }
  };

  if (!isReady || checking) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0F172A",
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ color: "#94A3B8", marginTop: 16, fontSize: 14 }}>
          Loading...
        </Text>
      </View>
    );
  }

  // If login is not required, go directly to today screen
  if (!requireLogin) {
    return <Redirect href="/(tabs)/today" />;
  }

  // Not logged in OR session was created before password requirement — go to login
  if (!auth?.user || !auth?.passwordVerified) {
    return <Redirect href="/login" />;
  }

  // Route based on role
  if (auth.user.isAdmin && auth.user.isDriver) {
    return <Redirect href="/driver-choice" />;
  }
  if (auth.user.isAdmin) {
    return <Redirect href="/(tabs)/today" />;
  }
  // Driver only
  return <Redirect href="/(tabs)/schedule" />;
}
