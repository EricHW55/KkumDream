/* eslint-env jest */

import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-mmkv', () => {
  const stores = new Map();

  return {
    createMMKV: ({ id = 'default' } = {}) => {
      const store = stores.get(id) ?? new Map();
      stores.set(id, store);

      return {
        getString: key => store.get(key),
        set: (key, value) => store.set(key, value),
        remove: key => store.delete(key),
      };
    },
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() =>
      Promise.resolve({
        type: 'success',
        data: { idToken: 'mock-google-id-token' },
      }),
    ),
    signOut: jest.fn(() => Promise.resolve(null)),
  },
}));

jest.mock('@react-native-firebase/messaging', () => {
  const messaging = jest.fn(() => ({
    getToken: jest.fn(() => Promise.resolve('mock-fcm-token')),
    onTokenRefresh: jest.fn(() => jest.fn()),
    registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve(1)),
  }));
  messaging.AuthorizationStatus = {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  return messaging;
});

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');

  return {
    __esModule: true,
    default: {
      View: ReactNative.View,
      Text: ReactNative.Text,
      Image: ReactNative.Image,
      ScrollView: ReactNative.ScrollView,
      createAnimatedComponent: (component) => component,
    },
    useAnimatedStyle: (updater) => updater(),
    useSharedValue: (value) => ({ value }),
    withSpring: (value) => value,
  };
});
