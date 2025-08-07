import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  StyleSheet
} from 'react-native';
//import { styles } from './styles';

export const BiometricModal = ({
  showEnrollBiometricModal,
  setShowEnrollBiometricModal,
  handleEnrollBiometric,
  isEnrollingBiometric,
  tenants,
  handleTenantSelect,
  proceedAfterEnrollment
}) => (
  <Modal
    visible={showEnrollBiometricModal}
    animationType="slide"
    transparent={true}
    onRequestClose={() => {
      setShowEnrollBiometricModal(false);
      proceedAfterEnrollment();
    }}
  >
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Enable Fingerprint Login</Text>
        <Text style={styles.modalText}>
          Do you want to enable fingerprint login for future access?
        </Text>
        
        <Image 
          source={require('../../assets/fingerprint-scan.png')} 
          style={styles.biometricIconLarge}
        />
        
        <View style={styles.modalButtonContainer}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={() => {
              setShowEnrollBiometricModal(false);
              if (tenants.length === 1) {
                handleTenantSelect(tenants[0]);
              } else if (tenants.length > 1) {
                setShowTenantModal(true);
              }
            }}
          >
            <Text style={styles.modalButtonText}>Skip</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.modalButton, styles.enrollButton]}
            onPress={handleEnrollBiometric}
            disabled={isEnrollingBiometric}
          >
            {isEnrollingBiometric ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.modalButtonText}>Enable</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);




export const styles = StyleSheet.create({
 
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
 
  biometricIconLarge: {
  width: 64,
  height: 64,
  alignSelf: 'center',
  marginVertical: 20,
},
modalText: {
  fontSize: 16,
  textAlign: 'center',
  marginBottom: 10,
  color: '#666',
},
modalButtonContainer: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginTop: 20,
},
modalButton: {
  flex: 1,
  padding: 15,
  borderRadius: 8,
  alignItems: 'center',
  marginHorizontal: 5,
},
enrollButton: {
  backgroundColor: '#007AFF',
},
cancelButton: {
  backgroundColor: '#ccc',
},
modalButtonText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
});