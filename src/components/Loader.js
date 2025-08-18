import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, Image } from 'react-native';
import Logo from '../../assets/logo.js';

const Loader = ({ size = 60, style }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, [spinAnim]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
        <Image source={require('../../assets/basic-logo.png')} style={{ width: size, height: size, resizeMode: 'cover' }} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)', // Optional: semi-transparent overlay
    zIndex: 999,
  },
});

export default Loader;

