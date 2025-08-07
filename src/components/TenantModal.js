import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet
} from 'react-native';
//import { styles } from './styles';

export const TenantModal = ({
  showTenantModal,
  setShowTenantModal,
  tenants,
  handleTenantSelect
}) => (
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
  
});