// screens/LoginScreen.js
import React, { useState } from 'react';
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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

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
    if (!email) {
      alert('Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting tenant search API call...');
      const apiUrl = 'https://test.stg-tenant.eclipsescheduling.com/api/tenant-users/search';
      console.log('API URL:', apiUrl);
      
      const requestBody = {
        email: email
      };
      console.log('Request body:', requestBody);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      

      let data;
      try {
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        try {
          data = JSON.parse(responseText);
          console.log('Parsed response data:', data);
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError);
          throw new Error('Invalid JSON response from server');
        }
      } catch (responseError) {
        console.error('Error reading response:', responseError);
        throw new Error('Could not read server response');
      }
      
      if (data.success) {
        console.log('Response:', data);
        if (data.count > 0 && Array.isArray(data.data)) {
          setTenants(data.data);
          
          if (data.count === 1) {
            // Single tenant found - proceed automatically
            const tenant = data.data[0];
            console.log('Single tenant found:', tenant.tenant_id);
            handleTenantSelect(tenant);
          } else {
            // Multiple tenants - show modal for selection
            console.log('Multiple tenants found:', data.count);
            setShowTenantModal(true);
          }
        } else {
          alert('No organizations found for this email address');
        }
      } else {
        alert(data.message || 'Failed to find email');
      }
      
      
    } catch (error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      let errorMessage = 'Network error. ';
      if (error.message.includes('Network request failed')) {
        errorMessage += 'Please check your internet connection and try again.';
      } else if (error.message.includes('Invalid JSON')) {
        errorMessage += 'Server returned an invalid response.';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
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
      />

      {/* Forgot Password */}
      <TouchableOpacity style={styles.forgotContainer}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* Login Button */}
      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginText}>Login</Text>
      </TouchableOpacity>

      {/* Optional - Signup */}
      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don’t have an account? </Text>
        <TouchableOpacity>
          <Text style={styles.signupLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>

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
});
