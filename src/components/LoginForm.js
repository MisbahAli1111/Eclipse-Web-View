import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet
} from 'react-native';
import Loader from './Loader';


export const LoginForm = ({
  email,
  setEmail,
  password,
  setPassword,
  handleLogin,
  handleBiometricLogin,
  isBiometricChecked,
  isBiometricSupported,
  biometricType,
  isLoading
}) => (
  <>
    <Image source={require('../../assets/logo.png')} style={styles.logo} />
    <Text style={styles.title}>Welcome Back</Text>
    <Text style={styles.subtitle}>Login to continue</Text>

    <TextInput
      style={styles.input}
      placeholder="Email"
      placeholderTextColor="#999"
      value={email}
      onChangeText={setEmail}
      keyboardType="email-address"
      autoCapitalize="none"
    />

    <TextInput
      style={styles.input}
      placeholder="Password"
      placeholderTextColor="#999"
      value={password}
      onChangeText={setPassword}
      secureTextEntry
      autoCapitalize="none"
    />

    <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
      <Text style={styles.loginText}>Login</Text>
    </TouchableOpacity>

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

    <View style={styles.signupContainer}>
      <Text style={styles.signupText}>Don't have an account? </Text>
      <TouchableOpacity>
        <Text style={styles.signupLink}>Sign Up</Text>
      </TouchableOpacity>
    </View>

    {isLoading && <Loader />}
  </>
);





export const styles = StyleSheet.create({

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
    marginTop: 25,
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
 
});