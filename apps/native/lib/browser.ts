import { Linking } from "react-native";
import type { WebBrowserAuthSessionResult } from "expo-web-browser";

type AuthSessionResult = WebBrowserAuthSessionResult;

async function loadWebBrowser() {
  try {
    return await import("expo-web-browser");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ExpoWebBrowser") || message.includes("native module")) {
      return null;
    }
    throw error;
  }
}

/**
 * Prefer Expo's auth session on rebuilt native binaries. Older development
 * clients can still launch the browser through React Native Linking while they
 * are waiting for a rebuild after adding ExpoWebBrowser.
 */
export async function openAuthSession(
  url: string,
  redirectUrl: string,
): Promise<AuthSessionResult> {
  const webBrowser = await loadWebBrowser();
  if (webBrowser) {
    return webBrowser.openAuthSessionAsync(url, redirectUrl);
  }

  await Linking.openURL(url);
  return { type: "cancel" } as AuthSessionResult;
}

export async function openBrowser(url: string): Promise<void> {
  const webBrowser = await loadWebBrowser();
  if (webBrowser) {
    await webBrowser.openBrowserAsync(url);
    return;
  }

  await Linking.openURL(url);
}
