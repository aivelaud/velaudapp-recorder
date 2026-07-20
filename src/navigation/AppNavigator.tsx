import React from 'react';
import {View, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import HomeScreen from '../screens/HomeScreen';
import VideosScreen from '../screens/VideosScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecordingPreviewScreen from '../screens/RecordingPreviewScreen';

// ─── Navigation type definitions ────────────────────────────────────────────
export type RootTabParamList = {
  Kayit: undefined;
  Videolar: undefined;
  Ayarlar: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  RecordingPreview: {filePath: string};
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Tab icon wrapper ─────────────────────────────────────────────────────
function TabIcon({
  name,
  focused,
}: {
  name: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <Icon
        name={name}
        size={22}
        color={focused ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}

// ─── Bottom Tabs ──────────────────────────────────────────────────────────
function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: tabBarHeight,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginTop: 3,
        },
        tabBarShowLabel: true,
      }}>
      <Tab.Screen
        name="Kayit"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Kayıt',
          tabBarIcon: ({focused}) => (
            <TabIcon name={focused ? 'record-circle' : 'record-circle-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Videolar"
        component={VideosScreen}
        options={{
          tabBarLabel: 'Videolar',
          tabBarIcon: ({focused}) => (
            <TabIcon name={focused ? 'play-box' : 'play-box-outline'} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Ayarlar"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Ayarlar',
          tabBarIcon: ({focused}) => (
            <TabIcon name={focused ? 'cog' : 'cog-outline'} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Root Stack ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: Colors.background},
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="RecordingPreview"
        component={RecordingPreviewScreen}
        options={{animation: 'slide_from_bottom'}}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    width: 40,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  tabIconWrapActive: {
    backgroundColor: Colors.primaryMuted,
  },
});
