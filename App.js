import React, { useState, useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const App = () => {
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current; // Initial opacity: 0

  useEffect(() => {
    // Start fade-in animation
    Animated.timing(fadeAnim, {
      toValue: 1, // Fully visible
      duration: 1000, // 1 second fade-in
      useNativeDriver: true,
    }).start();

    // Hide splash after 2 seconds
    const splashTimeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(splashTimeout);
  }, []);

  const onShouldStartLoadWithRequest = (event) => {
    return event.url.startsWith('https://test.stg-tenant.eclipsescheduling.com/v1'); // Allow only app domain
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {loading ? (
          <Animated.View style={[styles.loaderContainer, { opacity: fadeAnim }]}>
            <Image source={require('./assets/logo.png')} style={styles.splashImage} />
          </Animated.View>
        ) : (
          <WebView
            source={{ uri: 'https://test.stg-tenant.eclipsescheduling.com/v1/login' }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            cacheEnabled={true}
            sharedCookiesEnabled={true}
            mixedContentMode="always"
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  splashImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
});

export default App;
