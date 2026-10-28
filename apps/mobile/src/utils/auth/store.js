import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export const authKey = `${process.env.EXPO_PUBLIC_PROJECT_GROUP_ID}-jwt`;

/**
 * Explicit Keychain options used on every SecureStore call in the auth flow.
 *
 * - keychainService: pinned to a stable name so reads and writes always hit
 *   the same partition. Without this, SecureStore derives a service name from
 *   the bundle that can drift between Classic and EAS builds, causing reads
 *   to miss writes from a previous build.
 * - keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY allows the auth
 *   token to be read on every cold launch after the device has been unlocked
 *   once since boot. The default (WHEN_UNLOCKED) refuses access during the
 *   first-unlock window, which is the most common TestFlight failure mode.
 * - requireAuthentication: false keeps SecureStore on its non-biometric code
 *   path, so it never reads NSFaceIDUsageDescription or constructs a
 *   biometry-current-set access control object — both of which can throw
 *   NSException and trip iOS 26's unhandled async-void TurboModule rethrow.
 */
export const secureStoreOptions = {
  keychainService: "anything-auth",
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

/**
 * This store manages the authentication state of the application.
 */
export const useAuthStore = create((set) => ({
  isReady: false,
  auth: null,
  setAuth: async (auth) => {
    if (auth) {
      try {
        await SecureStore.setItemAsync(
          authKey,
          JSON.stringify(auth),
          secureStoreOptions,
        );
        // Update state only after successful write
        set({ auth });
      } catch (error) {
        console.error("Failed to save auth to SecureStore:", error);
        // Still set in-memory state for this session
        set({ auth });
      }
    } else {
      try {
        await SecureStore.deleteItemAsync(authKey, secureStoreOptions);
      } catch (error) {
        console.error("Failed to delete auth from SecureStore:", error);
      }
      set({ auth: null });
    }
  },
}));

/**
 * This store manages the state of the authentication modal.
 */
export const useAuthModal = create((set) => ({
  isOpen: false,
  mode: "signup",
  open: (options) => set({ isOpen: true, mode: options?.mode || "signup" }),
  close: () => set({ isOpen: false }),
}));
