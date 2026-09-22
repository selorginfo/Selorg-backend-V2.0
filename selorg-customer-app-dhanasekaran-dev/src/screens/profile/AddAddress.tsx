import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { LatLng, MapPressEvent, Marker, MarkerDragStartEndEvent, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Header, Icon, PrimaryButton, ScreenContainer } from '../../components';
import { colors, fontFamily, radii } from '../../theme';
import { useAddress } from '../../context/AddressContext';
import type { RootStackParamList } from '../../navigation/types';
import { reverseGeocode, resolveCurrentPlace } from '../../services/location.service';
import { showToast } from '../../utils/toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'AddAddress'>;

const LABELS = ['Home', 'Work', 'Other'] as const;

// Fallback map centre until a real fix / saved pin is available (Chennai).
const DEFAULT_COORDS: LatLng = { latitude: 13.0827, longitude: 80.2707 };
const DELTA = { latitudeDelta: 0.008, longitudeDelta: 0.008 };

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

export default function AddAddressScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { addresses, saveAddress } = useAddress();
  const addressId = route.params?.addressId;
  const existing = addressId ? addresses.find(a => a.id === addressId) : undefined;

  const mapRef = useRef<MapView>(null);

  const [label, setLabel] = useState<string>(existing?.label || 'Home');
  const [line1, setLine1] = useState(existing?.line1 || '');
  const [line2, setLine2] = useState(existing?.line2 || '');
  const [city, setCity] = useState(existing?.city || '');
  const [stateVal, setStateVal] = useState(existing?.state || '');
  const [pincode, setPincode] = useState(existing?.pincode || '');

  const hasExistingPin =
    !!existing?.latitude && !!existing?.longitude;
  const [coords, setCoords] = useState<LatLng>(
    hasExistingPin
      ? { latitude: existing!.latitude, longitude: existing!.longitude }
      : DEFAULT_COORDS,
  );
  const [pinSet, setPinSet] = useState(hasExistingPin);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const initialRegion: Region = { ...coords, ...DELTA };

  const applyResolvedFields = (p: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
  }) => {
    // Only overwrite fields the user hasn't already typed into.
    setLine1(prev => prev || p.line1);
    setLine2(prev => prev || p.line2);
    setCity(prev => prev || p.city);
    setStateVal(prev => prev || p.state);
    setPincode(prev => prev || p.pincode);
  };

  const movePin = async (next: LatLng, animate = false) => {
    setCoords(next);
    setPinSet(true);
    if (animate) mapRef.current?.animateToRegion({ ...next, ...DELTA }, 350);
    setGeocoding(true);
    try {
      const place = await reverseGeocode(next);
      applyResolvedFields(place);
    } finally {
      setGeocoding(false);
    }
  };

  const onUseMyLocation = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const place = await resolveCurrentPlace();
      const next = { latitude: place.latitude, longitude: place.longitude };
      setCoords(next);
      setPinSet(true);
      mapRef.current?.animateToRegion({ ...next, ...DELTA }, 350);
      applyResolvedFields(place);
    } catch (e: any) {
      const denied = e?.code === 'PERMISSION_DENIED' || e?.code === 1;
      showToast(
        denied ? 'Location permission denied' : "Couldn't get your location",
        'err',
      );
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    const ok = await saveAddress({
      id: addressId ?? null,
      label,
      line1,
      line2,
      city,
      state: stateVal,
      pincode,
      latitude: pinSet ? coords.latitude : existing?.latitude ?? 0,
      longitude: pinSet ? coords.longitude : existing?.longitude ?? 0,
    });
    if (ok) navigation.goBack();
  };

  return (
    <ScreenContainer>
      <Header title={addressId ? 'Edit address' : 'Add address'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={initialRegion}
            onPress={(e: MapPressEvent) => movePin(e.nativeEvent.coordinate)}
          >
            {pinSet && (
              <Marker
                coordinate={coords}
                draggable
                onDragEnd={(e: MarkerDragStartEndEvent) =>
                  movePin(e.nativeEvent.coordinate)
                }
              />
            )}
          </MapView>

          {!pinSet && (
            <View pointerEvents="none" style={styles.mapHint}>
              <Icon name="pin" size={16} color={colors.primaryDark} />
              <Text style={styles.mapHintText}>Tap the map to drop a pin</Text>
            </View>
          )}

          <Pressable style={styles.locateBtn} onPress={onUseMyLocation} disabled={locating}>
            {locating ? (
              <ActivityIndicator size="small" color={colors.primaryDark} />
            ) : (
              <Icon name="navigation" size={16} color={colors.primaryDark} />
            )}
            <Text style={styles.locateBtnText}>
              {locating ? 'Locating…' : 'Use my location'}
            </Text>
          </Pressable>

          {geocoding && (
            <View pointerEvents="none" style={styles.geocodeBadge}>
              <ActivityIndicator size="small" color={colors.white} />
            </View>
          )}
        </View>

        <View style={styles.labelRow}>
          {LABELS.map(l => {
            const active = label === l;
            return (
              <Pressable
                key={l}
                style={[styles.labelChip, active && styles.labelChipActive]}
                onPress={() => setLabel(l)}
              >
                <Text style={[styles.labelChipText, active && styles.labelChipTextActive]}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="ADDRESS LINE 1" value={line1} onChangeText={setLine1} placeholder="House / flat, building" />
        <Field label="ADDRESS LINE 2 (optional)" value={line2} onChangeText={setLine2} placeholder="Area, landmark" />
        <View style={styles.row2}>
          <View style={styles.row2Item}>
            <Field label="CITY" value={city} onChangeText={setCity} placeholder="City" />
          </View>
          <View style={styles.row2Item}>
            <Field label="PINCODE" value={pincode} onChangeText={setPincode} placeholder="600001" keyboardType="numeric" />
          </View>
        </View>
        <Field label="STATE" value={stateVal} onChangeText={setStateVal} placeholder="State" />
      </ScrollView>
      <View style={styles.bottomBar}>
        <PrimaryButton label="Save address" onPress={handleSave} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 16 },
  mapWrap: {
    height: 190,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.tint,
    marginBottom: 16,
  },
  mapHint: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.lg,
  },
  mapHintText: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.primaryDark },
  locateBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    elevation: 2,
  },
  locateBtnText: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.primaryDark },
  geocodeBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  labelChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.md + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  labelChipActive: { borderColor: colors.primary, backgroundColor: colors.tint },
  labelChipText: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.textMuted },
  labelChipTextActive: { color: colors.primaryDark },
  field: { marginBottom: 14 },
  fieldLabel: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.text, letterSpacing: 0.3 },
  input: {
    marginTop: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  row2: { flexDirection: 'row', gap: 12 },
  row2Item: { flex: 1 },
  bottomBar: {
    padding: 16,
    paddingTop: 6,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
