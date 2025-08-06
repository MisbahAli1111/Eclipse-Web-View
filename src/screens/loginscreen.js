
// screens/LoginScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ReactNativeBiometrics from 'react-native-biometrics';
import * as Keychain from 'react-native-keychain'; // NEW: For secure credential storage
import AsyncStorage from '@react-native-async-storage/async-storage'; // NEW: For session management
import { AppState } from 'react-native';
import { SessionService } from '../services/session'; // Import your session service
import { WebViewComponent } from '../components/WebviewComponent';
import { LoginForm } from '../components/LoginForm';
import { BiometricModal } from '../components/BiometricModal';
import { TenantModal } from '../components/TenantModal';
import { AuthService } from '../services/api/AuthService';
import { TenantService } from '../services/api/TenantService';
import { BiometricService } from '../services/api/BiometricService';


// NEW: Create biometric instance once
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
  const [tempCredentials, setTempCredentials] = useState(null); // To hold credentials during enrollment


  // Top of file (after imports)
const SESSION_KEYS = ['@last_active', '@current_tenant', '@user_email'];
  // Add this constant near your other constants
const INACTIVITY_LIMIT = 30 * 24 * 60 * 60 * 1000; // 1 minute for testing  || 30 days in production  


  // Check for auto-login on component mount
        useEffect(() => {
              console.log('[Login] Component mounted - checking for auto-login');
              const checkAutoLogin = async () => {
                console.log('[Login] Checking session validity');
                const isValid = await SessionService.isSessionValid();
                console.log(`[Login] Session validity: ${isValid}`);
                
                if (isValid) {
                  console.log('[Login] Valid session found, getting tenant ID');
                  const tenantId = await SessionService.getTenantId();
                  console.log(`[Login] Tenant ID retrieved: ${tenantId || 'none'}`);
                  
                  if (tenantId) {
                    console.log('[Login] Navigating to Dashboard with tenant URL');
                    navigation.replace('Dashboard', {
                      webViewUrl: `https://${tenantId}.stg-tenant.eclipsescheduling.com/v1/provider/dashboard`
                    });
                  }
                }
              };
              checkAutoLogin();
            }, [navigation]);

            // App state handler
            useEffect(() => {
              console.log('[Login] Setting up app state listener');
              const handleAppStateChange = async (nextAppState) => {
                console.log(`[Login] App state changed to: ${nextAppState}`);
                
                if (nextAppState === 'active') {
                  console.log('[Login] App became active, checking session');
                  const isValid = await SessionService.isSessionValid();
                  console.log(`[Login] Session validity: ${isValid}`);
                  
                  if (!isValid) {
                    console.log('[Login] Invalid session, clearing and hiding WebView');
                    await SessionService.clearSession();
                    setShowWebView(false);
                  }
                }
              };

              const subscription = AppState.addEventListener('change', handleAppStateChange);
              return () => {
                console.log('[Login] Cleaning up app state listener');
                subscription.remove();
              };
            }, []);

            // Biometrics initialization
            useEffect(() => {
              console.log('[Login] Initializing biometric authentication');
              const initBiometrics = async () => {
                try {
                  console.log('[Login] Checking biometric sensor availability');
                  const { available, biometryType } = await rnBiometrics.isSensorAvailable();
                  console.log(`[Login] Biometric available: ${available}, type: ${biometryType}`);
                  
                  setIsBiometricSupported(available);
                  setBiometricType(biometryType);
                  
                  console.log('[Login] Checking for saved credentials');
                  const credentials = await AuthService.getSavedCredentials();
                  console.log(`[Login] Saved credentials found: ${!!credentials}`);
                  
                  if (credentials) {
                    console.log('[Login] Setting email from saved credentials');
                    setEmail(credentials.username);
                  }
                } catch (error) {
                  console.error('[Login] Biometric initialization error:', error);
                } finally {
                  console.log('[Login] Biometric check completed');
                  setIsBiometricChecked(true);
                }
              };

              initBiometrics();
            }, []);

            const updateLastActive = async () => {
              const now = Date.now();
              console.log(`[Login] Updating last active time: ${new Date(now).toISOString()}`);
              await AsyncStorage.setItem('@last_active', now.toString());
            };

            // Handle biometric login
            const handleBiometricLogin = async () => {
              console.log('[Login] Biometric login initiated');
              if (!isBiometricSupported) {
                console.log('[Login] Biometrics not supported on this device');
                Alert.alert('Error', 'Biometric authentication not available');
                return;
              }

              try {
                console.log('[Login] Retrieving saved credentials');
                const credentials = await AuthService.getSavedCredentials();
                
                if (!credentials) {
                  console.log('[Login] No biometric enrollment found');
                  Alert.alert('Error', 'No enrolled fingerprint found. Please login with email/password first.');
                  return;
                }

                console.log('[Login] Starting biometric authentication prompt');
                const success = await BiometricService.authenticate('Authenticate to login');
                
                if (success) {
                  console.log('[Login] Biometric authentication successful');
                  console.log('[Login] Setting credentials in state');
                  setEmail(credentials.username);
                  setPassword(credentials.password);
                  
                  setIsLoading(true);
                  try {
                    console.log('[Login] Fetching tenant information');
                    const { tenants, count } = await TenantService.getTenants(credentials.username);
                    console.log(`[Login] Found ${count} tenants`);
                    
                    setTenants(tenants);
                    if (count === 1) {
                      console.log('[Login] Single tenant found, proceeding with login');
                      const { token, webViewUrl } = await AuthService.getToken(tenants[0].tenant_id, credentials.username, credentials.password);
                      navigation.replace('Dashboard', { webViewUrl });
                    } else if (count > 1) {
                      console.log('[Login] Multiple tenants found, showing selection');
                      setShowTenantModal(true);
                    }
                  } catch (error) {
                    console.error('[Login] Tenant fetch error:', error);
                    Alert.alert('Error', error.message || 'Failed to fetch tenant information');
                  } finally {
                    setIsLoading(false);
                  }
                } else {
                  console.log('[Login] Biometric authentication cancelled or failed');
                }
              } catch (error) {
                console.error('[Login] Biometric authentication error:', error);
                Alert.alert('Error', `Authentication failed: ${error.message}`);
              }
            };

            // Handle tenant selection
            const handleTenantSelect = async (tenant) => {
              console.log(`[Login] Tenant selected: ${tenant.tenant_id}`);
              setShowTenantModal(false);
              setIsLoading(true);

              try {
                console.log('[Login] Getting token for selected tenant');
                const { token, webViewUrl } = await AuthService.getToken(tenant.tenant_id, email, password);
                console.log('[Login] Token received, setting WebView URL');
                setWebViewUrl(webViewUrl);
                setShowWebView(true);
                console.log('[Login] Navigating to Dashboard');
                navigation.replace('Dashboard');
              } catch (error) {
                console.error('[Login] Tenant selection error:', error);
                alert(`Login failed: ${error.message}`);
              } finally {
                setIsLoading(false);
              }
            };

            // Handle regular login
            const handleLogin = async () => {
              console.log(`[Login] Login initiated for email: ${email}`);
              if (!email || !password) {
                console.log('[Login] Validation failed - empty email or password');
                Alert.alert('Error', 'Please enter both email and password');
                return;
              }

              setIsLoading(true);
              try {
                console.log('[Login] Searching for tenants');
                const { tenants, count } = await TenantService.getTenants(email);
                console.log(`[Login] Found ${count} tenants`);
                
                setTenants(tenants);
                
                if (isBiometricSupported) {
                  console.log('[Login] Checking for existing biometric enrollment');
                  const existingCredentials = await AuthService.getSavedCredentials();
                  
                  if (!existingCredentials) {
                    console.log('[Login] No existing enrollment, showing biometric modal');
                    setTempCredentials({ email, password });
                    setShowEnrollBiometricModal(true);
                    setIsLoading(false);
                    return;
                  }
                }
                
                if (count === 1) {
                  console.log('[Login] Single tenant found, proceeding automatically');
                  handleTenantSelect(tenants[0]);
                } else if (count > 1) {
                  console.log('[Login] Multiple tenants found, showing selection');
                  setShowTenantModal(true);
                } else {
                  console.log('[Login] No organizations found');
                  Alert.alert('Error', 'No organizations found for this email address');
                }
              } catch (error) {
                console.error('[Login] Login error:', error);
                Alert.alert('Error', error.message || 'Login failed. Please try again.');
              } finally {
                setIsLoading(false);
              }
            };

            // Handle biometric enrollment
            const handleEnrollBiometric = async () => {
              console.log('[Login] Biometric enrollment initiated');
              if (!tempCredentials) {
                console.log('[Login] No temporary credentials for enrollment');
                return;
              }

              setIsEnrollingBiometric(true);
              try {
                console.log('[Login] Starting biometric enrollment prompt');
                const success = await BiometricService.authenticate('Verify your fingerprint to enable login');
                
                if (success) {
                  console.log('[Login] Biometric verified, saving credentials');
                  await AuthService.saveCredentials(tempCredentials.email, tempCredentials.password);
                  
                  if (tenants.length === 1) {
                    console.log('[Login] Single tenant found after enrollment');
                    const { token, webViewUrl } = await AuthService.getToken(tenants[0].tenant_id, tempCredentials.email, tempCredentials.password);
                    navigation.replace('Dashboard', { webViewUrl });
                  } else if (tenants.length > 1) {
                    console.log('[Login] Multiple tenants found after enrollment');
                    setShowTenantModal(true);
                  }
                }
              } catch (error) {
                console.error('[Login] Biometric enrollment error:', error);
                alert('Failed to enable fingerprint login');
              } finally {
                console.log('[Login] Cleaning up enrollment state');
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
    
  const onShouldStartLoadWithRequest = (request) => {



    // Add any URL filtering logic here if needed
    return true;
  };

  const injectJavaScript = `
    setTimeout(() => {
      try {
        // Get token from the API response
        const token = window.localStorage.getItem('authToken');
        console.log('Retrieved token from storage:', token ? 'Yes' : 'No');
        
        if (!token) {
          // If token not found, we might need to handle that case
          console.log('No token found in storage');
          window.ReactNativeWebView.postMessage('No token found');
          return;
        }

        // Update localStorage and cookies if needed
        window.localStorage.setItem('authToken', token);
        console.log('Token saved in localStorage');
        
        // Send success message back to React Native
        window.ReactNativeWebView.postMessage('Token injected successfully');

        // Send feedback to React Native
        window.ReactNativeWebView.postMessage('Credentials injected');
      } catch (error) {
        console.error('Auto-login script error:', error);
        window.ReactNativeWebView.postMessage('Error: ' + error.message);
      }
    }, 1500); // Increased delay to ensure page is fully loaded
    true;
  `;

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