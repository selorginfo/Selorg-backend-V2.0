import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fontFamily, radii } from '../theme';
import Icon from './Icon';

interface Props {
  quantity: number;
  outOfStock?: boolean;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  /**
   * `compact` – bordered ADD pill + rounded stepper (cart rows)
   * `block`   – full-size stepper for the PDP purchase bar
   * `circle`  – 38px circular "+" that swaps for a 999-radius green pill
   *             stepper. This is the product-grid treatment in the design.
   */
  variant?: 'compact' | 'block' | 'circle';
}

export default function QuantityStepper({
  quantity,
  outOfStock = false,
  onAdd,
  onIncrement,
  onDecrement,
  variant = 'compact',
}: Props) {
  const isBlock = variant === 'block';
  const isCircle = variant === 'circle';
  const btnSize = isBlock ? 40 : isCircle ? 26 : 26;

  // `stepin` (0 -> 1) and `numin` (value change) from the design.
  const pop = useRef(new Animated.Value(1)).current;
  const numFade = useRef(new Animated.Value(1)).current;
  const prevQty = useRef(quantity);

  useEffect(() => {
    if (prevQty.current === quantity) return;
    const cameFromZero = prevQty.current === 0 && quantity > 0;
    prevQty.current = quantity;

    if (cameFromZero) {
      pop.setValue(0.6);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 140 }).start();
    }
    numFade.setValue(0.2);
    Animated.timing(numFade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [quantity, pop, numFade]);

  if (quantity <= 0) {
    if (isCircle) {
      return (
        <Pressable
          onPress={outOfStock ? undefined : onAdd}
          disabled={outOfStock}
          style={[styles.circleAdd, outOfStock ? styles.circleAddOos : styles.circleAddOn]}
          hitSlop={4}
        >
          {outOfStock ? (
            <Text style={styles.soldOutLabel}>SOLD{'\n'}OUT</Text>
          ) : (
            <Icon name="plus" size={18} color={colors.white} strokeWidth={2.8} />
          )}
        </Pressable>
      );
    }
    return (
      <Pressable
        onPress={outOfStock ? undefined : onAdd}
        disabled={outOfStock}
        style={[
          styles.addBtn,
          isBlock && styles.addBtnBlock,
          {
            backgroundColor: outOfStock ? colors.surfaceAlt : colors.white,
            borderColor: outOfStock ? colors.border : colors.primary,
          },
        ]}
      >
        <Text style={[styles.addLabel, { color: outOfStock ? colors.textMuted : colors.primary }]}>
          {outOfStock ? 'OUT' : 'ADD'}
        </Text>
      </Pressable>
    );
  }

  return (
    <Animated.View
      style={[
        styles.stepper,
        isBlock && styles.stepperBlock,
        isCircle && styles.stepperCircle,
        { transform: [{ scale: pop }] },
      ]}
    >
      <Pressable onPress={onDecrement} style={[styles.stepBtn, { width: btnSize, height: btnSize }]} hitSlop={4}>
        <Icon name="minus" size={isBlock ? 16 : 15} color={colors.white} strokeWidth={2.8} />
      </Pressable>
      <Animated.Text
        style={[
          styles.qty,
          { fontSize: isBlock ? 16 : 13, minWidth: isBlock ? 26 : isCircle ? 16 : 18, opacity: numFade },
        ]}
      >
        {quantity}
      </Animated.Text>
      <Pressable onPress={onIncrement} style={[styles.stepBtn, { width: btnSize, height: btnSize }]} hitSlop={4}>
        <Icon name="plus" size={isBlock ? 16 : 15} color={colors.white} strokeWidth={2.8} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.lg - 1,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnBlock: { paddingVertical: 12, paddingHorizontal: 28 },
  addLabel: { fontFamily: fontFamily.bold, fontSize: 13, letterSpacing: 0.4 },
  circleAdd: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleAddOn: {
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  circleAddOos: { backgroundColor: colors.placeholder },
  soldOutLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 9,
    lineHeight: 10,
    color: '#9AA79A',
    textAlign: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.lg - 1,
    padding: 2,
  },
  stepperBlock: { borderRadius: radii.xl - 2, padding: 3 },
  stepperCircle: { borderRadius: radii.round, paddingVertical: 2, paddingHorizontal: 4 },
  stepBtn: { alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fontFamily.bold, color: colors.white, textAlign: 'center' },
});
