import { Tabs, useRouter } from "expo-router";
import { CalendarClock, ListTodo, DollarSign } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import useAuth from "@/utils/auth/useAuth";

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, isReady } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isReady) {
      checkAdminAccess();
    }
  }, [isReady]);

  const checkAdminAccess = () => {
    if (!auth?.user || !auth?.passwordVerified) {
      router.replace("/login");
      return;
    }
    if (!auth.user.isAdmin) {
      // Non-admin trying to access tabs - redirect to driver report
      router.replace("/driver-report");
      return;
    }
    setChecking(false);
  };

  // Don't render tabs until we verify admin access
  if (
    !isReady ||
    checking ||
    !auth?.user ||
    !auth?.passwordVerified ||
    !auth.user.isAdmin
  ) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0F1E",
          borderTopColor: "#1E293B",
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: "#60A5FA",
        tabBarInactiveTintColor: "#334155",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "TODAY",
          tabBarIcon: ({ color, size }) => <ListTodo color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "UPCOMING",
          tabBarIcon: ({ color, size }) => (
            <CalendarClock color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "EARNINGS",
          tabBarIcon: ({ color, size }) => (
            <DollarSign color={color} size={20} />
          ),
        }}
      />
    </Tabs>
  );
}
