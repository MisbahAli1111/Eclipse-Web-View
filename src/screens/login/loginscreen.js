
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReactNativeBiometrics from 'react-native-biometrics';
import { AppState } from 'react-native';
import { SessionService } from '../../services/session';
import { LoginForm } from '../../components/LoginForm';
import { BiometricModal } from '../../components/BiometricModal';
import { AuthService } from '../../services/api/AuthService';
import { BiometricService } from '../../services/api/BiometricService';
import { getDashboardUrl } from '../../services/api/config';
import { NotificationService } from '../../services/NotificationService';
// Create biometric instance once
const rnBiometrics = new ReactNativeBiometrics();

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [postEnrollWebViewUrl, setPostEnrollWebViewUrl] = useState(null);
  const [biometricType, setBiometricType] = useState(null);
  const [isBiometricChecked, setIsBiometricChecked] = useState(false); // NEW
  const [showEnrollBiometricModal, setShowEnrollBiometricModal] = useState(false);
  const [isEnrollingBiometric, setIsEnrollingBiometric] = useState(false);
  const [tempCredentials, setTempCredentials] = useState(null);


  // Check for auto-login on component mount
        useEffect(() => {
              const checkAutoLogin = async () => {
                const isValid = await SessionService.isSessionValid();
                const tenantId = isValid ? await SessionService.getTenantId() : null;
                if (isValid && tenantId) {
                  navigation.replace('Dashboard', {
                    webViewUrl: getDashboardUrl(tenantId)
                  });
                }
              };
              checkAutoLogin();
            }, [navigation]);



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
              } finally {
                setIsBiometricChecked(true);
              }
            };

                          // Setup notifications and get FCM token
              const setupNotifications = async () => {
                const { permissionGranted, fcmToken } = await NotificationService.setupNotifications();
                
                if (permissionGranted && fcmToken) {
                }
              };

              const handleAppStateChange = async (nextAppState) => {
                if (nextAppState === 'active') {
                  const isValid = await SessionService.isSessionValid();
                  if (!isValid) {
                    await SessionService.clearSession();
                  }
                }
              };
              
              useEffect(() => {
                initBiometrics();
                setupNotifications();
              
                const subscription = AppState.addEventListener('change', handleAppStateChange);
              
                return () => {
                  subscription.remove();
                };
              }, []);

            // Handle biometric login (play flow: single login API)
            const handleBiometricLogin = async () => {
              if (!isBiometricSupported) {
                Alert.alert('Error', 'Biometric authentication not available');
                return;
              }

              try {
                const credentials = await AuthService.getSavedCredentials();
                if (!credentials?.username || !credentials?.password) {
                  Alert.alert('Error', 'No enrolled biometric credentials found. Please login with email/password first.');
                  return;
                }

                const promptMessage = biometricType === 'FaceID' ? 'Use Face ID to login' : 'Use fingerprint to login';
                const success = await BiometricService.authenticate(promptMessage);
                if (!success) return;

                setEmail(credentials.username);
                setPassword(credentials.password);
                setIsLoading(true);
                try {
                  const result = await AuthService.login(credentials.username, credentials.password);
                  navigation.replace('Dashboard', { webViewUrl: result.webViewUrl });
                } catch (error) {
                  let errorMessage = error.message || 'Authentication failed.';
                  if (error.message?.includes('invalid') || error.message?.includes('not found')) {
                    try { await AuthService.clearCredentials(); } catch (e) {}
                    errorMessage = 'Saved credentials may be outdated. Please login with email/password.';
                  }
                  Alert.alert('Biometric Login Failed', errorMessage);
                } finally {
                  setIsLoading(false);
                }
              } catch (error) {
                const errorMessage = error.code === 'UserCancel' ? 'Authentication cancelled.' : (error.userMessage || error.message || 'Biometric authentication failed.');
                Alert.alert('Biometric Failed', errorMessage.length > 200 ? 'Please try again or use your password.' : errorMessage);
              }
            };

            // Handle regular login (play flow: single login API)
            const handleLogin = async () => {
              if (!email || !password) {
                Alert.alert('Error', 'Please enter both email and password');
                return;
              }

              setIsLoading(true);
              try {
                const result = await AuthService.login(email, password);

                if (isBiometricSupported) {
                  const existingCredentials = await AuthService.getSavedCredentials();
                  if (existingCredentials?.username !== email) {
                    setTempCredentials({ email, password });
                    setPostEnrollWebViewUrl(result.webViewUrl);
                    setShowEnrollBiometricModal(true);
                    setIsLoading(false);
                    return;
                  }
                  if (!existingCredentials) {
                    setTempCredentials({ email, password });
                    setPostEnrollWebViewUrl(result.webViewUrl);
                    setShowEnrollBiometricModal(true);
                    setIsLoading(false);
                    return;
                  }
                  try {
                    await AuthService.saveCredentials(email, password);
                  } catch (e) {}
                }

                navigation.replace('Dashboard', { webViewUrl: result.webViewUrl });
              } catch (error) {
                Alert.alert('Error', error.message || 'Login failed. Please try again.');
              } finally {
                setIsLoading(false);
              }
            };

            // Handle biometric enrollment
            const handleEnrollBiometric = async () => {
              if (!tempCredentials) return;

              setIsEnrollingBiometric(true);
              try {
                const promptMessage = biometricType === 'FaceID' ? 'Verify your Face ID to enable login' : 'Verify your fingerprint to enable login';
                const success = await BiometricService.authenticate(promptMessage);
                if (success) {
                  await AuthService.saveCredentials(tempCredentials.email, tempCredentials.password);
                  setShowEnrollBiometricModal(false);
                  setTempCredentials(null);
                  const url = postEnrollWebViewUrl || getDashboardUrl('bronze');
                  setPostEnrollWebViewUrl(null);
                  navigation.replace('Dashboard', { webViewUrl: url });
                }
              } catch (error) {
                const biometricName = biometricType === 'FaceID' ? 'Face ID' : 'fingerprint';
                let errorMessage = error.userMessage || error.message || `Failed to enable ${biometricName}.`;
                if (errorMessage.length > 200 || errorMessage.includes('Error Domain')) {
                  errorMessage = `${biometricName} setup was cancelled. You can enable it later in settings.`;
                }
                Alert.alert(error.code === 'UserCancel' ? 'Setup Cancelled' : 'Setup Failed', errorMessage);
              } finally {
                setIsEnrollingBiometric(false);
                setShowEnrollBiometricModal(false);
                setTempCredentials(null);
              }
            };

            const proceedAfterEnrollment = () => {
              const url = postEnrollWebViewUrl || getDashboardUrl('bronze');
              setPostEnrollWebViewUrl(null);
              navigation.replace('Dashboard', { webViewUrl: url });
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
          tenants={[]}
          handleTenantSelect={() => {}}
          proceedAfterEnrollment={proceedAfterEnrollment}
          biometricType={biometricType}
          setShowTenantModal={() => {}}
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
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
});