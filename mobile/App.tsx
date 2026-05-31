import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import cloudLeftImage from './src/assets/illustrations/dream_loading_cloud_left.png';
import cloudRightImage from './src/assets/illustrations/dream_loading_cloud_right.png';
import moonImage from './src/assets/illustrations/dream_loading_moon.png';
import starImage from './src/assets/illustrations/dream_loading_star.png';
import agedLetterPaperTexture from './src/assets/textures/aged_letter_paper.webp';
import paperTexture from './src/assets/textures/paper_texture.webp';
import { DreamCardFrame } from './src/components/DreamCardFrame';
import { PassModal } from './src/components/PassModal';
import { prehydrateComposeDraftCache } from './src/data/composeDraftCache';
import { usePassPurchaseRecovery } from './src/hooks/usePassPurchaseRecovery';
import { RootNavigator } from './src/navigation/RootNavigator';
import {
  registerPushToken,
  stopWatchingTokenRefresh,
  unregisterPushToken,
} from './src/services/pushNotifications';
import { checkForImmediateAndroidUpdate } from './src/services/inAppUpdates';
import { useSessionStore } from './src/store/sessionStore';
import { isAnyPushEnabled, useSettingsStore } from './src/store/settingsStore';
import { colors } from './src/theme/colors';
import {
  CARD_COLOR_THEMES,
  CARD_FRAME_OPTIONS,
} from './src/theme/dreamDesigns';
import { nanumHandwritingFonts } from './src/theme/fonts';

const queryClient = new QueryClient();

prehydrateComposeDraftCache(useSessionStore.getState().userId);

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.background}
          />
          <PushNotificationRegistrar />
          <AndroidInAppUpdateGate />
          <PassPurchaseRecovery />
          <StartupPreloader />
          <RootNavigator />
          <PassModal />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function AndroidInAppUpdateGate() {
  useEffect(() => {
    checkForImmediateAndroidUpdate().catch(() => undefined);
  }, []);

  return null;
}

function PassPurchaseRecovery() {
  usePassPurchaseRecovery();
  return null;
}

function PushNotificationRegistrar() {
  const token = useSessionStore(state => state.token);
  const pushEnabled = useSettingsStore(state =>
    isAnyPushEnabled(state.pushPreferences),
  );

  useEffect(() => {
    if (!token) {
      stopWatchingTokenRefresh();
      return;
    }

    // Keep the backend device token in sync with the local push preference so
    // a disabled toggle survives app restarts.
    if (pushEnabled) {
      registerPushToken(token).catch(() => undefined);
    } else {
      unregisterPushToken(token).catch(() => undefined);
    }
    return () => {
      stopWatchingTokenRefresh();
    };
  }, [pushEnabled, token]);

  return null;
}

function StartupPreloader() {
  const userId = useSessionStore(state => state.userId);

  useEffect(() => {
    prehydrateComposeDraftCache(userId);
  }, [userId]);

  useEffect(() => {
    [
      paperTexture,
      agedLetterPaperTexture,
      moonImage,
      starImage,
      cloudLeftImage,
      cloudRightImage,
    ].forEach(source => {
      const uri = Image.resolveAssetSource(source)?.uri;
      if (uri) {
        Image.prefetch(uri).catch(() => undefined);
      }
    });
  }, []);

  return (
    <View pointerEvents="none" style={styles.preloadHost}>
      {Object.values(nanumHandwritingFonts).map(font => (
        <Text key={font} style={[styles.preloadText, { fontFamily: font }]}>
          꿈드림
        </Text>
      ))}
      {CARD_FRAME_OPTIONS.map(option => (
        <DreamCardFrame
          key={option.value}
          compact
          minimal
          backgroundColor={CARD_COLOR_THEMES.beige.card}
          borderColor={CARD_COLOR_THEMES.beige.line}
          frame={option.value}
          height={40}
          textureColor={CARD_COLOR_THEMES.beige.texture}
        >
          <View />
        </DreamCardFrame>
      ))}
      {/* Decode the generation-loader artwork once so the modal shows it
          instantly the first time it opens. */}
      {[moonImage, starImage, cloudLeftImage, cloudRightImage].map(source => (
        <Image
          key={Image.resolveAssetSource(source)?.uri ?? String(source)}
          source={source}
          fadeDuration={0}
          style={styles.preloadImage}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  preloadHost: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  preloadText: {
    fontSize: 1,
    lineHeight: 1,
  },
  preloadImage: {
    width: 64,
    height: 64,
  },
});

export default App;
