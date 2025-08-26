import ReactNativeBiometrics from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics();

export const BiometricService = {
  async checkBiometricSupport() {
    try {
      const { available, biometryType } = await rnBiometrics.isSensorAvailable();
      return {
        isSupported: available,
        type: biometryType
      };
    } catch (error) {
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
        throw new Error(error);
      }
      
      return success;
    } catch (error) {
      console.error('[BiometricService] Authentication failed:', error);
      throw error;
    }
  }
};