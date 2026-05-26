import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Inbox, Send, UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { PaperTextureOverlay } from '../components/PaperTextureOverlay';
import { ClaimDreamScreen } from '../screens/ClaimDreamScreen';
import { ComposeScreen } from '../screens/ComposeScreen';
import { DreamDetailScreen } from '../screens/DreamDetailScreen';
import { GroupRoomScreen } from '../screens/GroupRoomScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OutboxScreen } from '../screens/OutboxScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_BASE_HEIGHT = 64;
const TAB_BAR_TOP_RADIUS = 30;
const TAB_BAR_BASE_PADDING_BOTTOM = 8;
const TAB_BAR_SEPARATOR_HEIGHT = 18;
const TAB_BAR_OUTER_GLOW_HEIGHT = 46;
const TAB_BAR_OUTER_GLOW_SURFACE_HEIGHT =
  TAB_BAR_OUTER_GLOW_HEIGHT + TAB_BAR_TOP_RADIUS;

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['kkumdream://', 'https://kkumdream.app'],
  config: {
    screens: {
      ClaimDream: 'd/:dreamId',
      MainTabs: {
        screens: {
          Home: '',
          Inbox: 'inbox',
          Outbox: 'outbox',
          Profile: 'profile',
        },
      },
    },
  },
};

type TabIconProps = {
  color: string;
  size: number;
};

function HomeTabIcon({ color, size }: TabIconProps) {
  return <Home color={color} size={size} />;
}

function InboxTabIcon({ color, size }: TabIconProps) {
  return <Inbox color={color} size={size} />;
}

function OutboxTabIcon({ color, size }: TabIconProps) {
  return <Send color={color} size={size} />;
}

function ProfileTabIcon({ color, size }: TabIconProps) {
  return <UserRound color={color} size={size} />;
}

function TabBarSeparatorGradient() {
  return (
    <Svg
      pointerEvents="none"
      preserveAspectRatio="none"
      style={styles.tabBarSeparatorGradient}
      width="100%"
      height={TAB_BAR_SEPARATOR_HEIGHT}
    >
      <Defs>
        <LinearGradient id="tabBarSeparator" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.22} />
          <Stop offset="0.48" stopColor={colors.primary} stopOpacity={0.08} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect
        x="0"
        y="0"
        width="100%"
        height={TAB_BAR_SEPARATOR_HEIGHT}
        fill="url(#tabBarSeparator)"
      />
    </Svg>
  );
}

function TabBarOuterGlow() {
  return (
    <View pointerEvents="none" style={styles.tabBarOuterGlow}>
      <Svg
        pointerEvents="none"
        preserveAspectRatio="none"
        width="100%"
        height={TAB_BAR_OUTER_GLOW_SURFACE_HEIGHT}
      >
        <Defs>
          <LinearGradient id="tabBarOuterGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0} />
            <Stop offset="0.35" stopColor={colors.primary} stopOpacity={0.08} />
            <Stop offset="0.72" stopColor={colors.primary} stopOpacity={0.2} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.28} />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height={TAB_BAR_OUTER_GLOW_SURFACE_HEIGHT}
          fill="url(#tabBarOuterGlow)"
        />
      </Svg>
    </View>
  );
}

function TabBarPaperBackground() {
  return (
    <View pointerEvents="none" style={styles.tabBarBackground}>
      <View style={styles.tabBarBaseFill} />
      <TabBarOuterGlow />
      <View style={styles.tabBarShadowShape} />
      <View style={styles.tabBarSurface}>
        <PaperTextureOverlay subtle />
        <TabBarSeparatorGradient />
      </View>
    </View>
  );
}

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
  },
};

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingTop: 6,
          paddingBottom: TAB_BAR_BASE_PADDING_BOTTOM + insets.bottom,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderTopLeftRadius: TAB_BAR_TOP_RADIUS,
          borderTopRightRadius: TAB_BAR_TOP_RADIUS,
          elevation: 12,
          overflow: 'visible',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.22,
          shadowRadius: 24,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.handwritten,
          fontWeight: '600',
          fontSize: 12,
        },
        tabBarBackground: TabBarPaperBackground,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: '홈',
          tabBarIcon: HomeTabIcon,
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: '받은 꿈',
          tabBarIcon: InboxTabIcon,
        }}
      />
      <Tab.Screen
        name="Outbox"
        component={OutboxScreen}
        options={{
          title: '보낸 꿈',
          tabBarIcon: OutboxTabIcon,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: '내 정보',
          tabBarIcon: ProfileTabIcon,
        }}
      />
    </Tab.Navigator>
  );
}

function RootStack() {
  const isAuthenticated = useSessionStore(state => state.isAuthenticated);

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.textPrimary,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          fontFamily: fontFamily.handwritten,
          fontWeight: '700',
          fontSize: 22,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="GroupRoom"
            component={GroupRoomScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Compose"
            component={ComposeScreen}
            options={{ title: '꿈 주기' }}
          />
          <Stack.Screen
            name="DreamDetail"
            component={DreamDetailScreen}
            options={{ title: '꿈 카드' }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
      <Stack.Screen
        name="ClaimDream"
        component={ClaimDreamScreen}
        options={{ title: '꿈카드 받기' }}
      />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  return (
    <NavigationContainer theme={theme} linking={linking}>
      <RootStack />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBarBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'visible',
  },
  tabBarBaseFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
  },
  tabBarSurface: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderTopLeftRadius: TAB_BAR_TOP_RADIUS,
    borderTopRightRadius: TAB_BAR_TOP_RADIUS,
    overflow: 'hidden',
    backgroundColor: colors.cardBase,
  },
  tabBarShadowShape: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderTopLeftRadius: TAB_BAR_TOP_RADIUS,
    borderTopRightRadius: TAB_BAR_TOP_RADIUS,
    backgroundColor: colors.cardBase,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.24,
    shadowRadius: 26,
    elevation: 14,
  },
  tabBarOuterGlow: {
    position: 'absolute',
    top: -TAB_BAR_OUTER_GLOW_HEIGHT + 6,
    right: -22,
    left: -22,
    height: TAB_BAR_OUTER_GLOW_SURFACE_HEIGHT,
    borderTopLeftRadius: TAB_BAR_TOP_RADIUS,
    borderTopRightRadius: TAB_BAR_TOP_RADIUS,
    overflow: 'hidden',
  },
  tabBarSeparatorGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: TAB_BAR_SEPARATOR_HEIGHT,
  },
});
