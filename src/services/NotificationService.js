// services/NotificationService.js
import { PermissionsAndroid, Platform } from 'react-native';
import { 
  getMessaging, 
  requestPermission, 
  hasPermission,
  getToken,
  onMessage,
  AuthorizationStatus 
} from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

export class NotificationService {
  static CHANNEL_ID = 'default';
  static CHANNEL_NAME = 'Default Notifications';

  static async requestPermission() {
    try {
      if (Platform.OS === 'ios') {
        // Request iOS notification permissions using Firebase Messaging modular API
        const messaging = getMessaging();
        const authStatus = await requestPermission(messaging);
        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('✅ iOS notification permission granted:', authStatus);
          return true;
        } else {
          console.log('❌ iOS notification permission denied');
          return false;
        }
      } else if (Platform.OS === 'android' && Platform.Version >= 33) {
        // Request on Android 13+ (API 33+)
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('✅ Android notification permission granted');
          return true;
        } else if (result === PermissionsAndroid.RESULTS.DENIED) {
          console.log('❌ Android notification permission denied');
          return false;
        } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          console.log('❌ Android notification permission blocked (never ask again)');
          return false;
        }
      } else {
        console.log('✅ Notification permission not required for this Android version');
        return true; // Permission not required, consider it granted
      }
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      return false;
    }
  }

  static async checkPermission() {
    try {
      if (Platform.OS === 'ios') {
        const messaging = getMessaging();
        const authStatus = await hasPermission(messaging);
        const enabled =
          authStatus === AuthorizationStatus.AUTHORIZED ||
          authStatus === AuthorizationStatus.PROVISIONAL;
        return enabled;
      } else if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted;
      }
      return true; // Permission not required for older Android versions
    } catch (error) {
      console.error('❌ Error checking notification permission:', error);
      return false;
    }
  }

  static async getFCMToken() {
    try {
      const messaging = getMessaging();
      
      // iOS needs time for APNS token to be set by native code
      if (Platform.OS === 'ios') {
        // Add a small delay to ensure APNS token is set
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const token = await getToken(messaging);
      console.log('✅ FCM Token:', token);
      return token;
    } catch (error) {
      console.log('❌ Error getting FCM token:', error);
      
      // Handle specific FCM service errors
      if (error.message && error.message.includes('SERVICE_NOT_AVAILABLE')) {
        console.log('⚠️ FCM service not available. This is common in Android emulators without Google Play Services.');
        console.log('💡 To test FCM, use a physical device or an emulator with Google Play Services.');
      } else if (error.message && error.message.includes('No APNS token')) {
        console.log('⚠️ APNS token not yet available. Make sure the app has been rebuilt with the latest native changes.');
        console.log('💡 Try: 1) Clean build folder, 2) Rebuild the app, 3) Restart Metro bundler');
      }
      
      return null;
    }
  }

  /**
   * Create notification channel for Android
   * Required for displaying notifications on Android 8.0+
   */
  static async createNotificationChannel() {
    try {
      await notifee.createChannel({
        id: this.CHANNEL_ID,
        name: this.CHANNEL_NAME,
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
      console.log('✅ Notification channel created');
    } catch (error) {
      console.error('❌ Error creating notification channel:', error);
    }
  }

  /**
   * Display a local notification using Notifee
   * @param {Object} notification - Notification data {title, body, data}
   */
  static async displayNotification({ title, body, data = {} }) {
    try {
      await notifee.displayNotification({
        title,
        body,
        data,
        android: {
          channelId: this.CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          sound: 'default',
          smallIcon: 'ic_launcher', // Make sure this icon exists in your android/app/src/main/res/
        },
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
      });
      console.log('✅ Notification displayed:', title);
    } catch (error) {
      console.error('❌ Error displaying notification:', error);
    }
  }


  static setupForegroundHandler() {
    try {
      const messaging = getMessaging();
      const unsubscribe = onMessage(messaging, async (remoteMessage) => {
      
        // Get title and body from notification payload or data payload
        const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'New Notification';
        const body = remoteMessage.notification?.body || remoteMessage.data?.body || '';

        // Display the notification using Notifee
        await this.displayNotification({
          title,
          body,
          data: remoteMessage.data || {},
        });
      });

      console.log('Foreground notification handler setup');
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up foreground handler:', error);
      return () => {};
    }
  }

  static setupNotificationPressHandler(onNotificationPress) {
    try {
      return notifee.onForegroundEvent(({ type, detail }) => {
        
        // Only handle PRESS events, ignore DISMISSED and others
        if (type === EventType.PRESS) {
          if (onNotificationPress) {
            onNotificationPress(detail.notification);
          }
        } else if (type === EventType.DISMISSED) {
       }
      });
    } catch (error) {
      console.error('Error setting up press handler:', error);
      return () => {};
    }
  }


  static async setupBackgroundPressHandler(onNotificationPress) {
    try {
      const initialNotification = await notifee.getInitialNotification();
      
      if (initialNotification) {
        if (onNotificationPress) {
          onNotificationPress(initialNotification.notification);
        }
      }

      notifee.onBackgroundEvent(async ({ type, detail }) => {
       
        // Only handle PRESS events, ignore DISMISSED and others
        if (type === EventType.PRESS) {
          if (onNotificationPress) {
            onNotificationPress(detail.notification);
          }
        } else if (type === EventType.DISMISSED) {
        }
      });
    } catch (error) {
      console.error('Error setting up background press handler:', error);
    }
  }


  static async setupNotifications() {
    // Create notification channel first
    await this.createNotificationChannel();

    // Request permission and get FCM token
    const permissionGranted = await this.requestPermission();
    
    let fcmToken = null;
    if (permissionGranted) {
      fcmToken = await this.getFCMToken();
    }

    // Setup foreground handler
    this.setupForegroundHandler();

    return {
      permissionGranted,
      fcmToken
    };
  }
}

