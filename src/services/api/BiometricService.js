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
      console.error('Biometric check error:', error);
      throw error;
    }
  },

  async authenticate(promptMessage = 'Authenticate to login') {
    try {
      const { success } = await rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel'
      });
      return success;
    } catch (error) {
      console.error('Biometric auth error:', error);
      throw error;
    }
  }
};