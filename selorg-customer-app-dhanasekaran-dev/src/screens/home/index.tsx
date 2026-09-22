import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, ProductCard, Skeleton, SkeletonRow, StateView, useBottomNavHeight } from '../../components';
import { colors, fontFamily, radii } from '../../theme';
import { images } from '../../theme/images';
import { catalogApi } from '../../services/catalog.service';
import type { ApiCategory, ApiProduct } from '../../services/catalog.service';
import { sectionKeyToCollectionSlug, isCollectionSectionKey } from '../../utils/catalogMappers';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useOrders } from '../../context/OrdersContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useAuth } from '../../context/AuthContext';
import { useAddress } from '../../context/AddressContext';
import { showToast } from '../../utils/toast';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_META: Record<string, { label: string }> = {
  pending: { label: 'Order placed' },
  confirmed: { label: 'Confirmed' },
  'getting-packed': { label: 'Getting packed' },
  'on-the-way': { label: 'On the way' },
  arrived: { label: 'Arrived' },
  delivered: { label: 'Delivered' },
  cancelled: { label: 'Cancelled' },
};

const CURATED = [
  { key: 'tiny', title: 'Tiny Tummies', subtitle: 'Baby care', image: images.tinyTummies },
  { key: 'wellbeing', title: 'Wellbeing', subtitle: 'Health picks', image: images.wellbeing },
  { key: 'lifestyle', title: 'Lifestyle', subtitle: 'For your home', image: images.lifestyleHeader },
] as const;

function toProductCard(p: ApiProduct) {
  const price = Number(p.price ?? 0);
  const mrp = Number(p.mrp ?? p.originalPrice ?? p.price ?? 0);
  const photo = p.imageUrl || p.thumbnailUrl || p.cardImageUrl || (Array.isArray(p.images) ? p.images[0] : '');
  const rating = typeof p.rating === 'number' ? p.rating : ((p.rating as any)?.average ?? 0);
  const unit = (Array.isArray(p.variants) && p.variants[0]?.size) || p.size || p.quantity || p.uom || '1 unit';
  const stock = typeof p.stockQuantity === 'number' ? p.stockQuantity : (p.stock !== false && p.stock !== 0 ? 99 : 0);
  return {
    id: p._id,
    categoryId: p.categoryId || '',
    sub: '',
    name: p.name,
    unit,
    price,
    mrp: mrp || price,
    stockQuantity: stock,
    image: photo ? { uri: photo } : { uri: '' },
    rating,
    bytes: [] as string[],
  };
}

type Section = { key: string; title: string; slug: string; products: ReturnType<typeof toProductCard>[] };

