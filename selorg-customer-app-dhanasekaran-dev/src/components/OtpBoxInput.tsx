import React, { useRef, useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';
import { colors, fontFamily, radii } from '../theme';

interface Props {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

export default function OtpBoxInput({ length = 4, value, onChange, error, autoFocus }: Props) {
  const refs = useRef<(TextInput | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const setDigit = (i: number, text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    const chars = digits.slice();

    // Deletion (field cleared) — handled here and in onKeyPress for reliability.
    if (!clean) {
      chars[i] = '';
      onChange(chars.join(''));
      return;
    }

    // Paste / autofill of multiple digits.
    if (clean.length > 1) {
      for (let k = 0; k < clean.length && i + k < length; k++) {
        chars[i + k] = clean[k];
      }
      onChange(chars.join(''));
      refs.current[Math.min(i + clean.length, length - 1)]?.focus();
      return;
    }

    chars[i] = clean;
    onChange(chars.join(''));
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKeyPress = (i: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    const chars = digits.slice();
    if (chars[i]) {
      // Clear the current box (works even when onChangeText doesn't fire).
      chars[i] = '';
      onChange(chars.join(''));
    } else if (i > 0) {
      // Already empty — clear the previous box and step back.
      chars[i - 1] = '';
      onChange(chars.join(''));
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((d, i) => {
        const active = focused === i;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              {
                borderColor: error
                  ? colors.danger
                  : d || active
                  ? colors.primary
                  : colors.border,
                backgroundColor: colors.white,
              },
            ]}
          >
            <Text style={styles.digit}>{d}</Text>
            <TextInput
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChangeText={(t) => setDigit(i, t)}
              onKeyPress={(e) => onKeyPress(i, e)}
              onFocus={() => setFocused(i)}
              onBlur={() => setFocused((f) => (f === i ? null : f))}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              selectionColor={colors.primary}
              autoFocus={autoFocus && i === 0}
              style={styles.hiddenInput}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 9, justifyContent: 'center' },
  cell: {
    width: 52,
    height: 60,
    borderWidth: 1.5,
    borderRadius: radii.xl - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontFamily: fontFamily.bold,
    fontSize: 24,
    color: colors.text,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // Transparent input laid over the visible <Text> so the digit is always
  // perfectly centred by the cell's flexbox, not by platform text metrics.
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    textAlign: 'center',
    color: 'transparent',
    fontSize: 24,
    padding: 0,
  },
});
