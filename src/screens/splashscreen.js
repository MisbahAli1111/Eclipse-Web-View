import React, { useEffect } from 'react';
import { View, Image } from 'react-native';
import { SessionService } from '../services/session';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const checkSession = async () => {
      try {
        const isValid = await SessionService.isSessionValid();
        const tenantId = isValid ? await SessionService.getTenantId() : null;
        
        setTimeout(() => {
          if (isValid && tenantId) {
            navigation.replace('Dashboard', { 
              webViewUrl: `https://${tenantId}.stg-tenant.eclipsescheduling.com/v1/provider/dashboard`
            });
          } else {
            navigation.replace('Login');
          }
        }, 2000);
      } catch (error) {
        navigation.replace('Login');
      }
    };

    checkSession();
  }, [navigation]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Image
        source={require('../../assets/eclipseLogo3D.png')}
        style={{ width: 120, height: 120, resizeMode: 'contain' }}
      />
    </View>
  );
}