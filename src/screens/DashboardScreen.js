import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, BackHandler, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { SessionService } from '../services/session';
import { getDashboardUrl } from '../services/api/config';
import Loader from '../components/Loader';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const DashboardScreen = ({ navigation }) => {
  const [webViewUrl, setWebViewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef(null);

  const requestPermissions = async () => {
    try {
      let permissions = [];
      
      if (Platform.OS === 'android') {
        permissions = [
          PERMISSIONS.ANDROID.CAMERA,
          PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
          PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
        ];

        // For Android 13+ (API 33+), use new media permissions
        if (Platform.Version >= 33) {
          permissions.push(
            PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
            PERMISSIONS.ANDROID.READ_MEDIA_VIDEO
          );
        }
      } else if (Platform.OS === 'ios') {
        permissions = [
          PERMISSIONS.IOS.CAMERA,
          PERMISSIONS.IOS.PHOTO_LIBRARY,
        ];
      }

      console.log('Requesting permissions for file upload...');
      
      const results = await Promise.all(
        permissions.map(async (permission) => {
          const status = await check(permission);
          if (status !== RESULTS.GRANTED && status !== RESULTS.LIMITED) {
            console.log(`Requesting permission: ${permission}`);
            return await request(permission);
          }
          return status;
        })
      );

      console.log('Permission results:', results);
      
      // Check if we got the essential permissions
      const hasPermissions = results.some(result => result === RESULTS.GRANTED || result === RESULTS.LIMITED);
      
      if (!hasPermissions) {
        console.log('Permissions denied - preventing file picker');
        
        // Inject JavaScript to handle denied permissions gracefully
        const handleDeniedPermissionsScript = `
          (function() {
            try {
              // Find the active file input and prevent it from opening
              const activeElement = document.activeElement;
              if (activeElement && activeElement.type === 'file') {
                activeElement.blur();
                
                // Create a user-friendly message
                const message = document.createElement('div');
                message.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000; max-width: 300px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
                message.innerHTML = '<h3 style="margin: 0 0 10px 0; color: #495057;">Permissions Required</h3><p style="margin: 0; color: #6c757d;">Camera and photo access are needed to upload images. Please enable them in Settings and try again.</p><button onclick="this.parentElement.remove()" style="margin-top: 15px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>';
                
                document.body.appendChild(message);
                
                // Auto-remove after 5 seconds
                setTimeout(() => {
                  if (message.parentElement) {
                    message.remove();
                  }
                }, 5000);
              }
              
              window.ReactNativeWebView.postMessage('PERMISSIONS_HANDLED');
            } catch (error) {
              console.error('Error handling denied permissions:', error);
              window.ReactNativeWebView.postMessage('PERMISSION_HANDLER_ERROR:' + error.message);
            }
          })();
        `;
        
        webViewRef.current?.injectJavaScript(handleDeniedPermissionsScript);
        
        return false; // Indicate permissions were denied
      }
      
      return true; // Indicate permissions were granted
      
    } catch (error) {
      console.warn('Permission request failed:', error);
      
      // Inject error handling script
      const errorHandlingScript = `
        (function() {
          try {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.type === 'file') {
              activeElement.blur();
            }
            window.ReactNativeWebView.postMessage('PERMISSION_REQUEST_FAILED');
          } catch (e) {
            console.error('Error in permission error handler:', e);
          }
        })();
      `;
      
      webViewRef.current?.injectJavaScript(errorHandlingScript);
      
      Alert.alert('Error', 'Failed to request permissions for file upload.');
      return false;
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const isValid = await SessionService.isSessionValid();
        
        if (!isValid) {
          await SessionService.clearSession();
          navigation.replace('Login');
          return;
        }

        const tenantId = await SessionService.getTenantId();
        
        if (!tenantId) {
          throw new Error('No tenant information found');
        }

        const url = getDashboardUrl(tenantId);
        setWebViewUrl(url);
        setIsLoading(false);
        
        await SessionService.updateLastActive();
      } catch (error) {
        setHasError(true);
        Alert.alert('Error', 'Failed to load dashboard. Please login again.');
        await SessionService.clearSession();
        navigation.replace('Login');
      }
    };

    loadDashboard();

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        return true;
      }
    );

    return () => {
      backHandler.remove();
    };
  }, [navigation]);

  const handleNavigationChange = async (navState) => {
    setIsLoading(navState.loading);
    
    const url = navState.url;
    
    if (url.includes('/v1/login')) {
      await SessionService.clearSession();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }]
      });
    }
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    
    // Don't show error for minor issues like permission-related JavaScript errors
    if (nativeEvent.description && nativeEvent.description.includes('client-side exception')) {
      console.log('Handling client-side exception gracefully');
      return;
    }
    
    setHasError(true);
    setIsLoading(false);
    Alert.alert('Error', 'Failed to load dashboard content');
  };

  const injectJavaScript = `
  (function() {
    try {
      // 0. Set up global error handlers to prevent crashes
      window.addEventListener('error', function(event) {
        console.warn('Global error caught:', event.error);
        window.ReactNativeWebView.postMessage('GLOBAL_ERROR:' + (event.error ? event.error.message : 'Unknown error'));
        event.preventDefault(); // Prevent the error from bubbling up
        return true;
      });

      window.addEventListener('unhandledrejection', function(event) {
        console.warn('Unhandled promise rejection caught:', event.reason);
        window.ReactNativeWebView.postMessage('UNHANDLED_REJECTION:' + (event.reason ? event.reason.toString() : 'Unknown rejection'));
        event.preventDefault(); // Prevent the error from bubbling up
        return true;
      });

      // 1. First check if token exists in localStorage
      const existingToken = window.localStorage.getItem('authToken');
      if (existingToken) {
        window.ReactNativeWebView.postMessage('TOKEN_FOUND_IN_LOCALSTORAGE');
      } else {
        // 2. If no token, signal React Native to inject it
        window.ReactNativeWebView.postMessage('NEED_TOKEN_INJECTION');
      }

      // 3. Set up retry mechanism for token
      let retryCount = 0;
      const maxRetries = 5;
      const retryInterval = 1000;

      const checkForToken = () => {
        retryCount++;
        const token = window.localStorage.getItem('authToken');
        
        if (token) {
          window.ReactNativeWebView.postMessage('TOKEN_INJECTION_SUCCESS');
          return;
        }

        if (retryCount >= maxRetries) {
          window.ReactNativeWebView.postMessage('TOKEN_INJECTION_FAILED');
          return;
        }

        setTimeout(checkForToken, retryInterval);
      };

      // Initial check with slight delay
      if (!existingToken) {
        setTimeout(checkForToken, 500);
      }

      // 4. File upload handling - request permissions when file input is clicked
      document.addEventListener('click', function(event) {
        try {
          if (event.target.type === 'file' || (event.target.tagName === 'INPUT' && event.target.type === 'file')) {
            console.log('File input clicked - requesting permissions');
            window.ReactNativeWebView.postMessage('FILE_INPUT_CLICKED');
          }
        } catch (error) {
          console.warn('Error in click handler:', error);
          window.ReactNativeWebView.postMessage('CLICK_HANDLER_ERROR:' + error.message);
        }
      }, true);

      // 5. Monitor file input changes
      document.addEventListener('change', function(event) {
        try {
          if (event.target.type === 'file') {
            console.log('File input changed:', event.target.files);
            window.ReactNativeWebView.postMessage('FILE_INPUT_CHANGED:' + event.target.files.length);
          }
        } catch (error) {
          console.warn('Error in change handler:', error);
          window.ReactNativeWebView.postMessage('CHANGE_HANDLER_ERROR:' + error.message);
        }
      }, true);

      // 6. Monitor form submissions
      document.addEventListener('submit', function(event) {
        try {
          console.log('Form submitted:', event.target);
          window.ReactNativeWebView.postMessage('FORM_SUBMITTED');
        } catch (error) {
          console.warn('Error in submit handler:', error);
          window.ReactNativeWebView.postMessage('SUBMIT_HANDLER_ERROR:' + error.message);
        }
      }, true);

    } catch (error) {
      window.ReactNativeWebView.postMessage('SCRIPT_ERROR:' + error.message);
    }
    
    true;
  })();
  `;

  const handleWebViewMessage = async (event) => {
    const message = event.nativeEvent.data;
    console.log('WebView message received:', message);

    if (message === 'NEED_TOKEN_INJECTION') {
      try {
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) {
          const injectionScript = `
            try {
              window.localStorage.setItem('authToken', '${token.replace(/'/g, "\\'")}');
              window.sessionStorage.setItem('authToken', '${token.replace(/'/g, "\\'")}');
              window.ReactNativeWebView.postMessage('TOKEN_INJECTED');
            } catch (error) {
              window.ReactNativeWebView.postMessage('INJECTION_ERROR:' + error.message);
            }
            true;
          `;
          webViewRef.current?.injectJavaScript(injectionScript);
        }
      } catch (error) {
        console.error('Token injection failed:', error);
      }
    } else if (message === 'FILE_INPUT_CLICKED') {
      console.log('User clicked file input - requesting permissions now');
      const hasPermissions = await requestPermissions();
      console.log('Permission request result:', hasPermissions);
    } else if (message.startsWith('FILE_INPUT_CHANGED:')) {
      const fileCount = message.split(':')[1];
      console.log(`File input changed - ${fileCount} files selected`);
    } else if (message === 'FORM_SUBMITTED') {
      console.log('Form was submitted in WebView');
    } else if (message === 'PERMISSIONS_HANDLED') {
      console.log('Permission denial handled gracefully in WebView');
    } else if (message === 'PERMISSION_REQUEST_FAILED') {
      console.log('Permission request failed - handled in WebView');
    } else if (message.startsWith('PERMISSION_HANDLER_ERROR:')) {
      console.error('Permission handler error:', message.split(':')[1]);
    } else if (message.startsWith('GLOBAL_ERROR:')) {
      console.warn('WebView global error (handled):', message.split(':')[1]);
    } else if (message.startsWith('UNHANDLED_REJECTION:')) {
      console.warn('WebView unhandled rejection (handled):', message.split(':')[1]);
    } else if (message.startsWith('CLICK_HANDLER_ERROR:')) {
      console.warn('Click handler error:', message.split(':')[1]);
    } else if (message.startsWith('CHANGE_HANDLER_ERROR:')) {
      console.warn('Change handler error:', message.split(':')[1]);
    } else if (message.startsWith('SUBMIT_HANDLER_ERROR:')) {
      console.warn('Submit handler error:', message.split(':')[1]);
    } else if (message.startsWith('SCRIPT_ERROR:')) {
      console.error('WebView script error:', message.split(':')[1]);
    }
  };

  if (hasError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load dashboard</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !webViewUrl) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Loader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {webViewUrl ? (
          <>
            <WebView
              ref={webViewRef}
              source={{ uri: webViewUrl }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              sharedCookiesEnabled={true}
              startInLoadingState={false}
              onNavigationStateChange={handleNavigationChange}
              onError={handleError}
              onHttpError={handleError}
              injectedJavaScript={injectJavaScript}
              onMessage={handleWebViewMessage}
              onLoadStart={() => {}}
              onLoadEnd={() => {}}
              // File upload support
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo={true}
              allowsBackForwardNavigationGestures={false}
              // Critical for file uploads - this handles the file picker
              onFileDownload={({ nativeEvent }) => {
                // Handle file downloads if needed
                console.log('File download requested:', nativeEvent.downloadUrl);
              }}
              // Enable file upload permissions
              mixedContentMode="compatibility"
              // For Android file upload
              onPermissionRequest={(request) => {
                console.log('Permission requested:', request.nativeEvent);
                request.grant();
              }}
              // Handle file uploads properly
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              allowFileAccessFromFileURLs={true}
              // iOS specific file upload handling
              onShouldStartLoadWithRequest={(request) => {
                console.log('Should start load with request:', request);
                return true;
              }}
            />
            {isLoading && <Loader />}
          </>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>No dashboard URL available</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorSubText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default DashboardScreen;