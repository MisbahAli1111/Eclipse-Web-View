import crashlytics from '@react-native-firebase/crashlytics';

/**
 * CrashAnalyticsService - Centralized crash reporting and analytics
 * Uses Firebase Crashlytics for error tracking and logging
 */
class CrashAnalyticsService {
  /**
   * Initialize the service (optional, but good for setup)
   */
  static async initialize() {
    try {
      // Enable crashlytics data collection
      await crashlytics().setCrashlyticsCollectionEnabled(true);
      console.log('[CrashAnalytics] Service initialized successfully');
    } catch (error) {
      console.error('[CrashAnalytics] Initialization error:', error);
    }
  }

  /**
   * Log a screen view event
   * @param {string} screenName - Name of the screen being viewed
   */
  static logScreenView(screenName) {
    try {
      crashlytics().log(`Screen View: ${screenName}`);
      console.log(`[CrashAnalytics] Screen view logged: ${screenName}`);
    } catch (error) {
      console.error('[CrashAnalytics] logScreenView error:', error);
    }
  }

  /**
   * Log a general message
   * @param {string} message - Message to log
   */
  static log(message) {
    try {
      crashlytics().log(message);
      console.log(`[CrashAnalytics] Log: ${message}`);
    } catch (error) {
      console.error('[CrashAnalytics] log error:', error);
    }
  }

  /**
   * Record a non-fatal error
   * @param {Error} error - Error object to record
   * @param {string} context - Context where the error occurred
   */
  static recordError(error, context = 'Unknown Context') {
    try {
      // Add context as an attribute
      crashlytics().setAttribute('error_context', context);
      
      // Record the error
      crashlytics().recordError(error);
      
      console.error(`[CrashAnalytics] Error recorded (${context}):`, error);
    } catch (err) {
      console.error('[CrashAnalytics] recordError failed:', err);
    }
  }

  /**
   * Log a critical failure that should be tracked
   * @param {string} operation - Operation that failed
   * @param {Error|string} error - Error object or message
   */
  static logCriticalFailure(operation, error) {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorObject = error instanceof Error ? error : new Error(errorMessage);
      
      crashlytics().setAttribute('critical_operation', operation);
      crashlytics().log(`CRITICAL FAILURE: ${operation} - ${errorMessage}`);
      crashlytics().recordError(errorObject);
      
      console.error(`[CrashAnalytics] Critical failure (${operation}):`, error);
    } catch (err) {
      console.error('[CrashAnalytics] logCriticalFailure failed:', err);
    }
  }

  /**
   * Log an authentication failure
   * @param {Error|string} error - Error object or message
   * @param {string} method - Authentication method (e.g., 'biometric', 'password')
   */
  static logAuthFailure(error, method = 'unknown') {
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      crashlytics().setAttribute('auth_method', method);
      crashlytics().log(`Auth Failure [${method}]: ${errorMessage}`);
      
      // Don't record as error for user cancellations
      if (!errorMessage.toLowerCase().includes('cancel')) {
        const errorObject = error instanceof Error ? error : new Error(errorMessage);
        crashlytics().recordError(errorObject);
      }
      
      console.warn(`[CrashAnalytics] Auth failure (${method}):`, error);
    } catch (err) {
      console.error('[CrashAnalytics] logAuthFailure failed:', err);
    }
  }

  /**
   * Log a successful user sign-in
   * @param {Object} userData - User data (email, username, tenant_id, etc.)
   */
  static async logUserSignIn(userData = {}) {
    try {
      const { email, username, tenant_id } = userData;
      
      // Set user identifier (use email or username)
      if (email || username) {
        await crashlytics().setUserId(email || username);
      }
      
      // Set custom attributes
      if (tenant_id) {
        crashlytics().setAttribute('tenant_id', String(tenant_id));
      }
      if (email) {
        crashlytics().setAttribute('user_email', email);
      }
      
      crashlytics().log(`User signed in: ${email || username}`);
      console.log(`[CrashAnalytics] User sign-in logged:`, { email, tenant_id });
    } catch (error) {
      console.error('[CrashAnalytics] logUserSignIn error:', error);
    }
  }

  /**
   * Clear user data (on logout)
   */
  static async clearUserData() {
    try {
      // Clear user identifier
      await crashlytics().setUserId('');
      
      // Clear custom attributes
      crashlytics().setAttribute('tenant_id', '');
      crashlytics().setAttribute('user_email', '');
      crashlytics().setAttribute('auth_method', '');
      crashlytics().setAttribute('error_context', '');
      crashlytics().setAttribute('critical_operation', '');
      
      crashlytics().log('User logged out - data cleared');
      console.log('[CrashAnalytics] User data cleared');
    } catch (error) {
      console.error('[CrashAnalytics] clearUserData error:', error);
    }
  }

  /**
   * Set a custom attribute for crash reports
   * @param {string} key - Attribute key
   * @param {string} value - Attribute value
   */
  static setAttribute(key, value) {
    try {
      crashlytics().setAttribute(key, String(value));
      console.log(`[CrashAnalytics] Attribute set: ${key} = ${value}`);
    } catch (error) {
      console.error('[CrashAnalytics] setAttribute error:', error);
    }
  }

  /**
   * Set the user identifier
   * @param {string} userId - User identifier
   */
  static async setUserId(userId) {
    try {
      await crashlytics().setUserId(userId);
      console.log(`[CrashAnalytics] User ID set: ${userId}`);
    } catch (error) {
      console.error('[CrashAnalytics] setUserId error:', error);
    }
  }

  /**
   * Check if crashlytics is enabled
   * @returns {Promise<boolean>} - Whether crashlytics is enabled
   */
  static async isEnabled() {
    try {
      return await crashlytics().isCrashlyticsCollectionEnabled();
    } catch (error) {
      console.error('[CrashAnalytics] isEnabled error:', error);
      return false;
    }
  }

  /**
   * Force a crash (for testing only - DO NOT USE IN PRODUCTION)
   */
  static crash() {
    crashlytics().crash();
  }
}

export default CrashAnalyticsService;

