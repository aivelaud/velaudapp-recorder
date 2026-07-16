import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {View, Text, StyleSheet} from 'react-native';
import {Colors} from '../theme/colors';
import HomeScreen from '../screens/HomeScreen';
import VideosScreen from '../screens/VideosScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootTabParamList = {
  Record: undefined;
  Videos: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function RecordIcon({focused}: {focused: boolean}) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <View style={[styles.recordDot, focused && styles.recordDotActive]} />
    </View>
  );
}

function VideosIcon({focused}: {focused: boolean}) {
  return (
    <View style={styles.tabIconSimple}>
      <View style={[styles.filmStrip, focused && styles.filmStripActive]} />
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
      }}>
      <Tab.Screen
        name="Record"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Kaydet',
          tabBarIcon: ({focused}) => <RecordIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Videos"
        component={VideosScreen}
        options={{
          tabBarLabel: 'Videolarım',
          tabBarIcon: ({focused}) => <VideosIcon focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: Colors.background},
      }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          presentation: 'card',
          headerShown: true,
          headerTitle: 'Ayarlar',
          headerStyle: {backgroundColor: Colors.surface},
          headerTintColor: Colors.text,
          headerTitleStyle: {fontWeight: '700'},
          headerBackTitle: '',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    borderColor: Colors.primary,
  },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.textMuted,
  },
  recordDotActive: {
    backgroundColor: Colors.primary,
  },
  tabIconSimple: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmStrip: {
    width: 22,
    height: 16,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: Colors.textMuted,
  },
  filmStripActive: {
    borderColor: Colors.primary,
  },
});

export default AppNavigator;
