import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArtisanColors } from '@/constants/colors';
import { ProductDraft, ProductPricing } from '@/types/product';
import { hasGeminiKey } from '@/services/aiConfig';
import { generateProductImageWithGemini } from '@/services/geminiService';
import { getPricingService } from '@/services/pricingService';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from '@/i18n/LanguageContext';

export default function AICatalogScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ draft: string }>();

  const [draft, setDraft] = useState<ProductDraft>(() => {
    try {
      if (params.draft) return JSON.parse(params.draft);
    } catch {}
    return {
      id: '',
      images: [],
      voiceLanguage: 'hi-IN',
      audioUri: null,
      transcript: '',
      title: '',
      shortDescription: '',
      description: '',
      keyFeatures: [],
      idealFor: [],
      seoKeywords: [],
      metaTitle: '',
      metaDescription: '',
      tags: [],
      category: '',
      generatedImage: null,
    };
  });

  const [pricing, setPricing] = useState<ProductPricing | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPricing, setIsGeneratingPricing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  const showInline = (
    type: 'error' | 'success',
    text: string,
    alertTitle?: string
  ) => {
    setInlineMessage({ type, text });
    if (alertTitle) {
      Alert.alert(alertTitle, text);
    }
  };

  const handleCopyListing = async () => {
    const features =
      draft.keyFeatures.length > 0
        ? `\n\n${t('keyFeatures')}:\n` + draft.keyFeatures.map((f) => `• ${f}`).join('\n')
        : '';
    const ideal =
      draft.idealFor.length > 0
        ? `\n\n${t('idealFor')}:\n` + draft.idealFor.map((i) => `• ${i}`).join('\n')
        : '';
    const text = [
      draft.title,
      '',
      draft.shortDescription,
      '',
      draft.description,
      features,
      ideal,
    ]
      .filter(Boolean)
      .join('\n');
    await Clipboard.setStringAsync(text);
    showInline('success', t('copiedSuccess'));
  };

  const handleContinue = () => {
    Alert.alert(t('continueToPricing'), t('catalogHelperText'));
  };

  const handleGenerateImage = async () => {
    setInlineMessage(null);
    if (!hasGeminiKey) {
      showInline(
        'error',
        'Add your EXPO_PUBLIC_GEMINI_API_KEY to .env.local to enable AI image generation.',
        'Gemini Key Required'
      );
      return;
    }
    if (!draft.title && !draft.description) {
      showInline(
        'error',
        t('needInfoMsg'),
        t('needInfoTitle')
      );
      return;
    }

    setIsGeneratingImage(true);
    try {
      const result = await generateProductImageWithGemini({
        images: draft.images,
        productTitle: draft.title,
        productDescription: draft.description,
      });
      setDraft((prev) => ({ ...prev, generatedImage: result.base64Image }));
      showInline('success', t('imageGeneratedSuccess'));
    } catch {
      showInline(
        'error',
        t('imageFailedMsg'),
        t('imageFailedTitle')
      );
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGeneratePricing = async () => {
    setInlineMessage(null);
    setIsGeneratingPricing(true);
    try {
      const service = getPricingService();
      const result = await service.generatePricing({
        images: draft.images,
        transcript: draft.transcript,
        language: draft.voiceLanguage,
        rawMaterialCost: draft.rawMaterialCost,
        makingCost: draft.makingCost,
      });
      setPricing(result);
      showInline('success', t('pricingGenerated'));
    } catch {
      showInline(
        'error',
        t('pricingFailedMsg'),
        t('pricingFailedTitle')
      );
    } finally {
      setIsGeneratingPricing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t('aiHeaderTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Step Indicator */}
        <View style={styles.steps}>
          <View style={styles.stepItem}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepText}>1</Text>
            </View>
            <Text style={styles.stepLabel}>{t('stepProduct')}</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.activeStep]}>
              <Text style={styles.activeStepText}>2</Text>
            </View>
            <Text style={styles.activeStepLabel}>{t('stepAI')}</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepText}>3</Text>
            </View>
            <Text style={styles.stepLabel}>{t('stepPricing')}</Text>
          </View>
        </View>

        <Text style={styles.introText}>
          {t('catalogIntro')}
        </Text>

        {/* Inline feedback (works on web where Alert.alert is a no-op) */}
        {inlineMessage ? (
          <View
            style={[
              styles.inlineMessage,
              inlineMessage.type === 'error'
                ? styles.inlineMessageError
                : styles.inlineMessageSuccess,
            ]}
          >
            <Text style={styles.inlineMessageText}>{inlineMessage.text}</Text>
          </View>
        ) : null}

        {/* Copy Listing */}
        <Pressable
          style={styles.copyButton}
          onPress={handleCopyListing}
        >
          <Text style={styles.copyButtonText}>{t('copyListing')}</Text>
        </Pressable>

        {/* Product Photos Preview */}
        {draft.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('productPhotos')}</Text>
            <FlatList
              horizontal
              data={draft.images}
              keyExtractor={(item, i) => `${item.uri}-${i}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoCarousel}
              renderItem={({ item, index }) => (
                <View style={styles.carouselItem}>
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.carouselImage}
                  />
                  {index === 0 && (
                    <View style={styles.coverBadge}>
                      <Text style={styles.coverBadgeText}>{t('cover')}</Text>
                    </View>
                  )}
                </View>
              )}
            />
          </View>
        )}

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('category')}</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={styles.fieldInput}
              value={draft.category}
              onChangeText={(text) =>
                setDraft((prev) => ({ ...prev, category: text }))
              }
              placeholder={t('categoryPlaceholder')}
              placeholderTextColor={ArtisanColors.muted}
            />
          </View>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('productTitle')}</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={styles.fieldInput}
              value={draft.title}
              onChangeText={(text) =>
                setDraft((prev) => ({ ...prev, title: text }))
              }
              placeholder={t('titlePlaceholder')}
              placeholderTextColor={ArtisanColors.muted}
            />
          </View>
        </View>

        {/* Short Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('shortDesc')}</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMultiline]}
              value={draft.shortDescription}
              onChangeText={(text) =>
                setDraft((prev) => ({ ...prev, shortDescription: text }))
              }
              multiline
              textAlignVertical="top"
              placeholder={t('shortDescPlaceholder')}
              placeholderTextColor={ArtisanColors.muted}
            />
          </View>
        </View>

        {/* Detailed Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('detailDesc')}</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputLarge]}
              value={draft.description}
              onChangeText={(text) =>
                setDraft((prev) => ({ ...prev, description: text }))
              }
              multiline
              textAlignVertical="top"
              placeholder={t('detailDescPlaceholder')}
              placeholderTextColor={ArtisanColors.muted}
            />
          </View>
        </View>

        {/* Key Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('keyFeatures')}</Text>
          <View style={styles.fieldCard}>
            {draft.keyFeatures.length > 0 ? (
              draft.keyFeatures.map((feature, i) => (
                <View key={`feat-${i}`} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{feature}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.sectionHint}>
                {t('noKeyFeatures')}
              </Text>
            )}
          </View>
        </View>

        {/* Ideal For / Use Cases */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('idealFor')}</Text>
          <View style={styles.tagsContainer}>
            {draft.idealFor.length > 0 ? (
              draft.idealFor.map((item, i) => (
                <View key={`ideal-${i}`} style={styles.tag}>
                  <Text style={styles.tagText}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.sectionHint}>{t('noUseCases')}</Text>
            )}
          </View>
        </View>

        {/* Advanced SEO (collapsed by default) */}
        <Pressable
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced((prev) => !prev)}
        >
          <Text style={styles.advancedToggleText}>{t('advancedSeo')}</Text>
          <Text style={styles.advancedToggleHint}>
            {showAdvanced ? t('hideAdvanced') : t('showAdvanced')}
          </Text>
        </Pressable>

        {showAdvanced && (
          <>
        {/* SEO Keywords */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('seoKeywords')}</Text>
          <View style={styles.tagsContainer}>
            {draft.seoKeywords.map((keyword, i) => (
              <View key={`kw-${i}`} style={styles.tag}>
                <Text style={styles.tagText}>{keyword}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('tags')}</Text>
          <View style={styles.tagsContainer}>
            {draft.tags.map((tag, i) => (
              <View key={`tag-${i}`} style={styles.tagAlt}>
                <Text style={styles.tagAltText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Meta Title & Meta Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('metaTitle')}</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={styles.fieldInput}
              value={draft.metaTitle}
              onChangeText={(text) =>
                setDraft((prev) => ({ ...prev, metaTitle: text }))
              }
              placeholder={t('metaTitlePlaceholder')}
              placeholderTextColor={ArtisanColors.muted}
            />
          </View>
          <Text style={styles.sectionHint}>
            {draft.metaTitle.length}/60
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('metaDesc')}</Text>
          <View style={styles.fieldCard}>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputLarge]}
              value={draft.metaDescription}
              onChangeText={(text) =>
                setDraft((prev) => ({ ...prev, metaDescription: text }))
              }
              multiline
              textAlignVertical="top"
              placeholder={t('metaDescPlaceholder')}
              placeholderTextColor={ArtisanColors.muted}
            />
          </View>
          <Text style={styles.sectionHint}>
            {draft.metaDescription.length}/160
          </Text>
        </View>
          </>
        )}

        {/* Voice Transcript */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('yourVoiceDesc')}</Text>
          <View style={styles.transcriptCard}>
            <Text style={styles.transcriptText}>{draft.transcript}</Text>
          </View>
        </View>

        {/* AI Image Generation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aiProductImage')}</Text>
          <Text style={styles.sectionHint}>
            {t('imageHint')}
          </Text>

          {draft.generatedImage ? (
            <View style={styles.fieldCard}>
              <Image
                source={{ uri: `data:image/png;base64,${draft.generatedImage}` }}
                style={styles.generatedImage}
                resizeMode="contain"
              />
              <Pressable
                style={styles.regenerateButton}
                onPress={handleGenerateImage}
                disabled={isGeneratingImage}
              >
                {isGeneratingImage ? (
                  <ActivityIndicator size="small" color={ArtisanColors.primary} />
                ) : (
                  <Text style={styles.regenerateText}>
                    {t('regenerateImage')}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.regenerateButton}
              onPress={handleGenerateImage}
              disabled={isGeneratingImage}
            >
              {isGeneratingImage ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={ArtisanColors.primary} />
                  <Text style={styles.regenerateText}>{t('creatingImage')}</Text>
                </View>
              ) : (
                <Text style={styles.regenerateText}>{t('generateProductImage')}</Text>
              )}
            </Pressable>
          )}
        </View>

        {/* AI Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('aiPrice')}</Text>
          <Text style={styles.sectionHint}>
            {t('priceHint')}
          </Text>

          {pricing ? (
            <View style={styles.pricingCard}>
              <Text style={styles.pricingTitle}>{t('suggestedRetail')}</Text>
              <Text style={styles.pricingAmount}>
                ₹{pricing.suggestedRetailPrice}
              </Text>
              <View style={styles.pricingRow}>
                <View style={styles.pricingItem}>
                  <Text style={styles.pricingItemLabel}>{t('wholesale')}</Text>
                  <Text style={styles.pricingItemValue}>
                    ₹{pricing.suggestedWholesalePrice}
                  </Text>
                </View>
                <View style={styles.pricingItem}>
                  <Text style={styles.pricingItemLabel}>{t('range')}</Text>
                  <Text style={styles.pricingItemValue}>
                    ₹{pricing.minRetailPrice} – ₹{pricing.maxRetailPrice}
                  </Text>
                </View>
              </View>

              {pricing.competitors.length > 0 && (
                <View style={styles.competitorContainer}>
                  <Text style={styles.competitorTitle}>
                    {t('competitorRef')}
                  </Text>
                  {pricing.competitors.map((c, i) => (
                    <View key={`comp-${i}`} style={styles.competitorRow}>
                      <Text style={styles.competitorName}>
                        {c.platform}: {c.productName}
                      </Text>
                      <Text style={styles.competitorPrice}>
                        ₹{c.price}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {pricing.reasoning ? (
                <Text style={styles.pricingReasoning}>{pricing.reasoning}</Text>
              ) : null}

              <Pressable
                style={styles.regenerateButton}
                onPress={handleGeneratePricing}
                disabled={isGeneratingPricing}
              >
                {isGeneratingPricing ? (
                  <Text style={styles.regenerateText}>{t('analyzingPrices')}</Text>
                ) : (
                  <Text style={styles.regenerateText}>{t('refreshPrice')}</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={styles.regenerateButton}
              onPress={handleGeneratePricing}
              disabled={isGeneratingPricing}
            >
              {isGeneratingPricing ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={ArtisanColors.primary} />
                  <Text style={styles.regenerateText}>
                    {t('comparingPrices')}
                  </Text>
                </View>
              ) : (
                <Text style={styles.regenerateText}>
                  {t('suggestBestPrice')}
                </Text>
              )}
            </Pressable>
          )}
        </View>

        {/* Continue Button */}
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>{t('continueToPricing')}</Text>
          <Text style={styles.continueArrow}>→</Text>
        </Pressable>

        <Text style={styles.helperText}>
          {t('catalogHelperText')}
        </Text>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ArtisanColors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginBottom: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ArtisanColors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ArtisanColors.border,
  },
  backIcon: {
    fontSize: 32,
    color: ArtisanColors.darkLight,
    lineHeight: 34,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ArtisanColors.dark,
  },
  headerSpacer: {
    width: 42,
  },

  // Steps
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ArtisanColors.tagBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStep: {
    backgroundColor: ArtisanColors.primary,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '700',
    color: ArtisanColors.muted,
  },
  activeStepText: {
    fontSize: 13,
    fontWeight: '700',
    color: ArtisanColors.white,
  },
  stepLabel: {
    fontSize: 10,
    color: ArtisanColors.muted,
    marginTop: 5,
  },
  activeStepLabel: {
    fontSize: 10,
    color: ArtisanColors.primary,
    fontWeight: '700',
    marginTop: 5,
  },
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: ArtisanColors.borderMedium,
    marginHorizontal: 8,
    marginBottom: 16,
  },

  introText: {
    fontSize: 14,
    color: ArtisanColors.mutedMedium,
    lineHeight: 21,
    marginBottom: 24,
  },
  inlineMessage: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  inlineMessageError: {
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.35)',
  },
  inlineMessageSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.35)',
  },
  inlineMessageText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: ArtisanColors.dark,
  },

  // Copy Listing
  copyButton: {
    backgroundColor: ArtisanColors.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  copyButtonText: {
    color: ArtisanColors.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // Advanced SEO toggle
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ArtisanColors.iconBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: ArtisanColors.border,
  },
  advancedToggleText: {
    fontSize: 15,
    fontWeight: '700',
    color: ArtisanColors.darkMedium,
  },
  advancedToggleHint: {
    fontSize: 12,
    fontWeight: '600',
    color: ArtisanColors.primary,
  },

  // Sections
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ArtisanColors.darkMedium,
    marginBottom: 10,
  },

  // Photo Carousel
  photoCarousel: {
    gap: 10,
  },
  carouselItem: {
    width: 120,
    height: 120,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: ArtisanColors.primary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  coverBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: ArtisanColors.white,
  },

  // Fields
  fieldCard: {
    backgroundColor: ArtisanColors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ArtisanColors.border,
    padding: 14,
  },
  fieldInput: {
    fontSize: 15,
    color: ArtisanColors.dark,
    padding: 0,
    lineHeight: 22,
  },
  fieldInputMultiline: {
    minHeight: 60,
  },
  fieldInputLarge: {
    minHeight: 140,
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: ArtisanColors.iconBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: ArtisanColors.primary,
  },
  tagAlt: {
    backgroundColor: ArtisanColors.tagBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagAltText: {
    fontSize: 12,
    fontWeight: '600',
    color: ArtisanColors.darkMedium,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: ArtisanColors.primary,
    marginRight: 8,
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: ArtisanColors.dark,
    lineHeight: 21,
  },

  // Transcript
  transcriptCard: {
    backgroundColor: ArtisanColors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ArtisanColors.border,
    padding: 14,
  },
  transcriptText: {
    fontSize: 14,
    color: ArtisanColors.dark,
    lineHeight: 21,
  },

  // Regenerate
  regenerateButton: {
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ArtisanColors.borderMedium,
    marginBottom: 12,
    marginTop: 4,
  },
  regenerateText: {
    color: ArtisanColors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 12,
    color: ArtisanColors.muted,
    lineHeight: 17,
    marginBottom: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  generatedImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    marginBottom: 10,
  },
  pricingCard: {
    backgroundColor: ArtisanColors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ArtisanColors.border,
    padding: 16,
  },
  pricingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: ArtisanColors.muted,
    textAlign: 'center',
  },
  pricingAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: ArtisanColors.primary,
    textAlign: 'center',
    marginVertical: 8,
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  pricingItem: {
    flex: 1,
    backgroundColor: ArtisanColors.background,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  pricingItemLabel: {
    fontSize: 11,
    color: ArtisanColors.muted,
    marginBottom: 4,
  },
  pricingItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: ArtisanColors.dark,
  },
  competitorContainer: {
    marginTop: 4,
    marginBottom: 12,
  },
  competitorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: ArtisanColors.darkMedium,
    marginBottom: 6,
  },
  competitorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: ArtisanColors.border,
  },
  competitorName: {
    flex: 1,
    fontSize: 12,
    color: ArtisanColors.darkMedium,
    marginRight: 10,
  },
  competitorPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: ArtisanColors.dark,
  },
  pricingReasoning: {
    fontSize: 12,
    color: ArtisanColors.muted,
    lineHeight: 18,
    marginBottom: 12,
  },

  // Continue
  continueButton: {
    backgroundColor: ArtisanColors.primary,
    borderRadius: 17,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueText: {
    color: ArtisanColors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  continueArrow: {
    color: ArtisanColors.white,
    fontSize: 22,
    marginLeft: 10,
  },
  helperText: {
    fontSize: 11,
    color: ArtisanColors.muted,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 12,
    paddingHorizontal: 15,
  },
});
