import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import messaging, {
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {
  Image,
  InteractionManager,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import cloudLeftImage from './src/assets/illustrations/dream_loading_cloud_left.png';
import cloudRightImage from './src/assets/illustrations/dream_loading_cloud_right.png';
import moonImage from './src/assets/illustrations/dream_loading_moon.png';
import starImage from './src/assets/illustrations/dream_loading_star.png';
import agedLetterPaperTexture from './src/assets/textures/aged_letter_paper.webp';
import paperTexture from './src/assets/textures/paper_texture.webp';
import { DreamCardFrame } from './src/components/DreamCardFrame';
import { IosUpdateModal } from './src/components/IosUpdateModal';
import { PassModal } from './src/components/PassModal';
import { prehydrateComposeDraftCache } from './src/data/composeDraftCache';
import { usePassPurchaseRecovery } from './src/hooks/usePassPurchaseRecovery';
import {
  RootNavigator,
  rootNavigationRef,
} from './src/navigation/RootNavigator';
import { fetchDream } from './src/api/dreams';
import {
  checkForIosUpdateNotice,
  dismissIosUpdateNotice,
  type IosUpdateNotice,
  openUpdateUrl,
} from './src/services/appUpdates';
import {
  registerPushToken,
  stopWatchingTokenRefresh,
  unregisterPushToken,
} from './src/services/pushNotifications';
import { checkForImmediateAndroidUpdate } from './src/services/inAppUpdates';
import {
  cancelMorningDreamReminder,
  scheduleMorningDreamReminder,
} from './src/native/morningReminder';
import { useSessionStore } from './src/store/sessionStore';
import { isAnyPushEnabled, useSettingsStore } from './src/store/settingsStore';
import { colors } from './src/theme/colors';
import {
  CARD_COLOR_THEMES,
  CARD_FRAME_OPTIONS,
} from './src/theme/dreamDesigns';
import {
  nanumDahaengWeightFonts,
  nanumHandwritingFonts,
} from './src/theme/fonts';

const queryClient = new QueryClient();
const PRELOAD_FONT_FAMILIES = Array.from(
  new Set([
    ...Object.values(nanumHandwritingFonts),
    ...Object.values(nanumDahaengWeightFonts),
  ]),
);

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
          <PushNotificationNavigator />
          <AndroidInAppUpdateGate />
          <IosUpdateGate />
          <DeferredPassPurchaseRecovery />
          <MorningDreamReminderScheduler />
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

function IosUpdateGate() {
  const [notice, setNotice] = useState<IosUpdateNotice | null>(null);

  useEffect(() => {
    checkForIosUpdateNotice()
      .then(setNotice)
      .catch(() => undefined);
  }, []);

  if (!notice) {
    return null;
  }

  const dismiss = () => {
    if (!notice.required) {
      dismissIosUpdateNotice(notice.latestVersion);
      setNotice(null);
    }
  };

  return (
    <IosUpdateModal
      message={notice.message}
      required={notice.required}
      visible
      onDismiss={dismiss}
      onUpdate={() => {
        openUpdateUrl(notice.storeUrl).catch(() => undefined);
      }}
    />
  );
}

function DeferredPassPurchaseRecovery() {
  usePassPurchaseRecovery({ auto: true });
  return null;
}

function MorningDreamReminderScheduler() {
  const enabled = useSettingsStore(
    state => state.pushPreferences.morning_dream_card,
  );
  const wakeReminderTime = useSettingsStore(state => state.wakeReminderTime);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const interaction = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (cancelled) {
          return;
        }
        const task = enabled
          ? scheduleMorningDreamReminder(wakeReminderTime)
          : cancelMorningDreamReminder();
        task.catch(() => undefined);
      }, 1500);
    });

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      interaction.cancel();
    };
  }, [enabled, wakeReminderTime]);

  return null;
}

function PushNotificationNavigator() {
  const token = useSessionStore(state => state.token);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    try {
      const firebaseMessaging = messaging();
      const unsubscribe = firebaseMessaging.onNotificationOpenedApp(message => {
        openNotificationTarget(message, token).catch(() => undefined);
      });

      firebaseMessaging
        .getInitialNotification()
        .then(message => {
          if (message) {
            openNotificationTarget(message, token).catch(() => undefined);
          }
        })
        .catch(() => undefined);

      return unsubscribe;
    } catch {
      return undefined;
    }
  }, [token]);

  return null;
}

async function openNotificationTarget(
  message: FirebaseMessagingTypes.RemoteMessage,
  token: string,
) {
  const route = String(message.data?.route ?? '');
  const dreamId = String(message.data?.dreamId ?? '');
  if (route !== 'DreamDetail' || !dreamId) {
    return;
  }

  const dream = await fetchDream(dreamId, token);
  navigateWhenReady(() => {
    rootNavigationRef.navigate('DreamDetail', { dream });
  });
}

function navigateWhenReady(navigate: () => void, attempts = 10) {
  if (rootNavigationRef.isReady()) {
    navigate();
    return;
  }

  if (attempts <= 0) {
    return;
  }

  setTimeout(() => navigateWhenReady(navigate, attempts - 1), 120);
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
      {PRELOAD_FONT_FAMILIES.map(font => (
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
