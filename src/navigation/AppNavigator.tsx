import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {View, StyleSheet, Platform} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Colors} from '../theme/colors';
import HomeScreen from '../screens/HomeScreen';
import VideosScreen from '../screens/VideosScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RecordingPreviewScreen from '../screens/RecordingPreviewScreen';

export type RootTabParamList = {
  Record: undefined;
  Videos: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  Settings: undefined;
  RecordingPreview: {filePath: string};
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 16,
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
          tabBarIcon: ({focused, color}) => (
            <Icon
              name={focused ? 'record-circle' : 'record-circle-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Videos"
        component={VideosScreen}
        options={{
          tabBarLabel: 'Videolarım',
          tabBarIcon: ({focused, color}) => (
            <Icon
              name={focused ? 'filmstrip-box' : 'filmstrip-box-multiple'}
              size={24}
              color={color}
            />
          ),
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
      <Stack.Screen
        name="RecordingPreview"
        component={RecordingPreviewScreen}
        options={{
          presentation: 'card',
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({});

export default AppNavigator;
