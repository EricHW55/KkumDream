/* eslint-env jest */

import 'react-native-gesture-handler/jestSetup';

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
