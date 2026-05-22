import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/navigation/RootNavigator';
import {
  registerPushToken,
  stopWatchingTokenRefresh,
} from './src/services/pushNotifications';
import { useSessionStore } from './src/store/sessionStore';
import { colors } from './src/theme/colors';

const queryClient = new QueryClient();

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
