import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/splash/splashscreen';
import LoginScreen from './src/screens/login/loginscreen';
import DashboardScreen from './src/screens/dashboard/DashboardScreen';
import { NotificationService } from './src/services/NotificationService';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useRef();

  useEffect(() => {
    // Handle notification press (when user taps on notification)
    const handleNotificationPress = (notification) => {
      console.log('🔔 User tapped notification:', notification);
      
      // You can navigate to specific screens based on notification data
      // Example: if notification has a screen property
      if (notification?.data?.screen) {
        navigationRef.current?.navigate(notification.data.screen);
      }
      
      // Or handle custom actions based on notification type
      // if (notification?.data?.type === 'message') {
      //   navigationRef.current?.navigate('Dashboard');
      // }
    };

    // Setup foreground press handler (when app is open)
    const unsubscribeForeground = NotificationService.setupNotificationPressHandler(
      handleNotificationPress
    );

    // Setup background press handler (when app is in background/killed)
    NotificationService.setupBackgroundPressHandler(handleNotificationPress);

    // Cleanup
    return () => {
      unsubscribeForeground();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
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