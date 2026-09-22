import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, radii } from '../theme';
import Icon from './Icon';
import { emitter, ToastPayload } from '../utils/emitter';

const KIND_STYLE: Record<ToastPayload['kind'], { bg: string; icon: 'success' | 'x' | 'bell' }> = {
  ok: { bg: colors.primary, icon: 'success' },
  err: { bg: colors.danger, icon: 'x' },
  info: { bg: colors.text, icon: 'bell' },
};

export default function ToastHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onToast = (payload: ToastPayload) => {
      setToast(payload);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, 2400);
    };
    emitter.on('toast', onToast);
    return () => {
      emitter.off('toast', onToast);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity]);

  if (!toast) return null;
  const style = KIND_STYLE[toast.kind];

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View style={[styles.toast, { backgroundColor: style.bg, opacity }]}>
        <Icon name={style.icon} size={15} color={colors.white} strokeWidth={2.4} />
        <Text style={styles.msg} numberOfLines={2}>{toast.msg}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    maxWidth: '84%',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radii.xl - 3,
  },
  msg: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.white, flexShrink: 1 },
});
