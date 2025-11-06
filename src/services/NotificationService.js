// services/NotificationService.js
import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';

export class NotificationService {
  static CHANNEL_ID = 'default';
  static CHANNEL_NAME = 'Default Notifications';

  static async requestPermission() {
    // Only request on Android 13+ (API 33+)
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Notification permission granted');
          return true;
        } else if (result === PermissionsAndroid.RESULTS.DENIED) {
          console.log('Notification permission denied');
          return false;
        } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          console.log('Notification permission blocked (never ask again)');
          return false;
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    } else {
      console.log('Notification permission not required for this Android version');
      return true; // Permission not required, consider it granted
    }
  }

  static async checkPermission() {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted;
      } catch (error) {
        console.error('Error checking notification permission:', error);
        return false;
      }
    }
    return true; // Permission not required for older versions
  }

  static async getFCMToken() {
    try {
      // Register device for remote messages
      await messaging().registerDeviceForRemoteMessages();

      // Get FCM token
      const token = await messaging().getToken();
      
      if (token) {
        console.log('✅ FCM Token retrieved:', token);
        return token;
      } else {
        console.log('⚠️ No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
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

  /**
   * Setup foreground notification handler
   * This displays notifications when app is in foreground
   * @returns {Function} Unsubscribe function
   */
  static setupForegroundHandler() {
    try {
      const unsubscribe = messaging().onMessage(async (remoteMessage) => {
        console.log('📩 Foreground notification received:', remoteMessage);

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

      console.log('✅ Foreground notification handler setup');
      return unsubscribe;
    } catch (error) {
      console.error('❌ Error setting up foreground handler:', error);
      return () => {};
    }
  }

  /**
   * Setup notification press handlers
   * Called when user taps on a notification
   * @param {Function} onNotificationPress - Callback function
   * @returns {Function} Unsubscribe function
   */
  static setupNotificationPressHandler(onNotificationPress) {
    try {
      return notifee.onForegroundEvent(({ type, detail }) => {
        console.log('📱 Foreground event type:', type, 'EventType.PRESS:', EventType.PRESS);
        
        // Only handle PRESS events, ignore DISMISSED and others
        if (type === EventType.PRESS) {
          console.log('🔔 Notification pressed:', detail.notification);
          if (onNotificationPress) {
            onNotificationPress(detail.notification);
          }
        } else if (type === EventType.DISMISSED) {
          console.log('🗑️ Notification dismissed - ignoring');
        }
      });
    } catch (error) {
      console.error('❌ Error setting up press handler:', error);
      return () => {};
    }
  }

  /**
   * Setup background notification press handler
   * Called when user taps notification while app is in background/killed state
   * @param {Function} onNotificationPress - Callback function
   */
  static async setupBackgroundPressHandler(onNotificationPress) {
    try {
      const initialNotification = await notifee.getInitialNotification();
      
      if (initialNotification) {
        console.log('🔔 App opened from notification:', initialNotification.notification);
        if (onNotificationPress) {
          onNotificationPress(initialNotification.notification);
        }
      }

      notifee.onBackgroundEvent(async ({ type, detail }) => {
        console.log('📱 Background event type:', type, 'EventType.PRESS:', EventType.PRESS);
        
        // Only handle PRESS events, ignore DISMISSED and others
        if (type === EventType.PRESS) {
          console.log('🔔 Background notification pressed:', detail.notification);
          if (onNotificationPress) {
            onNotificationPress(detail.notification);
          }
        } else if (type === EventType.DISMISSED) {
          console.log('🗑️ Background notification dismissed - ignoring');
        }
      });
    } catch (error) {
      console.error('❌ Error setting up background press handler:', error);
    }
  }

  /**
   * Setup complete notification system (permission + FCM token + Notifee)
   * Call this method to handle everything in one go
   * @returns {Promise<{permissionGranted: boolean, fcmToken: string|null}>}
   */
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

