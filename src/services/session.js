import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain'; // Add this import

const SESSION_CONFIG = {
  INACTIVITY_LIMIT: 30 * 24 * 60 * 60 * 1000, // 1 minute for testing  || 30 days in production  
  KEYS: {
    TENANT_ID: '@tenant_id',
    AUTH_TOKEN: '@auth_token',
    LAST_ACTIVE: '@last_active',
    USER_EMAIL: '@user_email',
    LOGIN_RESPONSE: '@login_response',
  }
};

export const SessionService = {
  // Save all session data
  async saveSession(tenantId, email, authToken) {
    const now = Date.now().toString();
    await AsyncStorage.multiSet([
      [SESSION_CONFIG.KEYS.TENANT_ID, tenantId],
      [SESSION_CONFIG.KEYS.AUTH_TOKEN, authToken],
      [SESSION_CONFIG.KEYS.LAST_ACTIVE, now],
      [SESSION_CONFIG.KEYS.USER_EMAIL, email]
    ]);
  },

  // Check if session is valid
  async isSessionValid() {
    const lastActive = await AsyncStorage.getItem(SESSION_CONFIG.KEYS.LAST_ACTIVE);
    const tenantId = await AsyncStorage.getItem(SESSION_CONFIG.KEYS.TENANT_ID);
    return !!(lastActive && tenantId && (Date.now() - parseInt(lastActive, 10)) <= SESSION_CONFIG.INACTIVITY_LIMIT);
  },

  // Clear session
 async clearSession() {
  try {
    // Get all keys first
    const allKeys = await AsyncStorage.getAllKeys();
    const sessionKeys = allKeys.filter(key => 
      key.startsWith('@last_active') || 
      key.startsWith('@current_tenant') ||
      key.startsWith('@user_email') ||
      key.startsWith('@auth_token') ||
      key.startsWith('@tenant_id') ||
      key.startsWith('@login_response')
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