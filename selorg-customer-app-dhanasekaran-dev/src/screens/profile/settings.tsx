import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Header, LogoutConfirmSheet, PrimaryButton, ScreenContainer } from '../../components';
import { colors, fontFamily, radii, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { showToast } from '../../utils/toast';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { logout } = useAuth();
  const { prefs, togglePref } = useNotifications();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your Selorg account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => showToast('Request submitted', 'info'),
        },
      ],
    );
  };

  const confirmLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'EnterMobile' }] });
  };

  const toggleRow = (label: string, value: boolean, onChange: () => void, sub?: string) => (
    <View key={label} style={styles.toggleRow}>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#D3DAD2', true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );

  return (
    <ScreenContainer>
      <Header title="Settings" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.group}>
          {toggleRow('Push notifications', !!prefs.push, () => togglePref('push'))}
          {toggleRow('Order updates', !!prefs.order, () => togglePref('order'), 'Status, delivery & tracking')}
          {toggleRow('Offers & promos', !!prefs.promo, () => togglePref('promo'))}
          {toggleRow('Wallet & refunds', !!prefs.wallet, () => togglePref('wallet'))}
        </View>

        <View style={styles.group}>
          <Pressable onPress={onDeleteAccount} style={[styles.linkRow, styles.linkRowLast]}>
            <Text style={styles.dangerLabel}>Delete account</Text>
          </Pressable>
        </View>

        <PrimaryButton label="Log out" onPress={() => setLogoutOpen(true)} kind="danger" />
        <Text style={styles.versionLabel}>Selorg · v2.0.0</Text>
      </ScrollView>

      <LogoutConfirmSheet
        visible={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  sectionLabel: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.textMuted, marginBottom: 8, marginLeft: 2 },
  group: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xxl - 2,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleTextWrap: { flex: 1 },
  toggleLabel: { fontFamily: fontFamily.semibold, fontSize: 14.5, color: colors.text },
  toggleSub: { fontFamily: fontFamily.medium, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  linkRow: {
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkRowLast: { borderBottomWidth: 0 },
  dangerLabel: { fontFamily: fontFamily.semibold, fontSize: 14.5, color: colors.danger },
  versionLabel: {
    textAlign: 'center',
    fontFamily: fontFamily.medium,
    fontSize: 11.5,
    color: colors.textMuted,
    marginTop: spacing.md - 2,
  },
});
