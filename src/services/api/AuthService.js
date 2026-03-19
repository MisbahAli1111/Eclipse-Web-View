import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { SessionService } from '../session';
import { getAuthUrl, getDashboardUrl, getLoginUrl } from './config';

const PLAY_TENANT_ID = 'bronze';

export const AuthService = {

  /** New play flow: single login API, returns token + full response; saves session and login response for WebView. */
  async login(email, password) {
    try {
      const loginUrl = getLoginUrl();
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data?.data?.token) {
        throw new Error(data.message || data?.data?.message || 'Login failed');
      }

      const token = data.data.token;
      await SessionService.saveSession(PLAY_TENANT_ID, email, token);
      await AsyncStorage.multiSet([
        ['@current_tenant', PLAY_TENANT_ID],
        ['@user_email', email],
        ['@last_active', Date.now().toString()],
        ['@auth_token', token],
        ['@login_response', JSON.stringify(data)],
      ]);

      const webViewUrl = getDashboardUrl(PLAY_TENANT_ID);
      return {
        success: true,
        token,
        webViewUrl,
        loginData: data,
      };
    } catch (error) {
      throw error;
    }
  },

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