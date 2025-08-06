import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, BackHandler, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { SessionService } from '../services/session';

const DashboardScreen = ({ navigation }) => {
  const [webViewUrl, setWebViewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    console.log('[Dashboard] Component mounted - initializing dashboard');
    const loadDashboard = async () => {
      try {
        console.log('[Dashboard] Checking session validity');
        const isValid = await SessionService.isSessionValid();
        console.log(`[Dashboard] Session valid: ${isValid}`);
        
        if (!isValid) {
          console.log('[Dashboard] Invalid session - redirecting to login');
          await SessionService.clearSession();
          navigation.replace('Login');
          return;
        }

        console.log('[Dashboard] Retrieving tenant ID');
        const tenantId = await SessionService.getTenantId();
        console.log(`[Dashboard] Tenant ID: ${tenantId || 'none'}`);
        
        if (!tenantId) {
          console.error('[Dashboard] No tenant information found');
          throw new Error('No tenant information found');
        }

        const url = `https://${tenantId}.stg-tenant.eclipsescheduling.com/v1/provider/dashboard`;
        console.log(`[Dashboard] Setting WebView URL: ${url}`);
        setWebViewUrl(url);
        setIsLoading(false);
        
        console.log('[Dashboard] Updating last active time');
        await SessionService.updateLastActive();
      } catch (error) {
        console.error('[Dashboard] Load error:', error);
        setHasError(true);
        Alert.alert('Error', 'Failed to load dashboard. Please login again.');
        await SessionService.clearSession();
        navigation.replace('Login');
      }
    };

    loadDashboard();

    console.log('[Dashboard] Setting up back button handler');
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        console.log('[Dashboard] Back button pressed - preventing action');
        return true;
      }
    );

    return () => {
      console.log('[Dashboard] Cleaning up back button handler');
      backHandler.remove();
    };
  }, [navigation]);

  const handleNavigationChange = async (navState) => {
    console.log(`[Dashboard] Navigation state changed - loading: ${navState.loading}`);
    setIsLoading(navState.loading);
    
    const url = navState.url;
    console.log(`[Dashboard] Current URL: ${url}`);
    
    if (url.includes('/v1/login')) {
      console.log('[Dashboard] Detected logout redirect - clearing session');
      await SessionService.clearSession();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }]
      });
    }
  };

  const handleError = () => {
    console.error('[Dashboard] WebView error occurred');
    setHasError(true);
    setIsLoading(false);
    Alert.alert('Error', 'Failed to load dashboard content');
  };

  const injectJavaScript = `
  (function() {
    try {
      // 1. First check if token exists in localStorage
      const existingToken = window.localStorage.getItem('authToken');
      if (existingToken) {
        console.log('[WebView] Found existing token in localStorage');
        window.ReactNativeWebView.postMessage('TOKEN_FOUND_IN_LOCALSTORAGE');
        return true;
      }

      // 2. If no token, signal React Native to inject it
      console.log('[WebView] No token found, requesting injection');
      window.ReactNativeWebView.postMessage('NEED_TOKEN_INJECTION');

      // 3. Set up retry mechanism
      let retryCount = 0;
      const maxRetries = 5;
      const retryInterval = 1000;

      const checkForToken = () => {
        retryCount++;
        const token = window.localStorage.getItem('authToken');
        
        if (token) {
          console.log('[WebView] Token successfully injected on attempt ' + retryCount);
          window.ReactNativeWebView.postMessage('TOKEN_INJECTION_SUCCESS');
          return;
        }

        if (retryCount >= maxRetries) {
          console.log('[WebView] Max retries reached, token not found');
          window.ReactNativeWebView.postMessage('TOKEN_INJECTION_FAILED');
          return;
        }

        setTimeout(checkForToken, retryInterval);
      };

      // Initial check with slight delay
      setTimeout(checkForToken, 500);
    } catch (error) {
      console.error('[WebView] Token check error:', error);
      window.ReactNativeWebView.postMessage('TOKEN_CHECK_ERROR:' + error.message);
    }
    
    true;
  })();
  `;

  const handleWebViewMessage = async (event) => {
    const message = event.nativeEvent.data;
    console.log('[WebView Message]', message);

    if (message === 'NEED_TOKEN_INJECTION') {
      try {
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) {
          console.log('[Dashboard] Injecting token into WebView');
          const injectionScript = `
            try {
              window.localStorage.setItem('authToken', '${token.replace(/'/g, "\\'")}');
              window.sessionStorage.setItem('authToken', '${token.replace(/'/g, "\\'")}');
              console.log('[WebView] Token injected successfully');
              window.ReactNativeWebView.postMessage('TOKEN_INJECTED');
            } catch (error) {
              console.error('[WebView] Injection error:', error);
              window.ReactNativeWebView.postMessage('INJECTION_ERROR:' + error.message);
            }
            true;
          `;
          webViewRef.current?.injectJavaScript(injectionScript);
        } else {
          console.log('[Dashboard] No token available in AsyncStorage');
        }
      } catch (error) {
        console.error('[Dashboard] Token retrieval error:', error);
      }
    }
  };

  if (hasError) {
    console.log('[Dashboard] Rendering error state');
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load dashboard</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && !webViewUrl) {
    console.log('[Dashboard] Rendering loading state');
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  console.log(`[Dashboard] Rendering WebView with URL: ${webViewUrl}`);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {webViewUrl ? (
          <WebView
            ref={webViewRef}
            source={{ uri: webViewUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            sharedCookiesEnabled={true}
            startInLoadingState={true}
            onNavigationStateChange={handleNavigationChange}
            onError={handleError}
            onHttpError={handleError}
            injectedJavaScript={injectJavaScript}
            onMessage={handleWebViewMessage}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            )}
            onLoadStart={() => console.log('[WebView] Loading started')}
            onLoadEnd={() => console.log('[WebView] Loading completed')}
            onLoadProgress={({ nativeEvent }) => 
              console.log(`[WebView] Loading progress: ${Math.round(nativeEvent.progress * 100)}%`)
            }
          />
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