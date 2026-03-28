import * as Keychain from 'react-native-keychain';
import { SessionService } from '../session';
import { getAuthUrl, getDashboardUrl } from './config';

/** Build session extras for admin-style (nested user) or provider-style (flat profile on data). */
function sessionExtrasFromLoginData(data) {
  const {
    token: _token,
    remember_token,
    token_type,
    time_format,
    date_format,
    timezone_id,
    user,
    tenant,
    permissions,
    access_info,
    ...rest
  } = data;

  if (user != null && typeof user === 'object') {
    return {
      remember_token,
      token_type,
      time_format,
      date_format,
      timezone_id,
      user,
      tenant,
      permissions,
      access_info,
    };
  }

  const hasProviderProfile =
    rest.uid != null ||
    rest.provider_id != null ||
    rest.user_name != null;

  return {
    remember_token,
    token_type,
    time_format,
    date_format,
    timezone_id,
    user: hasProviderProfile ? rest : undefined,
    tenant,
    permissions,
    access_info,
  };
}

function isLoginSuccess(response, body) {
  const token = body?.data?.token;
  if (!response.ok || !token) return false;
  if (body.success === true) return true;
  if (body.status_code === 200) return true;
  return false;
}

export const AuthService = {

  async getToken(tenantId, email, password) {
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

    if (!isLoginSuccess(response, response_json)) {
      throw new Error(response_json.message || 'Failed to login');
    }

    const { token } = response_json.data;
    const extras = sessionExtrasFromLoginData(response_json.data);

    await SessionService.saveSession(tenantId, email, token, extras);

    return {
      success: true,
      token,
      webViewUrl: getDashboardUrl(tenantId),
    };
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