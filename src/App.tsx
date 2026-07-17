import React from 'react';
import {StatusBar, LogBox} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {enableScreens} from 'react-native-screens';
import AppNavigator from './navigation/AppNavigator';
import {Colors} from './theme/colors';

// Enable native screens optimisation — must be called before any navigator
// renders. Prevents react-native-screens from crashing on first render in
// release builds where the native component registry is strict.
enableScreens();

LogBox.ignoreLogs([
  'new NativeEventEmitter',
  'Require cycle',
]);

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.background}
        translucent={false}
      />
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
