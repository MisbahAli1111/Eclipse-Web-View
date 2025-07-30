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
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ReactNativeBiometrics from 'react-native-biometrics';
import * as Keychain from 'react-native-keychain'; // NEW: For secure credential storage

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

  


      
  
  
      // NEW: Check biometric support on component mount
        useEffect(() => {
        const initBiometrics = async () => {
          try {
            // Check biometric support
            const { available, biometryType } = await rnBiometrics.isSensorAvailable();
            setIsBiometricSupported(available);
            setBiometricType(biometryType);
            
            // Check for existing enrollment
            const credentials = await Keychain.getGenericPassword({
              service: 'com.EclipseAppView.auth'
            });
            
            if (credentials) {
              setEmail(credentials.username);
              console.log('Found existing biometric enrollment');
            }
          } catch (error) {
            console.error('Initialization error:', error);
          } finally {
            setIsBiometricChecked(true);
          }
        };

        initBiometrics();
      }, []);



  // NEW: Check if biometric auth is available
  const checkBiometricSupport = async () => {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      setIsBiometricSupported(available);
      setBiometricType(biometryType);
      console.log(`Biometrics available: ${available}, type: ${biometryType}`);
    } catch (error) {
      console.error('Biometric check error:', error);
    }
  };

  // NEW: Load saved credentials if they exist
  const loadSavedCredentials = async () => {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        setEmail(credentials.username);
        // Don't set password here for security
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    }
  };

  // NEW: Handle biometric authentication
           const handleBiometricLogin = async () => {
            if (!isBiometricSupported) {
              alert('Biometric authentication not available');
              return;
            }

            try {
              // Retrieve saved credentials
              const credentials = await Keychain.getGenericPassword({
                service: 'com.EclipseAppView.auth'
              });
              
              if (!credentials) {
                alert('No enrolled fingerprint found. Please login with email/password first.');
                return;
              }

              // Authenticate with biometrics
              const { success } = await rnBiometrics.simplePrompt({
                promptMessage: 'Authenticate to login',
                cancelButtonText: 'Cancel'
              });

              if (success) {
                // Set credentials in state
                setEmail(credentials.username);
                setPassword(credentials.password);
                
                // Directly fetch tenants without going through handleLogin()
                setIsLoading(true);
                try {
                  const response = await fetch('https://test.stg-tenant.eclipsescheduling.com/api/tenant-users/search', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    body: JSON.stringify({ email: credentials.username }),
                  });

                  const data = await response.json();
                  
                  if (data.success) {
                    setTenants(data.data);
                    if (data.count === 1) {
                      handleTenantSelect(data.data[0]);
                    } else if (data.count > 1) {
                      setShowTenantModal(true);
                    }
                  } else {
                    alert(data.message || 'Failed to fetch tenant information');
                  }
                } catch (error) {
                  console.error('Tenant fetch error:', error);
                  alert('Failed to fetch tenant information');
                } finally {
                  setIsLoading(false);
                }
              }
            } catch (error) {
              console.error('Biometric auth error:', error);
              alert(`Authentication failed: ${error.message}`);
            }
          };

  // NEW: Save credentials after successful login
  const saveCredentials = async () => {
    try {
      await Keychain.setGenericPassword(email, password);
      console.log('Credentials saved securely');
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  };




  // YOUR ORIGINAL handleTenantSelect FUNCTION
  const handleTenantSelect = async (tenant) => {
    console.log('Selected tenant:', tenant.tenant_id);
    setShowTenantModal(false);
    setIsLoading(true);

    try {
      const tokenUrl = `https://${tenant.tenant_id}.stg-tenant.eclipsescheduling.com/api/auth/token`;
      console.log('Token API URL:', tokenUrl);

      const requestBody = {
        email: email,
        password: password
      };
      console.log('Token request body:', requestBody);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('Token API response:', data);

      if (response.ok && data.token) {
        // Successfully got token
        console.log('Login successful');

        // Prepare the script to save token in localStorage
        const saveTokenScript = `
          localStorage.setItem('authToken', '${data.token}');
          localStorage.setItem('userEmail', '${email}');
          true;
        `;

        // Set WebView URL to dashboard
        const webViewUrl = `https://${tenant.tenant_id}.stg-tenant.eclipsescheduling.com/v1/provider/dashboard`;
        console.log('Loading WebView:', webViewUrl);
        setWebViewUrl(webViewUrl);

        // Inject the token and show WebView
        setShowWebView(true);
      } else {
        // Handle error response
        const errorMessage = data.message || 'Failed to login';
        console.error('Login failed:', errorMessage);
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Token API error:', error);
      alert('Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // REST OF YOUR ORIGINAL FUNCTIONS REMAIN UNCHANGED
  const handleNavigationChange = (navState) => {
    const url = navState.url;
    console.log('WebView URL:', url);

    if (url.includes('/v1/login')) {
      console.log('Detected login redirect → closing WebView');

      // Close WebView and go to Native Login screen
      setShowWebView(false); // hide WebView
      navigation.replace('Login');
    }
  };


                     const handleLogin = async () => {
                      if (!email || !password) {
                        alert('Please enter both email and password');
                        return;
                      }

                      setIsLoading(true);
                      try {
                        const response = await fetch('https://test.stg-tenant.eclipsescheduling.com/api/tenant-users/search', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                          },
                          body: JSON.stringify({ email }),
                        });

                        const data = await response.json();

                        if (data.success) {
                          setTenants(data.data);
                          
                          // Check if biometrics are supported and not already enrolled
                          if (isBiometricSupported) {
                            const existingCredentials = await Keychain.getGenericPassword({
                              service: 'com.EclipseAppView.auth'
                            });
                            
                            if (!existingCredentials) {
                              // Store the tenants data and show biometric modal first
                              setTempCredentials({ email, password });
                              setShowEnrollBiometricModal(true);
                              setIsLoading(false);
                              return; // Exit here to show biometric modal
                            }
                          }
                          
                          // If no biometric enrollment needed, proceed to tenant selection
                          if (data.count === 1) {
                            handleTenantSelect(data.data[0]);
                          } else if (data.count > 1) {
                            setShowTenantModal(true);
                          } else {
                            alert('No organizations found for this email address');
                          }
                        } else {
                          alert(data.message || 'Login failed');
                        }
                      } catch (error) {
                        console.error('Login error:', error);
                        alert('Login failed. Please try again.');
                      } finally {
                        setIsLoading(false);
                      }
                    };



             const handleEnrollBiometric = async () => {
              if (!tempCredentials) return;

              setIsEnrollingBiometric(true);
              try {
                const { success } = await rnBiometrics.simplePrompt({
                  promptMessage: 'Verify your fingerprint to enable login',
                  cancelButtonText: 'Cancel'
                });

                if (success) {
                  await Keychain.setGenericPassword(
                    tempCredentials.email,
                    tempCredentials.password,
                    {
                      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
                      service: 'com.EclipseAppView.auth'
                    }
                  );
                  
                  console.log('Biometric enrollment successful');
                  //alert('Fingerprint login enabled successfully!');
                  
                  // After enrollment, handle tenant selection
                  if (tenants.length === 1) {
                    handleTenantSelect(tenants[0]);
                  } else if (tenants.length > 1) {
                    setShowTenantModal(true);
                  }
                }
              } catch (error) {
                console.error('Biometric enrollment error:', error);
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
      <View style={[styles.container, showWebView ? styles.webviewContainer : null]}>
        {showWebView ? (
          <WebView
            source={{ uri: webViewUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            cacheEnabled={true}
            sharedCookiesEnabled={true}
            mixedContentMode="always"
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={handleNavigationChange}
            injectedJavaScript={injectJavaScript}
            onMessage={(event) => console.log('WebView message:', event.nativeEvent.data)}
          />
        ) : (
          <>
            <Image source={require('../../assets/logo.png')} style={styles.logo} />

            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Login to continue</Text>

            {/* Email Field */}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Password Field */}
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
            />

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotContainer}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginText}>Login</Text>
            </TouchableOpacity>

            {/* NEW: Biometric Login Button - Only shown if supported */}
            {isBiometricChecked && isBiometricSupported && (
            <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricLogin}
             >
              <Image
                source={
                  biometricType === 'FaceID'
                    ? require('../../assets/face-id.png')
                    : require('../../assets/fingerprint-scan.png')
                }
                style={styles.biometricIcon}
              />
              <Text style={styles.biometricText}>
                {biometricType === 'FaceID' ? 'Use Face ID' : 'Use Biometrics'}
              </Text>
            </TouchableOpacity>
)}


            
            

            {/* Optional - Signup */}
            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don’t have an account? </Text>
              <TouchableOpacity>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>



            {/* Biometric Enrollment Modal */}
                              <Modal
                            visible={showEnrollBiometricModal}
                            animationType="slide"
                            transparent={true}
                            onRequestClose={() => {
                              setShowEnrollBiometricModal(false);
                              proceedAfterEnrollment();
                            }}
                          >
                            <View style={styles.modalContainer}>
                              <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Enable Fingerprint Login</Text>
                                <Text style={styles.modalText}>
                                  Do you want to enable fingerprint login for future access?
                                </Text>
                                
                                <Image 
                                  source={require('../../assets/fingerprint-scan.png')} 
                                  style={styles.biometricIconLarge}
                                />
                                
                                <View style={styles.modalButtonContainer}>
                                  <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => {
                                      setShowEnrollBiometricModal(false);
                                      // Proceed with tenant selection after skipping enrollment
                                      if (tenants.length === 1) {
                                        handleTenantSelect(tenants[0]);
                                      } else if (tenants.length > 1) {
                                        setShowTenantModal(true);
                                      }
                                    }}
                                  >
                                    <Text style={styles.modalButtonText}>Skip</Text>
                                  </TouchableOpacity>
                                  
                                  <TouchableOpacity
                                    style={[styles.modalButton, styles.enrollButton]}
                                    onPress={handleEnrollBiometric}
                                    disabled={isEnrollingBiometric}
                                  >
                                    {isEnrollingBiometric ? (
                                      <ActivityIndicator color="#fff" />
                                    ) : (
                                      <Text style={styles.modalButtonText}>Enable</Text>
                                    )}
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </View>
                          </Modal>

            {/* Tenant Selection Modal */}
            <Modal
              visible={showTenantModal}
              animationType="slide"
              transparent={true}
            >
              <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Your Organization</Text>
                  <FlatList
                    data={tenants}
                    keyExtractor={(item) => item.tenant_id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.tenantItem}
                        onPress={() => handleTenantSelect(item)}
                      >
                        <Text style={styles.tenantText}>{item.tenant_id}</Text>
                      </TouchableOpacity>
                    )}
                  />
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowTenantModal(false)}
                  >
                    <Text style={styles.closeButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>


            

            {/* Loading Indicator */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  webviewContainer: {
    padding: 0,
    paddingHorizontal: 0,
  },
  logo: {
    width: 120,
    height: 120,
    alignSelf: 'center',
    marginBottom: 20,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 5,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  input: {
    height: 48,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    color: '#333',
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotText: {
    color: '#007AFF',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 25,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // NEW: Biometric button styles
  biometricButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 20,
  padding: 10,
},
  biometricIcon: {
  width: 24,
  height: 24,
  marginRight: 10,
},
  biometricText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupText: {
    fontSize: 14,
    color: '#666',
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  tenantItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tenantText: {
    fontSize: 16,
    color: '#333',
  },
  closeButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  biometricIconLarge: {
  width: 64,
  height: 64,
  alignSelf: 'center',
  marginVertical: 20,
},
modalText: {
  fontSize: 16,
  textAlign: 'center',
  marginBottom: 10,
  color: '#666',
},
modalButtonContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 20,
},
modalButton: {
  flex: 1,
  padding: 15,
  borderRadius: 8,
  alignItems: 'center',
  marginHorizontal: 5,
},
enrollButton: {
  backgroundColor: '#007AFF',
},
cancelButton: {
  backgroundColor: '#ccc',
},
modalButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
});