/** Shimmer stand-in matching the design's `_homeSkeleton()`. */
function HomeSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <Skeleton height={168} radius={20} />
      <View style={styles.skeletonCats}>
        <SkeletonRow count={4} gap={10} radius={16} />
      </View>
      <View style={styles.skeletonGrid}>
        <SkeletonRow count={2} gap={12} radius={20} aspectRatio={0.72} />
      </View>
      <View style={styles.skeletonGrid}>
        <SkeletonRow count={2} gap={12} radius={20} aspectRatio={0.72} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  // The floating nav overlays the screen, so pad content out from under it.
  const navH = useBottomNavHeight();
  const navigation = useNavigation<Nav>();
  const cart = useCart();
  const wishlist = useWishlist();
  const { activeOrder } = useOrders();
  const { unreadCount } = useNotifications();
  const { isAuthenticated } = useAuth();
  const { selectedAddress } = useAddress();

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [productSections, setProductSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const home = await catalogApi.getHome();

      if (home.categories?.length) {
        setCategories(home.categories);
      } else {
        const cats = await catalogApi.getCategories({ isActive: true, limit: 10 }).catch(() => []);
        setCategories(cats);
      }

      const defs = (home.sectionDefinitions || []).filter(d => isCollectionSectionKey(d.key));
      const sections = await Promise.all(
        defs.slice(0, 3).map(async def => {
          const slug = sectionKeyToCollectionSlug(def.key);
          try {
            const col = await catalogApi.getCollection(slug, { limit: 4 });
            return {
              key: def.key,
              title: def.label || col.title || 'Products',
              slug,
              products: (col.products || []).map(toProductCard),
            };
          } catch {
            return { key: def.key, title: def.label || 'Products', slug, products: [] };
          }
        }),
      );
      setProductSections(sections);
    } catch {
      // /home unavailable — fall back to the categories endpoint alone.
      try {
        const cats = await catalogApi.getCategories({ isActive: true, limit: 10 });
        setCategories(cats);
        setProductSections([]);
      } catch {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onBell = () => {
    if (isAuthenticated) navigation.navigate('Notifications');
    else navigation.navigate('EnterMobile', { mode: 'login' });
  };

  const onLocation = () => {
    if (isAuthenticated) navigation.navigate('Addresses');
    else navigation.navigate('EnterMobile', { mode: 'login' });
  };

  const renderGrid = (products: Section['products']) => (
    <View style={styles.grid}>
      {products.map(p => (
        <View key={p.id} style={styles.gridItem}>
          <ProductCard
            product={p}
            quantity={cart.quantityOf(p.id)}
            wished={wishlist.isWished(p.id)}
            onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
            onToggleWish={() => wishlist.toggleWish(p.id)}
            onAdd={() => cart.addToCart({ id: p.id, name: p.name, unit: p.unit, price: p.price, mrp: p.mrp, stockQuantity: p.stockQuantity, image: p.image })}
            onIncrement={() => cart.incrementItem(p.id)}
            onDecrement={() => cart.decrementItem(p.id)}
          />
        </View>
      ))}
    </View>
  );

  const firstCategory = categories[0];
  const hasContent = categories.length > 0 || productSections.some(s => s.products.length > 0);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <LinearGradient colors={[colors.white, colors.white]} style={styles.headerWrap}>
        <View style={styles.headerRow}>
          <Pressable style={styles.locBtn} onPress={onLocation} hitSlop={6}>
            <Icon name="pin" size={18} color={colors.primary} />
            <View style={styles.locTextWrap}>
              <View style={styles.locTitleRow}>
                <Text style={styles.locTitle} numberOfLines={1}>
                  {selectedAddress ? `Delivering to ${selectedAddress.label}` : 'Set location'}
                </Text>
                <Icon name="chevronDown" size={14} color={colors.textMuted} />
              </View>
              <Text style={styles.locSub} numberOfLines={1}>
                {selectedAddress
                  ? `${selectedAddress.line1}, ${selectedAddress.city}`
                  : 'Tap to add an address'}
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Search')} hitSlop={6}>
              <Icon name="search" size={20} color={colors.text} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={onBell} hitSlop={6}>
              <Icon name="bell" size={20} color={colors.text} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: navH }]}
        showsVerticalScrollIndicator={false}
      >
        {activeOrder ? (
          <Pressable style={styles.orderBanner} onPress={() => navigation.navigate('Tracking')}>
            <Icon name="truck" size={24} color={colors.white} />
            <View style={styles.orderBannerText}>
              <Text style={styles.orderBannerTitle}>
                Order {activeOrder.orderNumber} · {STATUS_META[activeOrder.status]?.label || activeOrder.status}
              </Text>
              <Text style={styles.orderBannerSub}>Tap to track live</Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.white} />
          </Pressable>
        ) : null}

        {loading ? (
          <HomeSkeleton />
        ) : error ? (
          <StateView
            kind="error"
            title="Couldn't load Selorg"
            message="We couldn't reach the store. Check your connection and try again."
            ctaLabel="Retry"
            onCta={load}
            icon="wifiOff"
          />
        ) : !hasContent ? (
          <StateView
            kind="empty"
            title="Nothing to show yet"
            message="Your store is being stocked. Pull back in a moment."
            ctaLabel="Reload"
            onCta={load}
            icon="leaf"
          />
        ) : (
          <>
            <Pressable
              style={styles.heroCard}
              onPress={() =>
                firstCategory &&
                navigation.navigate('CategoryProducts', { categoryId: firstCategory.slug || firstCategory._id })
              }
            >
              <Image source={images.banner} style={styles.heroImage} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(42,51,38,0.92)', 'rgba(69,110,41,0.78)', 'rgba(69,110,41,0.16)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.heroOverlay}
              />
              <View style={styles.heroContent}>
                <View style={styles.heroTag}>
                  <Text style={styles.heroTagLabel}>WEEKEND FRESH FEST</Text>
                </View>
                <Text style={styles.heroTitle}>20% off fresh fruits</Text>
                <Text style={styles.heroSubtitle}>Use code SAVE10 at checkout</Text>
                <View style={styles.heroCta}>
                  <Text style={styles.heroCtaLabel}>
                    {firstCategory ? `Shop ${firstCategory.name.toLowerCase()}` : 'Shop now'}
                  </Text>
                  <Icon name="plus" size={15} color={colors.primaryDark} strokeWidth={2.6} />
                </View>
              </View>
            </Pressable>

            {categories.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Shop by category</Text>
                  <Pressable onPress={() => (navigation as any).navigate('Main', { screen: 'CategoriesTab' })} hitSlop={6}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.railOuter}
                  contentContainerStyle={styles.catRail}
                >
                  {categories.map(c => (
                    <Pressable
                      key={c._id}
                      style={styles.catItem}
                      onPress={() => navigation.navigate('CategoryProducts', { categoryId: c.slug || c._id })}
                    >
                      <View style={styles.catImageWrap}>
                        {c.image ? (
                          <Image source={{ uri: c.image }} style={styles.catImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.catImage, { backgroundColor: '#FFFFFF' }]} />
                        )}
                      </View>
                      <Text style={styles.catLabel} numberOfLines={2}>{c.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {productSections.map(section =>
              section.products.length > 0 ? (
                <View key={section.key} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Pressable
                      onPress={() =>
                        navigation.navigate('Collection', { collectionKey: section.slug, title: section.title })
                      }
                      hitSlop={6}
                    >
                      <Text style={styles.seeAll}>See all</Text>
                    </Pressable>
                  </View>
                  {renderGrid(section.products)}
                </View>
              ) : null,
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Curated for you</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.railOuter}
                contentContainerStyle={styles.curatedRail}
              >
                {CURATED.map(c => (
                  <Pressable
                    key={c.key}
                    style={styles.curatedCard}
                    onPress={() => showToast(`${c.title} collection`, 'info')}
                  >
                    <Image source={c.image} style={styles.curatedImage} resizeMode="cover" />
                    <View style={styles.curatedTextWrap}>
                      <Text style={styles.curatedTitle}>{c.title}</Text>
                      <Text style={styles.curatedSubtitle}>{c.subtitle}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.organicStrip}>
              <View style={styles.organicIconWrap}>
                <Image source={images.organicTagline} style={styles.organicIcon} resizeMode="contain" />
              </View>
              <View style={styles.organicTextWrap}>
                <Text style={styles.organicTitle}>100% certified organic</Text>
                <Text style={styles.organicSubtitle}>Every product is lab-checked for purity &amp; freshness.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  headerWrap: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  locBtn: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  locTextWrap: { flex: 1, minWidth: 0 },
  locTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locTitle: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 13.5, color: colors.text },
  locSub: { fontFamily: fontFamily.semibold, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  iconBtn: {
    width: 40, height: 40, borderRadius: radii.lg, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeLabel: { fontFamily: fontFamily.bold, fontSize: 9, color: colors.white },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  skeletonWrap: { marginTop: 16 },
  skeletonCats: { marginTop: 20 },
  skeletonGrid: { marginTop: 20 },

  orderBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.text,
    borderRadius: radii.xl, padding: 14, marginTop: 14,
  },
  orderBannerText: { flex: 1, minWidth: 0 },
  orderBannerTitle: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.white },
  orderBannerSub: { fontFamily: fontFamily.semibold, fontSize: 12, color: 'rgba(255,255,255,0.67)', marginTop: 2 },

  heroCard: {
    marginTop: 16,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    minHeight: 168,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { padding: 20, maxWidth: '76%' },
  heroTag: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)', borderRadius: radii.round, paddingVertical: 5, paddingHorizontal: 11,
  },
  heroTagLabel: { fontFamily: fontFamily.bold, fontSize: 10.5, color: colors.white, letterSpacing: 1 },
  heroTitle: { fontFamily: fontFamily.bold, fontSize: 24, color: colors.white, marginTop: 12, lineHeight: 27 },
  heroSubtitle: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.white, opacity: 0.94, marginTop: 6 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 15,
    backgroundColor: colors.white, borderRadius: radii.lg - 1, paddingVertical: 10, paddingHorizontal: 16,
  },
  heroCtaLabel: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.primaryDark },

  section: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text },
  seeAll: { fontFamily: fontFamily.bold, fontSize: 12.5, color: colors.primary },

  // Rails bleed to the screen edge, matching the design's negative margins.
  railOuter: { marginHorizontal: -16 },
  catRail: { gap: 14, paddingHorizontal: 16, paddingVertical: 2 },
  catItem: { width: 76, alignItems: 'center', gap: 7 },
  catImageWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.borderLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#14231A', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  catImage: { width: '100%', height: '100%' },
  catLabel: { fontFamily: fontFamily.bold, fontSize: 10.5, color: colors.text, textAlign: 'center', lineHeight: 13, height: 26 },

  // 48% + space-between: two columns hold at every width.
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  gridItem: { width: '48%', minWidth: 0 },

  curatedRail: { gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  curatedCard: { width: 150, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  curatedImage: { width: '100%', height: 96, backgroundColor: colors.placeholder },
  curatedTextWrap: { paddingVertical: 10, paddingHorizontal: 12 },
  curatedTitle: { fontFamily: fontFamily.bold, fontSize: 13.5, color: colors.text },
  curatedSubtitle: { fontFamily: fontFamily.semibold, fontSize: 11.5, color: colors.textMuted, marginTop: 1 },

  organicStrip: {
    marginTop: 22, borderRadius: radii.xl + 2, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18,
  },
  organicIconWrap: {
    width: 56, height: 56, borderRadius: radii.xl - 2, backgroundColor: colors.tint,
    alignItems: 'center', justifyContent: 'center',
  },
  organicIcon: { width: '80%', height: '80%' },
  organicTextWrap: { flex: 1, minWidth: 0 },
  organicTitle: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.primaryDark },
  organicSubtitle: { fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
});
