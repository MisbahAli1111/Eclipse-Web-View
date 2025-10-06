import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/splashscreen';
import LoginScreen from './src/screens/loginscreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CrashAnalyticsService from './src/services/CrashAnalyticsService';

const Stack = createNativeStackNavigator();

export default function App() {
  // Initialize CrashAnalyticsService on app startup
  useEffect(() => {
    CrashAnalyticsService.initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen 
            name="Dashboard" 
            component={DashboardScreen}
            options={{ gestureEnabled: false }} // Prevent swipe back to login
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}