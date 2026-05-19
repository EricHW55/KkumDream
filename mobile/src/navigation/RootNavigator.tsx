import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  DefaultTheme,
  NavigationContainer,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Inbox, Send, UserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const TAB_BAR_BASE_HEIGHT = 64;
const TAB_BAR_TOP_RADIUS = 30;
const TAB_BAR_BASE_PADDING_BOTTOM = 8;

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
          backgroundColor: colors.cardBase,
          borderTopWidth: 1,
          borderTopColor: colors.divider,
          borderTopLeftRadius: TAB_BAR_TOP_RADIUS,
          borderTopRightRadius: TAB_BAR_TOP_RADIUS,
          overflow: 'hidden',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
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
