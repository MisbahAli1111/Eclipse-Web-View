import ReactNativeBiometrics from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics();

// Biometric error types for better error handling
export const BIOMETRIC_ERRORS = {
  USER_CANCEL: 'UserCancel',
  USER_FALLBACK: 'UserFallback', 
  BIOMETRY_NOT_AVAILABLE: 'BiometryNotAvailable',
  BIOMETRY_NOT_ENROLLED: 'BiometryNotEnrolled',
  BIOMETRY_LOCKOUT: 'BiometryLockout',
  BIOMETRY_LOCKOUT_PERMANENT: 'BiometryLockoutPermanent',
  SYSTEM_CANCEL: 'SystemCancel',
  PASSCODE_NOT_SET: 'PasscodeNotSet',
  AUTHENTICATION_FAILED: 'AuthenticationFailed'
};

export const BiometricService = {
  async checkBiometricSupport() {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      return {
        isSupported: available,
        type: biometryType
      };
    } catch (error) {
      console.error('[BiometricService] Support check error:', error);
      throw error;
    }
  },

  async authenticate(promptMessage = 'Authenticate to login') {
    try {
      const { success, error } = await rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel'
      });
      
      if (error) {
        console.error('[BiometricService] Authentication error:', error);
        
        // Create a structured error with user-friendly messages
        const biometricError = this.createBiometricError(error);
        throw biometricError;
      }
      
      return success;
    } catch (error) {
      console.error('[BiometricService] Authentication failed:', error);
      
      // If it's already a structured error, re-throw it
      if (error.code && error.userMessage) {
        throw error;
      }
      
      // Otherwise, create a generic structured error
      throw this.createBiometricError(error.message || 'Authentication failed');
    }
  },

  createBiometricError(errorString) {
    const errorCode = this.getErrorCode(errorString);
    const userMessage = this.getUserFriendlyMessage(errorCode, errorString);
    
    const error = new Error(userMessage);
    error.code = errorCode;
    error.userMessage = userMessage;
    error.originalError = errorString;
    
    return error;
  },

  getErrorCode(errorString) {
    if (!errorString) return 'UNKNOWN';
    
    const errorStr = errorString.toString().toLowerCase();
    
    // iOS-specific error domain patterns
    if (errorStr.includes('com.apple.localauthentication') || errorStr.includes('localauthentication')) {
      // Check for specific iOS LocalAuthentication error codes
      if (errorStr.includes('code=-2') || errorStr.includes('usercancel')) {
        return BIOMETRIC_ERRORS.USER_CANCEL;
      }
      if (errorStr.includes('code=-3') || errorStr.includes('userfallback')) {
        return BIOMETRIC_ERRORS.USER_FALLBACK;
      }
      if (errorStr.includes('code=-6') || errorStr.includes('biometrynotavailable')) {
        return BIOMETRIC_ERRORS.BIOMETRY_NOT_AVAILABLE;
      }
      if (errorStr.includes('code=-7') || errorStr.includes('biometrynotenrolled')) {
        return BIOMETRIC_ERRORS.BIOMETRY_NOT_ENROLLED;
      }
      if (errorStr.includes('code=-8') || errorStr.includes('biometrylockout')) {
        return BIOMETRIC_ERRORS.BIOMETRY_LOCKOUT;
      }
      if (errorStr.includes('code=-4') || errorStr.includes('systemcancel')) {
        return BIOMETRIC_ERRORS.SYSTEM_CANCEL;
      }
      if (errorStr.includes('code=-5') || errorStr.includes('passcodenotset')) {
        return BIOMETRIC_ERRORS.PASSCODE_NOT_SET;
      }
      if (errorStr.includes('code=-1') || errorStr.includes('authenticationfailed')) {
        return BIOMETRIC_ERRORS.AUTHENTICATION_FAILED;
      }
      // If it's an iOS LocalAuthentication error but we don't recognize the specific code
      // it's likely a user cancellation or permission denial
      return BIOMETRIC_ERRORS.USER_CANCEL;
    }
    
    // Generic error pattern matching (for Android and other cases)
    if (errorStr.includes('usercancel') || errorStr.includes('user cancel') || errorStr.includes('cancelled')) {
      return BIOMETRIC_ERRORS.USER_CANCEL;
    }
    if (errorStr.includes('userfallback') || errorStr.includes('user fallback')) {
      return BIOMETRIC_ERRORS.USER_FALLBACK;
    }
    if (errorStr.includes('biometrynotavailable') || errorStr.includes('not available') || errorStr.includes('unavailable')) {
      return BIOMETRIC_ERRORS.BIOMETRY_NOT_AVAILABLE;
    }
    if (errorStr.includes('biometrynotenrolled') || errorStr.includes('not enrolled') || errorStr.includes('not set up')) {
      return BIOMETRIC_ERRORS.BIOMETRY_NOT_ENROLLED;
    }
    if (errorStr.includes('biometrylockout') || errorStr.includes('lockout') || errorStr.includes('locked')) {
      return BIOMETRIC_ERRORS.BIOMETRY_LOCKOUT;
    }
    if (errorStr.includes('systemcancel') || errorStr.includes('system cancel') || errorStr.includes('interrupted')) {
      return BIOMETRIC_ERRORS.SYSTEM_CANCEL;
    }
    if (errorStr.includes('passcodenotset') || errorStr.includes('passcode not set') || errorStr.includes('passcode required')) {
      return BIOMETRIC_ERRORS.PASSCODE_NOT_SET;
    }
    if (errorStr.includes('authenticationfailed') || errorStr.includes('authentication failed') || errorStr.includes('failed')) {
      return BIOMETRIC_ERRORS.AUTHENTICATION_FAILED;
    }
    
    return 'UNKNOWN';
  },

  getUserFriendlyMessage(errorCode, originalError) {
    switch (errorCode) {
      case BIOMETRIC_ERRORS.USER_CANCEL:
        return 'Authentication was cancelled. Please try again or use your password to login.';
      
      case BIOMETRIC_ERRORS.USER_FALLBACK:
        return 'Face ID was cancelled. Please use your password to login.';
      
      case BIOMETRIC_ERRORS.BIOMETRY_NOT_AVAILABLE:
        return 'Face ID is not available on this device. Please use your password to login.';
      
      case BIOMETRIC_ERRORS.BIOMETRY_NOT_ENROLLED:
        return 'Face ID is not set up on this device. Please set up Face ID in Settings or use your password to login.';
      
      case BIOMETRIC_ERRORS.BIOMETRY_LOCKOUT:
        return 'Face ID is temporarily locked due to too many failed attempts. Please try again later or use your password.';
      
      case BIOMETRIC_ERRORS.BIOMETRY_LOCKOUT_PERMANENT:
        return 'Face ID is permanently locked. Please use your password to login and reset Face ID in Settings.';
      
      case BIOMETRIC_ERRORS.SYSTEM_CANCEL:
        return 'Face ID was interrupted by the system. Please try again.';
      
      case BIOMETRIC_ERRORS.PASSCODE_NOT_SET:
        return 'Device passcode is required for Face ID. Please set up a passcode in Settings first.';
      
      case BIOMETRIC_ERRORS.AUTHENTICATION_FAILED:
        return 'Face ID authentication failed. Please try again or use your password to login.';
      
      default:
        return `Face ID authentication failed: ${originalError || 'Please try again or use your password to login.'}`;
    }
  }
};