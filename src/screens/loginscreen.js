
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
              const checkAutoLogin = async () => {
                const isValid = await SessionService.isSessionValid();
                
                if (isValid) {
                  const tenantId = await SessionService.getTenantId();
                  
                  if (tenantId) {
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
                  
                  setIsBiometricSupported(available);
                  setBiometricType(biometryType);
                  
                  const credentials = await AuthService.getSavedCredentials();
                  
                  if (credentials) {
                    setEmail(credentials.username);
                  }
                } catch (error) {
                  console.error('[Login] Biometric initialization error:', error);
                } finally {
                  setIsBiometricChecked(true);
                }
              };

              initBiometrics();
            }, []);

            const updateLastActive = async () => {
              const now = Date.now();
              await AsyncStorage.setItem('@last_active', now.toString());
            };

            // Handle biometric login
            const handleBiometricLogin = async () => {
              if (!isBiometricSupported) {
                Alert.alert('Error', 'Biometric authentication not available');
                return;
              }

              try {
                const credentials = await AuthService.getSavedCredentials();
                
                if (!credentials) {
                  Alert.alert('Error', 'No enrolled fingerprint found. Please login with email/password first.');
                  return;
                }

                const success = await BiometricService.authenticate('Authenticate to login');
                
                if (success) {
                  setEmail(credentials.username);
                  setPassword(credentials.password);
                  
                  setIsLoading(true);
                  try {
                    const { tenants, count } = await TenantService.getTenants(credentials.username);
                    
                    setTenants(tenants);
                    if (count === 1) {
                      const { token, webViewUrl } = await AuthService.getToken(tenants[0].tenant_id, credentials.username, credentials.password);
                      navigation.replace('Dashboard', { webViewUrl });
                    } else if (count > 1) {
                      setShowTenantModal(true);
                    }
                  } catch (error) {
                    console.error('[Login] Tenant fetch error:', error);
                    Alert.alert('Error', error.message || 'Failed to fetch tenant information');
                  } finally {
                    setIsLoading(false);
                  }
                }
              } catch (error) {
                console.error('[Login] Biometric authentication error:', error);
                Alert.alert('Error', `Authentication failed: ${error.message}`);
              }
            };

            // Handle tenant selection
            const handleTenantSelect = async (tenant) => {
              setShowTenantModal(false);
              setIsLoading(true);

              try {
                const { token, webViewUrl } = await AuthService.getToken(tenant.tenant_id, email, password);
                setWebViewUrl(webViewUrl);
                setShowWebView(true);
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
              if (!email || !password) {
                Alert.alert('Error', 'Please enter both email and password');
                return;
              }

              setIsLoading(true);
              try {
                const { tenants, count } = await TenantService.getTenants(email);
                
                setTenants(tenants);
                
                if (isBiometricSupported) {
                  const existingCredentials = await AuthService.getSavedCredentials();
                  
                  if (!existingCredentials) {
                    setTempCredentials({ email, password });
                    setShowEnrollBiometricModal(true);
                    setIsLoading(false);
                    return;
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
                const success = await BiometricService.authenticate('Verify your fingerprint to enable login');
                
                if (success) {
                  await AuthService.saveCredentials(tempCredentials.email, tempCredentials.password);
                  
                  if (tenants.length === 1) {
                    const { token, webViewUrl } = await AuthService.getToken(tenants[0].tenant_id, tempCredentials.email, tempCredentials.password);
                    navigation.replace('Dashboard', { webViewUrl });
                  } else if (tenants.length > 1) {
                    setShowTenantModal(true);
                  }
                }
              } catch (error) {
                console.error('[Login] Biometric enrollment error:', error);
                alert('Failed to enable fingerprint login');
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
    
  const onShouldStartLoadWithRequest = (request) => {



    // Add any URL filtering logic here if needed
    return true;
  };

  const injectJavaScript = `
    setTimeout(() => {
      try {
        // Get token from the API response
        const token = window.localStorage.getItem('authToken');
        
        if (!token) {
          // If token not found, we might need to handle that case
          window.ReactNativeWebView.postMessage('No token found');
          return;
        }

        // Update localStorage and cookies if needed
        window.localStorage.setItem('authToken', token);
        
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