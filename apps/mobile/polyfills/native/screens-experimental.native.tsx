import { View } from 'react-native';

/**
 * Last-resort stub for `react-native-screens/experimental`.
 *
 * expo-router 57 eagerly requires this subpath from its barrel
 * (`build/exports.js` -> ExperimentalStackView). When the installed
 * `react-native-screens` copy is older than 4.17 (no experimental folder)
 * or is not hoisted next to a workspace-root expo-router, Metro cannot
 * resolve the subpath and every `expo-router` import (Tabs, Stack, Slot)
 * dies. This stub only needs `Stack` so the barrel can load.
 * ExperimentalStack itself will not render a real native stack.
 */
export const Stack = View;
export default { Stack };
