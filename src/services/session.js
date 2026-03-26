import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain'; // Add this import

const SESSION_CONFIG = {
  INACTIVITY_LIMIT: 30 * 24 * 60 * 60 * 1000, // 1 minute for testing  || 30 days in production  
  KEYS: {
    TENANT_ID: '@tenant_id',
    AUTH_TOKEN: '@auth_token',
    LAST_ACTIVE: '@last_active',
    USER_EMAIL: '@user_email',
    REMEMBER_TOKEN: '@remember_token',
    TOKEN_TYPE: '@token_type',
    TIME_FORMAT: '@time_format',
    DATE_FORMAT: '@date_format',
    TIMEZONE_ID: '@timezone_id',
    USER_DATA: '@user_data',
    TENANT_DATA: '@tenant_data',
    PERMISSIONS: '@permissions',
    ACCESS_INFO: '@access_info',
  }
};

export const SessionService = {
  // Save all session data
  async saveSession(tenantId, email, authToken, extraData = {}) {
    const now = Date.now().toString();
    const pairs = [
      [SESSION_CONFIG.KEYS.TENANT_ID, tenantId],
      [SESSION_CONFIG.KEYS.AUTH_TOKEN, authToken],
      [SESSION_CONFIG.KEYS.LAST_ACTIVE, now],
      [SESSION_CONFIG.KEYS.USER_EMAIL, email],
    ];

    if (extraData.remember_token) pairs.push([SESSION_CONFIG.KEYS.REMEMBER_TOKEN, extraData.remember_token]);
    if (extraData.token_type)     pairs.push([SESSION_CONFIG.KEYS.TOKEN_TYPE, extraData.token_type]);
    if (extraData.time_format)    pairs.push([SESSION_CONFIG.KEYS.TIME_FORMAT, extraData.time_format]);
    if (extraData.date_format)    pairs.push([SESSION_CONFIG.KEYS.DATE_FORMAT, extraData.date_format]);
    if (extraData.timezone_id)    pairs.push([SESSION_CONFIG.KEYS.TIMEZONE_ID, extraData.timezone_id]);
    if (extraData.user)           pairs.push([SESSION_CONFIG.KEYS.USER_DATA, JSON.stringify(extraData.user)]);
    if (extraData.tenant)         pairs.push([SESSION_CONFIG.KEYS.TENANT_DATA, JSON.stringify(extraData.tenant)]);
    if (extraData.permissions)    pairs.push([SESSION_CONFIG.KEYS.PERMISSIONS, JSON.stringify(extraData.permissions)]);
    if (extraData.access_info)    pairs.push([SESSION_CONFIG.KEYS.ACCESS_INFO, JSON.stringify(extraData.access_info)]);

    await AsyncStorage.multiSet(pairs);
  },

  // Check if session is valid
  async isSessionValid() {
    const lastActive = await AsyncStorage.getItem(SESSION_CONFIG.KEYS.LAST_ACTIVE);
    const tenantId = await AsyncStorage.getItem(SESSION_CONFIG.KEYS.TENANT_ID);
    
    if (!lastActive || !tenantId) return false;
    
    return (Date.now() - parseInt(lastActive)) <= SESSION_CONFIG.INACTIVITY_LIMIT;
  },

  // Clear session
 async clearSession() {
  try {
    // Get all keys first
    const allKeys = await AsyncStorage.getAllKeys();
    const SESSION_PREFIXES = [
      '@last_active', '@current_tenant', '@tenant_id',
      '@user_email', '@auth_token', '@remember_token',
      '@token_type', '@time_format', '@date_format',
      '@timezone_id', '@user_data', '@tenant_data',
      '@permissions', '@access_info',
    ];
    const sessionKeys = allKeys.filter(key =>
      SESSION_PREFIXES.some(prefix => key.startsWith(prefix))
    );
    
    // Clear all session-related keys
    if (sessionKeys.length > 0) {
      await AsyncStorage.multiRemove(sessionKeys);
    }
    
    // Clear secure credentials
    await Keychain.resetGenericPassword();
    
    return true;
  } catch (error) {
    throw error;
  }
},

  // Get tenant ID
  async getTenantId() {
    return await AsyncStorage.getItem(SESSION_CONFIG.KEYS.TENANT_ID);
  },

  // Update last active time
  async updateLastActive() {
    await AsyncStorage.setItem(SESSION_CONFIG.KEYS.LAST_ACTIVE, Date.now().toString());
  }
};