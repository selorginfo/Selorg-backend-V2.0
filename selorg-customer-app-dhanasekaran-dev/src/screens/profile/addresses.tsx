import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Header, Icon, ScreenContainer, StateView } from '../../components';
import { colors, fontFamily, radii } from '../../theme';
import { useAddress } from '../../context/AddressContext';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'Addresses'>;

export default function AddressesScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const fromCheckout = route.params?.fromCheckout;
  const { addresses, selectedAddressId, selectAddress, setDefaultAddress, deleteAddress } = useAddress();

  const handleSelect = (id: string) => {
    selectAddress(id);
    if (fromCheckout) navigation.goBack();
  };

  const handleDelete = (id: string, label: string) => {
    Alert.alert('Delete address', `Remove your ${label} address?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAddress(id) },
    ]);
  };

  return (
    <ScreenContainer>
      <Header
        title="Select address"
        onBack={() => navigation.goBack()}
        right={
          <Pressable style={styles.addBtn} onPress={() => navigation.navigate('AddAddress')} hitSlop={6}>
            <Text style={styles.addBtnLabel}>+ Add</Text>
          </Pressable>
        }
      />
      {addresses.length === 0 ? (
        <View style={styles.emptyWrap}>
          <StateView
            kind="empty"
            title="No saved addresses"
            message="Add an address to get your groceries delivered."
            ctaLabel="Add address"
            onCta={() => navigation.navigate('AddAddress')}
            icon="mapPinned"
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {addresses.map(a => {
            const active = selectedAddressId === a.id;
            return (
              <Pressable
                key={a.id}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => handleSelect(a.id)}
              >
                <Icon name={a.label === 'Work' ? 'building' : 'home'} size={20} color={colors.primary} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.cardLabel}>{a.label}</Text>
                    {a.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeLabel}>DEFAULT</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardAddress}>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}, {a.city} {a.pincode}
                  </Text>
                  <View style={styles.actionsRow}>
                    <Pressable
                      hitSlop={6}
                      onPress={e => {
                        e.stopPropagation();
                        navigation.navigate('AddAddress', { addressId: a.id });
                      }}
                    >
                      <Text style={styles.actionEdit}>Edit</Text>
                    </Pressable>
                    {!a.isDefault ? (
                      <Pressable
                        hitSlop={6}
                        onPress={e => {
                          e.stopPropagation();
                          setDefaultAddress(a.id);
                        }}
                      >
                        <Text style={styles.actionDefault}>Set default</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      hitSlop={6}
                      onPress={e => {
                        e.stopPropagation();
                        handleDelete(a.id, a.label);
                      }}
                    >
                      <Text style={styles.actionDelete}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, justifyContent: 'center' },
  addBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.md, backgroundColor: colors.tint },
  addBtnLabel: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.primaryDark },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
  },
  cardActive: { borderColor: colors.primary },
  cardBody: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLabel: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.text },
  defaultBadge: { backgroundColor: colors.tint, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  defaultBadgeLabel: { fontFamily: fontFamily.bold, fontSize: 9.5, color: colors.primary },
  cardAddress: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
  actionsRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  actionEdit: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.primary },
  actionDefault: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.textMuted },
  actionDelete: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.danger },
});
