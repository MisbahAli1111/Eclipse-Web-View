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

      const response_json = await response.json();
      console.log('AuthService getToken response: Success', response_json);

      if (response.ok && response_json.success && response_json.data?.token) {
        const {
          token,
          remember_token,
          token_type,
          time_format,
          date_format,
          timezone_id,
          user,
          tenant,
          permissions,
          access_info,
        } = response_json.data;

        await SessionService.saveSession(tenantId, email, token, {
          remember_token,
          token_type,
          time_format,
          date_format,
          timezone_id,
          user,
          tenant,
          permissions,
          access_info,
        });

        return {
          success: true,
          token,
          webViewUrl: getDashboardUrl(tenantId),
        };
      } else {
        throw new Error(response_json.message || 'Failed to login');
      }
    } catch (error) {
      throw error;
    }
  },

  async saveCredentials(email, password) {
    try {
      // If empty credentials are passed, clear the keychain
      if (!email || !password) {
        await Keychain.resetGenericPassword({
          service: 'com.EclipseAppView.auth'
        });
        console.log('[AuthService] Credentials cleared from keychain');
        return true;
      }
      
      await Keychain.setGenericPassword(email, password, {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: 'com.EclipseAppView.auth'
      });
      console.log('[AuthService] Credentials saved to keychain for:', email);
      return true;
    } catch (error) {
      console.error('[AuthService] Error saving credentials:', error);
      throw error;
    }
  },

  async clearCredentials() {
    try {
      await Keychain.resetGenericPassword({
        service: 'com.EclipseAppView.auth'
      });
      console.log('[AuthService] Credentials cleared from keychain');
      return true;
    } catch (error) {
      console.error('[AuthService] Error clearing credentials:', error);
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