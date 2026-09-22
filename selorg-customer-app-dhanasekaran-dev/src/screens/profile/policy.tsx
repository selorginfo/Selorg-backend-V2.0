import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Header, ScreenContainer, Skeleton } from '../../components';
import { colors, fontFamily, radii, spacing } from '../../theme';
import { legalApi } from '../../services/legal.service';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function paragraphsFromContent(content?: string): string[] {
  if (!content?.trim()) return [];
  return content
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
}

export default function PolicyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Legal'>>();
  const isTerms = route.params.type === 'terms';
  const title = isTerms ? 'Terms of Service' : 'Privacy Policy';

  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = isTerms ? legalApi.getTerms() : legalApi.getPrivacy();
    load
      .then(doc => {
        const content = typeof doc.content === 'string' ? doc.content : (doc as { body?: string }).body;
        const parts = paragraphsFromContent(content);
        setParagraphs(parts.length ? parts : [`${title} content is not available yet.`]);
      })
      .catch(() => {
        setParagraphs([`${title} could not be loaded. Please try again later.`]);
      })
      .finally(() => setLoading(false));
  }, [isTerms, title]);

  return (
    <ScreenContainer>
      <Header title={title} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={styles.loader}>
          <Skeleton height={22} width="55%" radius={8} style={{ marginBottom: 16 }} />
          <Skeleton height={12} radius={6} style={{ marginBottom: 10 }} />
          <Skeleton height={12} radius={6} style={{ marginBottom: 10 }} />
          <Skeleton height={12} width="92%" radius={6} style={{ marginBottom: 10 }} />
          <Skeleton height={12} width="80%" radius={6} style={{ marginBottom: 18 }} />
          <Skeleton height={12} radius={6} style={{ marginBottom: 10 }} />
          <Skeleton height={12} width="88%" radius={6} style={{ marginBottom: 10 }} />
          <Skeleton height={12} width="70%" radius={6} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.heading}>{title}</Text>
            {paragraphs.map((p, i) => (
              <Text key={i} style={styles.paragraph}>{p}</Text>
            ))}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  heading: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.text, marginBottom: spacing.md },
  paragraph: { fontFamily: fontFamily.medium, fontSize: 13.5, color: colors.textMuted, lineHeight: 21, marginBottom: spacing.md },
});
