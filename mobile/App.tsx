import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Image, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import agedLetterPaperTexture from './src/assets/textures/aged_letter_paper.webp';
import paperTexture from './src/assets/textures/paper_texture.webp';
import { DreamCardFrame } from './src/components/DreamCardFrame';
import { prehydrateComposeDraftCache } from './src/data/composeDraftCache';
import { RootNavigator } from './src/navigation/RootNavigator';
import {
  registerPushToken,
  stopWatchingTokenRefresh,
} from './src/services/pushNotifications';
import { useSessionStore } from './src/store/sessionStore';
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
          <StartupPreloader />
          <RootNavigator />
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function PushNotificationRegistrar() {
  const token = useSessionStore(state => state.token);

  useEffect(() => {
    if (!token) {
      stopWatchingTokenRefresh();
      return;
    }

    registerPushToken(token).catch(() => undefined);
    return () => {
      stopWatchingTokenRefresh();
    };
  }, [token]);

  return null;
}

function StartupPreloader() {
  const userId = useSessionStore(state => state.userId);

  useEffect(() => {
    prehydrateComposeDraftCache(userId);
  }, [userId]);

  useEffect(() => {
    [paperTexture, agedLetterPaperTexture].forEach(source => {
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
});

export default App;
