import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <Image source={require('../../assets/eclipseLogo3D.png')} style={styles.logo} />
      <Text style={styles.logoText}>ECLIPSE</Text>
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

      <View style={styles.passwordContainer}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={() => setShowPassword(!showPassword)}
          activeOpacity={0.7}
        >
          {showPassword ? (
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z"
                stroke="#333"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                stroke="#333"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : (
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            {/* Eye shape */}
            <Path
              d="M2 12C3.8 8.5 7.6 6 12 6s8.2 2.5 10 6c-1.8 3.5-5.6 6-10 6s-8.2-2.5-10-6z"
              stroke="#333"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          
            {/* Eye pupil */}
            <Path
              d="M12 15a3 3 0 0 0 0-6"
              stroke="#333"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          
            {/* Slash line */}
            <Path
              d="M3 3l18 18"
              stroke="#333"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          </Svg>
          )}
        </TouchableOpacity>
      </View>

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

      {isLoading && <Loader />}
    </>
  );
};





export const styles = StyleSheet.create({

  logo: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: 5,
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
  passwordContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 50,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
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
  logoText: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },

});