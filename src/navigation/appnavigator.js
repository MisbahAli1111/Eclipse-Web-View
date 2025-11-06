import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SplashScreen from '../screens/splash/splashscreen';
import LoginScreen from '../screens/login/loginscreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = ({ initialRoute }) => {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;