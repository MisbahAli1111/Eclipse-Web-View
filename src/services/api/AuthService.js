import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { SessionService } from '../session';
import { getAuthUrl, getDashboardUrl } from './config';

export const AuthService = {

  async getToken(tenantId, email, password) {
    try {
      const tokenUrl = getAuthUrl(tenantId);
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok && data.token) {
        await SessionService.saveSession(tenantId, email, data.token);
        await AsyncStorage.multiSet([
          ['@current_tenant', tenantId],
          ['@user_email', email],
          ['@last_active', Date.now().toString()],
          ['@auth_token', data.token]
        ]);
        
        return {
          success: true,
          token: data.token,
          webViewUrl: getDashboardUrl(tenantId)
        };
      } else {
        throw new Error(data.message || 'Failed to login');
      }
    } catch (error) {
      throw error;
    }
  },

  async saveCredentials(email, password) {
    try {
      await Keychain.setGenericPassword(email, password, {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: 'com.EclipseAppView.auth'
      });
      return true;
    } catch (error) {
      throw error;
    }
  },

  async getSavedCredentials() {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'com.EclipseAppView.auth'
      });
      
      // Keychain returns false if no credentials are found
      if (credentials === false) {
        return null;
      }
      
      // Return the credentials in the expected format
      return {
        username: credentials.username,
        password: credentials.password
      };
    } catch (error) {
      console.error('[AuthService] Error getting saved credentials:', error);
      return null;
    }
  }
};