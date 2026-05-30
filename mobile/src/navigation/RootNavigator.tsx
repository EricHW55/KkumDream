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

import { HaloShadow } from '../components/HaloShadow';
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

function TabBarPaperBackground() {
  return (
    <View pointerEvents="none" style={styles.tabBarBackground}>
      <HaloShadow
        borderTopLeftRadius={TAB_BAR_TOP_RADIUS}
        borderTopRightRadius={TAB_BAR_TOP_RADIUS}
        color={colors.primaryDark}
        inset={26}
        ambientBlur={16}
        ambientOpacity={0.16}
        contactBlur={5}
        contactOpacity={0.12}
      />
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
        lazy: false,
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
          // Kill the navigator's default Material elevation (8): it casts a
          // hard, straight-edged native shadow along the bar's rectangular
          // bounds that sits above our rounded surface and reads as a straight
          // cut. Only the custom rounded HaloShadow should show.
          elevation: 0,
          shadowColor: 'transparent',
          shadowOpacity: 0,
          shadowRadius: 0,
          overflow: 'visible',
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
    zIndex: 2,
  },
  tabBarSeparatorGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: TAB_BAR_SEPARATOR_HEIGHT,
  },
});
