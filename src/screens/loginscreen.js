
// screens/LoginScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReactNativeBiometrics from 'react-native-biometrics';
import { AppState } from 'react-native';
import { SessionService } from '../services/session';
import { LoginForm } from '../components/LoginForm';
import { BiometricModal } from '../components/BiometricModal';
import { TenantModal } from '../components/TenantModal';
import { AuthService } from '../services/api/AuthService';
import { TenantService } from '../services/api/TenantService';
import { BiometricService } from '../services/api/BiometricService';
import { getDashboardUrl } from '../services/api/config';
import CrashAnalyticsService from '../services/CrashAnalyticsService';
import analytics from '@react-native-firebase/analytics';
// Create biometric instance once
const rnBiometrics = new ReactNativeBiometrics();

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');
  // NEW: Biometric state variables
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [isBiometricChecked, setIsBiometricChecked] = useState(false); // NEW
  const [showEnrollBiometricModal, setShowEnrollBiometricModal] = useState(false);
  const [isEnrollingBiometric, setIsEnrollingBiometric] = useState(false);
  const [tempCredentials, setTempCredentials] = useState(null);

  useEffect(() => {
    CrashAnalyticsService.logScreenView('LoginScreen');
  }, []);

  // Check for auto-login on component mount
        useEffect(() => {
              const checkAutoLogin = async () => {
                const isValid = await SessionService.isSessionValid();
                
                if (isValid) {
                  const tenantId = await SessionService.getTenantId();
                  
                  if (tenantId) {
                    navigation.replace('Dashboard', {
                      webViewUrl: getDashboardUrl(tenantId)
                    });
                  }
                }
              };
              checkAutoLogin();
            }, [navigation]);

            // App state handler
            useEffect(() => {
              const handleAppStateChange = async (nextAppState) => {
                
                if (nextAppState === 'active') {
                  
                  const isValid = await SessionService.isSessionValid();
                  
                  if (!isValid) {
                    await SessionService.clearSession();
                    setShowWebView(false);
                  }
                }
              };

              const subscription = AppState.addEventListener('change', handleAppStateChange);
              return () => {
                subscription.remove();
              };
            }, []);

            // Biometrics initialization
            useEffect(() => {
              const initBiometrics = async () => {
                try {
                  const { available, biometryType } = await rnBiometrics.isSensorAvailable();
                  
                  console.log('[Login] Biometric availability:', { available, biometryType });
                  
                  setIsBiometricSupported(available);
                  setBiometricType(biometryType);
                  
                  const credentials = await AuthService.getSavedCredentials();
                  console.log('[Login] Saved credentials found:', !!credentials);
                  
                  if (credentials) {
                    setEmail(credentials.username);
                  }
                } catch (error) {
                  console.error('[Login] Biometric initialization error:', error);
                  CrashAnalyticsService.recordError(error, 'Biometric Initialization');
                } finally {
                  setIsBiometricChecked(true);
                }
              };

              initBiometrics();
            }, []);

            // Handle biometric login
            const handleBiometricLogin = async () => {
              if (!isBiometricSupported) {
                Alert.alert('Error', 'Biometric authentication not available');
                return;
              }

              try {
                const credentials = await AuthService.getSavedCredentials();
                console.log('[Login] Retrieved credentials for Face ID:', { 
                  hasCredentials: !!credentials,
                  hasUsername: !!credentials?.username,
                  hasPassword: !!credentials?.password,
                  username: credentials?.username 
                });
                
                if (!credentials || !credentials.username || !credentials.password) {
                  Alert.alert('Error', 'No enrolled biometric credentials found. Please login with email/password first.');
                  return;
                }

                const promptMessage = biometricType === 'FaceID' 
                  ? 'Use Face ID to login' 
                  : 'Use fingerprint to login';
                const success = await BiometricService.authenticate(promptMessage);
                
                if (success) {
                  setEmail(credentials.username);
                  setPassword(credentials.password);
                  
                  setIsLoading(true);
                  try {
                    console.log('[Login] Attempting Face ID login with:', credentials.username);
                    const { tenants, count } = await TenantService.getTenants(credentials.username, credentials.password);
                    
                    console.log('[Login] Face ID tenant fetch successful:', { count, tenants: tenants?.length });
                    
                    // Log successful biometric login
                    await analytics().logLogin({
                      method: 'biometric',
                    });
                    
                    setTenants(tenants);
                    if (count === 1) {
                      const { token, webViewUrl } = await AuthService.getToken(tenants[0].tenant_id, credentials.username, credentials.password);
                      navigation.replace('Dashboard', { webViewUrl });
                    } else if (count > 1) {
                      setShowTenantModal(true);
                    } else {
                      Alert.alert('Error', 'No organizations found for this account');
                    }
                  } catch (error) {
                    console.error('[Login] Face ID tenant fetch error:', error);
                    CrashAnalyticsService.logAuthFailure(error, 'biometric');
                    
                    // Log failed biometric login
                    await analytics().logEvent('login_failed', {
                      method: 'biometric',
                      error_message: error.message || 'Unknown error',
                    });
                    
                    // Provide more specific error messages
                    let errorMessage = 'Authentication failed. ';
                    if (error.message?.includes('not found') || error.message?.includes('invalid credentials')) {
                      errorMessage += 'The saved credentials may be outdated. Please login with email/password to refresh your credentials.';
                      
                      // Clear outdated credentials
                      try {
                        await AuthService.clearCredentials();
                        console.log('[Login] Cleared outdated credentials from keychain');
                      } catch (clearError) {
                        console.error('[Login] Error clearing credentials:', clearError);
                      }
                    } else {
                      errorMessage += error.message || 'Please try again or login with email/password.';
                    }
                    
                    Alert.alert('Face ID Login Failed', errorMessage);
                  } finally {
                    setIsLoading(false);
                  }
                }
              } catch (error) {
                console.error('[Login] Biometric authentication error:', error);
                
                // Use the structured error message if available, otherwise fallback to generic message
                let errorMessage = error.userMessage || error.message || 'Face ID authentication failed. Please try again or use your password to login.';
                
                // Safety check: if the error message contains iOS domain information, use a clean message
                if (errorMessage.includes('com.apple.LocalAuthentication') || errorMessage.includes('Error Domain') || errorMessage.length > 200) {
                  errorMessage = 'Face ID authentication was cancelled. Please try again or use your password to login.';
                }
                
                const errorTitle = error.code === 'UserCancel' ? 'Authentication Cancelled' : 'Face ID Authentication Failed';
                
                Alert.alert(errorTitle, errorMessage);
              }
            };

            // Handle tenant selection
            const handleTenantSelect = async (tenant) => {
              setShowTenantModal(false);
              setIsLoading(true);

              try {
                const { token, webViewUrl } = await AuthService.getToken(tenant.tenant_id, email, password);
                console.log('[Login] Tenant selection successful:', { token, webViewUrl });
                
                // Log successful authentication
                await CrashAnalyticsService.logUserSignIn({
                  email: email,
                  username: email,
                  tenant_id: tenant.tenant_id,
                });
                
                // Log tenant selection
                await analytics().logEvent('tenant_selected', {
                  tenant_id: tenant.tenant_id,
                  tenant_name: tenant.tenant_name || 'Unknown',
                });
                
                setWebViewUrl(webViewUrl);
                setShowWebView(true);
                navigation.replace('Dashboard');
              } catch (error) {
                console.error('[Login] Tenant selection error:', error);
                CrashAnalyticsService.logCriticalFailure('Tenant Selection', error);
                
                // Log tenant selection failure
                await analytics().logEvent('tenant_selection_failed', {
                  tenant_id: tenant.tenant_id,
                  error_message: error.message || 'Unknown error',
                });
                
                alert(`Login failed: ${error.message}`);
              } finally {
                setIsLoading(false);
              }
            };

            // Handle regular login
            const handleLogin = async () => {
              if (!email || !password) {
                Alert.alert('Error', 'Please enter both email and password');
                return;
              }

              setIsLoading(true);
              try {
                console.log('[Login] Attempting regular login with:', email);
                const { tenants, count } = await TenantService.getTenants(email , password);
                
                console.log('[Login] Regular login successful:', { count, tenants: tenants?.length });
                
                // Log successful login
                await analytics().logLogin({
                  method: 'email_password',
                });
                
                setTenants(tenants);
                
                // Only offer biometric enrollment AFTER successful API response
                if (isBiometricSupported && count > 0) {
                  const existingCredentials = await AuthService.getSavedCredentials();
                  
                  // If credentials exist but are different from current login, update them
                  if (existingCredentials && existingCredentials.username !== email) {
                    console.log('[Login] Updating stored credentials for new user');
                    setTempCredentials({ email, password });
                    setShowEnrollBiometricModal(true);
                    setIsLoading(false);
                    return;
                  }
                  
                  // If no credentials exist, offer enrollment
                  if (!existingCredentials) {
                    setTempCredentials({ email, password });
                    setShowEnrollBiometricModal(true);
                    setIsLoading(false);
                    return;
                  }
                  
                  // If same user, just update the password in case it changed
                  if (existingCredentials && existingCredentials.username === email) {
                    try {
                      await AuthService.saveCredentials(email, password);
                      console.log('[Login] Updated stored credentials for existing user');
                    } catch (updateError) {
                      console.error('[Login] Failed to update stored credentials:', updateError);
                    }
                  }
                }
                
                if (count === 1) {
                  handleTenantSelect(tenants[0]);
                } else if (count > 1) {
                  setShowTenantModal(true);
                } else {
                  Alert.alert('Error', 'No organizations found for this email address');
                }
              } catch (error) {
                console.error('[Login] Login error:', error);
                CrashAnalyticsService.logAuthFailure(error, 'password');
                
                // Log failed login
                await analytics().logEvent('login_failed', {
                  method: 'email_password',
                  error_message: error.message || 'Unknown error',
                });
                
                Alert.alert('Error', error.message || 'Login failed. Please try again.');
              } finally {
                setIsLoading(false);
              }
            };

            // Handle biometric enrollment
            const handleEnrollBiometric = async () => {
              if (!tempCredentials) {
                return;
              }

              setIsEnrollingBiometric(true);
              try {
                const biometricName = biometricType === 'FaceID' ? 'Face ID' : 'fingerprint';
                const promptMessage = biometricType === 'FaceID' 
                  ? 'Verify your Face ID to enable login' 
                  : 'Verify your fingerprint to enable login';
                
                const success = await BiometricService.authenticate(promptMessage);
                
                if (success) {
                  // Save credentials only after successful biometric authentication
                  await AuthService.saveCredentials(tempCredentials.email, tempCredentials.password);
                  
                  // Proceed with login flow
                  if (tenants.length === 1) {
                    handleTenantSelect(tenants[0]);
                  } else if (tenants.length > 1) {
                    setShowTenantModal(true);
                  }
                }
              } catch (error) {
                console.error('[Login] Biometric enrollment error:', error);
                const biometricName = biometricType === 'FaceID' ? 'Face ID' : 'fingerprint';
                
                // Use the structured error message if available
                let errorMessage = error.userMessage || `Failed to enable ${biometricName} login. ${error.message || 'Please try again.'}`;
                
                // Safety check: if the error message contains iOS domain information, use a clean message
                if (errorMessage.includes('com.apple.LocalAuthentication') || errorMessage.includes('Error Domain') || errorMessage.length > 200) {
                  errorMessage = `${biometricName} setup was cancelled. You can enable it later in the app settings.`;
                }
                
                const errorTitle = error.code === 'UserCancel' ? 'Setup Cancelled' : `${biometricName} Setup Failed`;
                
                Alert.alert(errorTitle, errorMessage);
              } finally {
                setIsEnrollingBiometric(false);
                setShowEnrollBiometricModal(false);
                setTempCredentials(null);
              }
            };
                        


             const proceedAfterEnrollment = () => {
              if (tenants.length === 1) {
                handleTenantSelect(tenants[0]);
              } else if (tenants.length > 1) {
                setShowTenantModal(true);
              } else {
                alert('No organizations found for this email address');
              }
            };
    

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <LoginForm
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          handleLogin={handleLogin}
          handleBiometricLogin={handleBiometricLogin}
          isBiometricChecked={isBiometricChecked}
          isBiometricSupported={isBiometricSupported}
          biometricType={biometricType}
          isLoading={isLoading}
        />

        <BiometricModal
          showEnrollBiometricModal={showEnrollBiometricModal}
          setShowEnrollBiometricModal={setShowEnrollBiometricModal}
          handleEnrollBiometric={handleEnrollBiometric}
          isEnrollingBiometric={isEnrollingBiometric}
          tenants={tenants}
          handleTenantSelect={handleTenantSelect}
          proceedAfterEnrollment={proceedAfterEnrollment}
          biometricType={biometricType}
          setShowTenantModal={setShowTenantModal}
        />

        <TenantModal
          showTenantModal={showTenantModal}
          setShowTenantModal={setShowTenantModal}
          tenants={tenants}
          handleTenantSelect={handleTenantSelect}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // webview: {
  //   flex: 1,
  //   width: '100%',
  //   height: '100%',
  // },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  // webviewContainer: {
  //   padding: 0,
  //   paddingHorizontal: 0,
  // },
  
});