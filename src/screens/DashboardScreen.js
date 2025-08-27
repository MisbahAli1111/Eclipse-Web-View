import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, BackHandler, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { SessionService } from '../services/session';
import { getDashboardUrl } from '../services/api/config';
import Loader from '../components/Loader';

const DashboardScreen = ({ navigation }) => {
  const [webViewUrl, setWebViewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const webViewRef = useRef(null);

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

  const handleError = () => {
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
        window.ReactNativeWebView.postMessage('TOKEN_FOUND_IN_LOCALSTORAGE');
        return true;
      }

      // 2. If no token, signal React Native to inject it
      window.ReactNativeWebView.postMessage('NEED_TOKEN_INJECTION');

      // 3. Set up retry mechanism
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
      setTimeout(checkForToken, 500);
    } catch (error) {
      window.ReactNativeWebView.postMessage('TOKEN_CHECK_ERROR:' + error.message);
    }
    
    true;
  })();
  `;

  const handleWebViewMessage = async (event) => {
    const message = event.nativeEvent.data;

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
      }
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