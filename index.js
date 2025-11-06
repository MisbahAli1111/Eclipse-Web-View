/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';

// Background message handler (when app is in background or quit)
// This should ONLY handle data-only messages to avoid duplicate notifications
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📩 Background notification received:', remoteMessage);
  
  // Ignore invalid/empty messages
  if (!remoteMessage || (!remoteMessage.notification && !remoteMessage.data)) {
    console.log('⚠️ Ignoring empty/invalid message');
    return;
  }
  
  // Only process if this is a data-only message (no notification payload)
  // If notification payload exists, Firebase already displayed it automatically
  if (remoteMessage.notification) {
    console.log('⚠️ Notification already handled by Firebase (has notification payload)');
    return;
  }

  // Handle data-only messages
  if (remoteMessage.data && Object.keys(remoteMessage.data).length > 0) {
    // Ensure we have at least title or body in the data
    if (!remoteMessage.data.title && !remoteMessage.data.body) {
      console.log('⚠️ Ignoring data message without title or body');
      return;
    }
    
    console.log('✅ Processing data-only message');
    
    // Create notification channel (if not exists)
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    // Display the notification using data payload
    await notifee.displayNotification({
      title: remoteMessage.data.title,
      body: remoteMessage.data.body,
      data: remoteMessage.data,
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
        sound: 'default',
        smallIcon: 'ic_launcher',
      },
      ios: {
        sound: 'default',
      },
    });
  }
});

AppRegistry.registerComponent(appName, () => App);
