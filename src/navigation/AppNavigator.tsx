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
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <View style={[styles.recordDot, focused && styles.recordDotActive]} />
    </View>
  );
}

function VideosIcon({focused}: {focused: boolean}) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <View style={[styles.filmIcon, focused && styles.filmIconActive]} />
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
          height: 64,
          paddingBottom: 10,
          paddingTop: 10,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: -4},
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.5,
          marginTop: 4,
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
          headerTitleStyle: {fontWeight: '700', fontSize: 18},
          headerBackTitle: '',
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
  },
  recordDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.textMuted,
  },
  recordDotActive: {
    backgroundColor: Colors.primary,
  },
  filmIcon: {
    width: 18,
    height: 14,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: Colors.textMuted,
  },
  filmIconActive: {
    borderColor: Colors.primary,
  },
});

export default AppNavigator;