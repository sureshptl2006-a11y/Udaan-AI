import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Image,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { ArtisanColors } from '@/constants/colors';
import {
  ProductImage,
  ProductDraft,
  VoiceLanguageCode,
  AVAILABLE_LANGUAGES,
  createEmptyDraft,
} from '@/types/product';
import { getSpeechToTextService } from '@/services/speechToTextService';
import { getAICatalogService } from '@/services/aiCatalogService';
import { useTranslation } from '@/i18n/LanguageContext';

const MAX_PHOTOS = 7;

type RecordingState = 'idle' | 'recording' | 'processing' | 'transcribed' | 'error';

export default function AddProductScreen() {
  const { t, setLanguage, nativeLabel } = useTranslation();
  const [draft, setDraft] = useState<ProductDraft>(createEmptyDraft);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [inlineMessage, setInlineMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [rawMaterialCost, setRawMaterialCost] = useState('');
  const [makingCost, setMakingCost] = useState('');

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- Photo Functions ---

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('cameraPermissionTitle'), t('cameraPermissionMsg'));
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('galleryPermissionTitle'), t('galleryPermissionMsg'));
      return false;
    }
    return true;
  };

  const addImages = useCallback(
    (newImages: ProductImage[]) => {
      setDraft((prev) => {
        const combined = [...prev.images, ...newImages].slice(0, MAX_PHOTOS);
        return { ...prev, images: combined };
      });
    },
    []
  );

  const removeImage = useCallback((index: number) => {
    setDraft((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  }, []);

  const handleTakePhoto = async () => {
    setShowPhotoOptions(false);
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const remaining = MAX_PHOTOS - draft.images.length;
      if (remaining <= 0) {
        Alert.alert(t('maxPhotosTitle'), t('maxPhotosMsg', { max: MAX_PHOTOS }));
        return;
      }

      const assets = result.assets.slice(0, remaining);
      if (result.assets.length > remaining) {
        Alert.alert(
          t('photoLimitTitle'),
          t('photoLimitMsg', { n: remaining, max: MAX_PHOTOS })
        );
      }

      addImages(
        assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }))
      );
    } catch {
      // User cancelled or camera error — do nothing
    }
  };

  const handleChooseFromGallery = async () => {
    setShowPhotoOptions(false);
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const remaining = MAX_PHOTOS - draft.images.length;
      if (remaining <= 0) {
        Alert.alert(t('maxPhotosTitle'), t('maxPhotosMsg', { max: MAX_PHOTOS }));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });

      if (result.canceled || !result.assets?.length) return;

      const assets = result.assets.slice(0, remaining);
      if (result.assets.length > remaining) {
        Alert.alert(
          t('photoLimitTitle'),
          t('photoLimitMsg', { n: remaining, max: MAX_PHOTOS })
        );
      }

      addImages(
        assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }))
      );
    } catch {
      // User cancelled or gallery error — do nothing
    }
  };

  // --- Voice Recording Functions ---

  const handleStartRecording = async () => {
    setErrorMessage('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('micPermissionTitle'), t('micPermissionMsg'));
        setRecordingState('error');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      setRecordingState('recording');
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      Alert.alert(t('recordingErrorTitle'), t('recordingErrorMsg'));
      setRecordingState('error');
    }
  };

  const handleStopRecording = async () => {
    if (!recorder.isRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recorder.stop();
      const uri = recorder.uri;

      await setAudioModeAsync({ allowsRecording: false });

      setDraft((prev) => ({ ...prev, audioUri: uri }));
      setRecordingState('processing');

      // Transcribe the audio
      const sttService = getSpeechToTextService();
      const result = await sttService.transcribeAudio({
        audioUri: uri ?? '',
        language: draft.voiceLanguage,
      });

      setDraft((prev) => ({
        ...prev,
        transcript: result.transcript,
      }));
      setRecordingState('transcribed');
    } catch {
      Alert.alert(t('saveRecordingErrorTitle'), t('saveRecordingErrorMsg'));
      setRecordingState('error');
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- AI Generation ---

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

  const handleGenerateCatalog = async () => {
    setInlineMessage(null);

    if (draft.images.length === 0) {
      showInline(
        'error',
        t('validatePhotoMsg'),
        t('validatePhotoTitle')
      );
      return;
    }

    if (!draft.transcript.trim()) {
      showInline(
        'error',
        t('validateDescMsg'),
        t('validateDescTitle')
      );
      return;
    }

    setIsGenerating(true);

    try {
      const aiService = getAICatalogService();
      const result = await aiService.generateCatalog({
        images: draft.images,
        transcript: draft.transcript,
        language: draft.voiceLanguage,
      });

      const parsedMatCost = Number(rawMaterialCost) || 0;
      const parsedMakingCost = Number(makingCost) || 0;

      const updatedDraft: ProductDraft = {
        ...draft,
        rawMaterialCost: parsedMatCost,
        makingCost: parsedMakingCost,
        totalCost: parsedMatCost + parsedMakingCost,
        title: result.title,
        shortDescription: result.shortDescription,
        description: result.description,
        keyFeatures: result.keyFeatures ?? [],
        idealFor: result.idealFor ?? [],
        seoKeywords: result.seoKeywords,
        metaTitle: result.metaTitle ?? '',
        metaDescription: result.metaDescription ?? '',
        tags: result.tags,
        category: result.category,
      };

      router.push({
        pathname: '/ai-catalog',
        params: { draft: JSON.stringify(updatedDraft) },
      });
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'Please try again.';
      showInline(
        'error',
        `${t('generationErrorTitle')}: ${reason}`,
        t('generationErrorTitle')
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Language Helpers ---

  const currentLanguage = AVAILABLE_LANGUAGES.find(
    (l) => l.code === draft.voiceLanguage
  );

  const handleSelectLanguage = (code: VoiceLanguageCode) => {
    setDraft((prev) => ({ ...prev, voiceLanguage: code }));
    setLanguage(code);
    setShowLanguagePicker(false);
  };

  // --- Recording Button Label ---

  const getRecordingLabel = (): string => {
    switch (recordingState) {
      case 'recording':
        return t('listening', { time: formatDuration(recordingDuration) });
      case 'processing':
        return t('transcribing');
      case 'transcribed':
        return t('tapToRerecord');
      case 'error':
        return t('tapToTryAgain');
      default:
        return t('tapToSpeak');
    }
  };

  const hasPhotos = draft.images.length > 0;
  const hasTranscript = draft.transcript.trim().length > 0;

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
          <Text style={styles.headerTitle}>{t('addHeaderTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Step Indicator */}
        <View style={styles.steps}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.activeStep]}>
              <Text style={styles.activeStepText}>1</Text>
            </View>
            <Text style={styles.activeStepLabel}>{t('stepProduct')}</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepText}>2</Text>
            </View>
            <Text style={styles.stepLabel}>{t('stepAI')}</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepText}>3</Text>
            </View>
            <Text style={styles.stepLabel}>{t('stepPricing')}</Text>
          </View>
        </View>

        {/* Introduction */}
        <View style={styles.introduction}>
          <Text style={styles.title}>{t('introTitle')}</Text>
          <Text style={styles.subtitle}>
            {t('introSubtitle')}
          </Text>
        </View>

        {/* Product Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('productPhotoSection')}</Text>

          {hasPhotos ? (
            <View>
              {/* Photo counter */}
              <View style={styles.photoCounterRow}>
                <Text style={styles.photoCounter}>
                  {t('photoCount', { count: draft.images.length, max: MAX_PHOTOS })}
                </Text>
                {draft.images.length < MAX_PHOTOS && (
                  <Pressable
                    style={styles.addMoreButton}
                    onPress={() => setShowPhotoOptions(true)}
                  >
                    <Text style={styles.addMoreText}>{t('addMore')}</Text>
                  </Pressable>
                )}
              </View>

              {/* Photo grid */}
              <View style={styles.photoGrid}>
                {draft.images.map((img, index) => (
                  <View key={`${img.uri}-${index}`} style={styles.photoItem}>
                    <Image
                      source={{ uri: img.uri }}
                      style={styles.photoThumb}
                    />
                    {index === 0 && (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeText}>{t('cover')}</Text>
                      </View>
                    )}
                    <Pressable
                      style={styles.removePhotoButton}
                      onPress={() => removeImage(index)}
                    >
                      <Text style={styles.removePhotoText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              {draft.images.length < MAX_PHOTOS && (
                <Pressable
                  style={styles.addMoreCard}
                  onPress={() => setShowPhotoOptions(true)}
                >
                  <Text style={styles.addMoreCardIcon}>+</Text>
                  <Text style={styles.addMoreCardText}>{t('addPhoto')}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable
              style={styles.photoBox}
              onPress={() => setShowPhotoOptions(true)}
            >
              <View style={styles.photoIconCircle}>
                <Text style={styles.photoIcon}>📷</Text>
              </View>
              <Text style={styles.photoTitle}>{t('addProductPhotoModal')}</Text>
              <Text style={styles.photoSubtitle}>
                {t('photoSubtitle')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Voice Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('tellUsTitle')}</Text>

          {/* Language selector */}
          <Pressable
            style={styles.languageSelector}
            onPress={() => setShowLanguagePicker(true)}
          >
            <Text style={styles.languageLabel}>{t('languageLabel')}</Text>
            <Text style={styles.languageValue}>
              {currentLanguage?.nativeLabel} ({currentLanguage?.label})
            </Text>
            <Text style={styles.languageArrow}>▾</Text>
          </Pressable>

          {/* Recording box */}
          <Pressable
            style={[
              styles.voiceBox,
              recordingState === 'recording' && styles.voiceBoxRecording,
              recordingState === 'transcribed' && styles.voiceBoxTranscribed,
            ]}
            onPress={() => {
              if (recordingState === 'recording') {
                handleStopRecording();
              } else {
                handleStartRecording();
              }
            }}
          >
            <View
              style={[
                styles.microphoneCircle,
                recordingState === 'recording' &&
                  styles.microphoneCircleRecording,
                recordingState === 'transcribed' &&
                  styles.microphoneCircleTranscribed,
              ]}
            >
              {recordingState === 'processing' ? (
                <ActivityIndicator size="small" color={ArtisanColors.primary} />
              ) : (
                <Text style={styles.microphoneIcon}>
                  {recordingState === 'recording' ? '⏹' : '🎙️'}
                </Text>
              )}
            </View>

            <View style={styles.voiceText}>
              <Text
                style={[
                  styles.voiceTitle,
                  recordingState === 'recording' && styles.voiceTitleRecording,
                ]}
              >
                {getRecordingLabel()}
              </Text>
              {recordingState !== 'recording' &&
                recordingState !== 'processing' && (
                  <Text style={styles.voiceSubtitle}>
                    {recordingState === 'transcribed'
                      ? t('voiceSubtitleRecorded')
                      : t('voiceSubtitleIdle')}
                  </Text>
                )}
              {recordingState === 'recording' && (
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingTime}>
                    {t('recordingIn', {
                      lang: currentLanguage?.label || nativeLabel,
                    })}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>

          {/* Error message */}
          {recordingState === 'error' && errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Type a description instead (works on web / without a mic) */}
          <Pressable
            style={styles.typeInsteadButton}
            onPress={() => setShowManualInput((prev) => !prev)}
          >
            <Text style={styles.typeInsteadText}>
              {showManualInput ? t('hideTyped') : t('typeInstead')}
            </Text>
          </Pressable>

          {showManualInput && (
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptLabel}>{t('yourDescription')}</Text>
              <TextInput
                style={styles.transcriptInput}
                value={draft.transcript}
                onChangeText={(text) =>
                  setDraft((prev) => ({ ...prev, transcript: text }))
                }
                multiline
                textAlignVertical="top"
                placeholder={t('describePlaceholder')}
                placeholderTextColor={ArtisanColors.muted}
              />
            </View>
          )}

          {/* Transcribed text */}
          {hasTranscript && !showManualInput && (
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptLabel}>{t('yourDescription')}</Text>
              <TextInput
                style={styles.transcriptInput}
                value={draft.transcript}
                onChangeText={(text) =>
                  setDraft((prev) => ({ ...prev, transcript: text }))
                }
                multiline
                textAlignVertical="top"
                placeholder={t('editPlaceholder')}
                placeholderTextColor={ArtisanColors.muted}
              />
            </View>
          )}
        </View>

        {/* Cost */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('costTitle')}</Text>
          <View style={styles.costBox}>
            <Text style={styles.rupee}>₹</Text>
            <View style={styles.costFields}>
              <Text style={styles.costTitle}>{t('rawMakingTitle')}</Text>
              <Text style={styles.costSubtitle}>
                {t('costSubtitle')}
              </Text>
              <View style={styles.costInputs}>
                <View style={styles.costInputWrap}>
                  <Text style={styles.costInputLabel}>{t('materialLabel')}</Text>
                  <TextInput
                    style={styles.costInput}
                    value={rawMaterialCost}
                    onChangeText={setRawMaterialCost}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={ArtisanColors.muted}
                  />
                </View>
                <View style={styles.costInputWrap}>
                  <Text style={styles.costInputLabel}>{t('makingLabel')}</Text>
                  <TextInput
                    style={styles.costInput}
                    value={makingCost}
                    onChangeText={setMakingCost}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={ArtisanColors.muted}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

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

        {/* Continue Button */}
        <Pressable
          style={[
            styles.continueButton,
            isGenerating && styles.continueButtonDisabled,
          ]}
          onPress={handleGenerateCatalog}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={ArtisanColors.white} />
              <Text style={styles.continueText}>
                {t('aiCreating')}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.continueText}>{t('continueAI')}</Text>
              <Text style={styles.continueArrow}>→</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.helperText}>
          {t('helperTextAdd')}
        </Text>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Photo Options Modal */}
      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPhotoOptions(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t('addProductPhotoModal')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('chooseHowToAdd')}
            </Text>

            <Pressable
              style={styles.modalOption}
              onPress={handleTakePhoto}
            >
              <Text style={styles.modalOptionIcon}>📷</Text>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>{t('takePhoto')}</Text>
                <Text style={styles.modalOptionDesc}>
                  {t('takePhotoDesc')}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={handleChooseFromGallery}
            >
              <Text style={styles.modalOptionIcon}>🖼️</Text>
              <View style={styles.modalOptionText}>
                <Text style={styles.modalOptionTitle}>{t('chooseGallery')}</Text>
                <Text style={styles.modalOptionDesc}>
                  {t('chooseGalleryDesc')}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setShowPhotoOptions(false)}
            >
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLanguagePicker(false)}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.modalTitle}>{t('selectLanguageTitle')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('selectLanguageSub')}
            </Text>

            <FlatList
              data={AVAILABLE_LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.languageOption,
                    draft.voiceLanguage === item.code &&
                      styles.languageOptionSelected,
                  ]}
                  onPress={() => handleSelectLanguage(item.code)}
                >
                  <Text
                    style={[
                      styles.languageOptionNative,
                      draft.voiceLanguage === item.code &&
                        styles.languageOptionSelectedText,
                    ]}
                  >
                    {item.nativeLabel}
                  </Text>
                  <Text
                    style={[
                      styles.languageOptionEnglish,
                      draft.voiceLanguage === item.code &&
                        styles.languageOptionSelectedText,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setShowLanguagePicker(false)}
            >
              <Text style={styles.modalCancelText}>{t('cancel')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    fontSize: 19,
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
    marginBottom: 30,
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

  // Introduction
  introduction: {
    marginBottom: 26,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: ArtisanColors.dark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: ArtisanColors.mutedMedium,
  },

  // Sections
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ArtisanColors.darkMedium,
    marginBottom: 12,
  },

  // Photo Box (empty state)
  photoBox: {
    backgroundColor: ArtisanColors.white,
    borderRadius: 20,
    minHeight: 190,
    borderWidth: 1.5,
    borderColor: ArtisanColors.borderDashed,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },
  photoIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: ArtisanColors.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoIcon: {
    fontSize: 28,
  },
  photoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: ArtisanColors.darkMedium,
    marginBottom: 5,
  },
  photoSubtitle: {
    fontSize: 12,
    color: ArtisanColors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Photo Grid (has photos)
  photoCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  photoCounter: {
    fontSize: 13,
    fontWeight: '600',
    color: ArtisanColors.darkMedium,
  },
  addMoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: ArtisanColors.iconBg,
  },
  addMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: ArtisanColors.primary,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoItem: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumb: {
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
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    fontSize: 12,
    color: ArtisanColors.white,
    fontWeight: '700',
  },
  addMoreCard: {
    width: 100,
    height: 100,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ArtisanColors.borderDashed,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ArtisanColors.white,
  },
  addMoreCardIcon: {
    fontSize: 24,
    color: ArtisanColors.muted,
    marginBottom: 2,
  },
  addMoreCardText: {
    fontSize: 10,
    color: ArtisanColors.muted,
    fontWeight: '600',
  },

  // Language Selector
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ArtisanColors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ArtisanColors.border,
  },
  languageLabel: {
    fontSize: 13,
    color: ArtisanColors.muted,
    marginRight: 6,
  },
  languageValue: {
    fontSize: 13,
    fontWeight: '600',
    color: ArtisanColors.darkMedium,
    flex: 1,
  },
  languageArrow: {
    fontSize: 14,
    color: ArtisanColors.muted,
  },

  // Voice Box
  voiceBox: {
    backgroundColor: ArtisanColors.white,
    borderRadius: 18,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ArtisanColors.border,
  },
  voiceBoxRecording: {
    borderColor: ArtisanColors.primary,
    backgroundColor: '#FFF8F4',
  },
  voiceBoxTranscribed: {
    borderColor: ArtisanColors.success,
    backgroundColor: '#F8FFF8',
  },
  microphoneCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: ArtisanColors.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  microphoneCircleRecording: {
    backgroundColor: ArtisanColors.primaryLight,
  },
  microphoneCircleTranscribed: {
    backgroundColor: ArtisanColors.successBg,
  },
  microphoneIcon: {
    fontSize: 25,
  },
  voiceText: {
    flex: 1,
    marginLeft: 14,
  },
  voiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ArtisanColors.darkMedium,
    marginBottom: 5,
  },
  voiceTitleRecording: {
    color: ArtisanColors.primary,
  },
  voiceSubtitle: {
    fontSize: 12,
    color: ArtisanColors.muted,
    lineHeight: 17,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ArtisanColors.error,
    marginRight: 8,
  },
  recordingTime: {
    fontSize: 12,
    color: ArtisanColors.primary,
    fontWeight: '600',
  },

  // Transcript
  typeInsteadButton: {
    marginTop: 14,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ArtisanColors.borderMedium,
    backgroundColor: ArtisanColors.iconBg,
  },
  typeInsteadText: {
    fontSize: 13,
    fontWeight: '600',
    color: ArtisanColors.primary,
  },
  transcriptContainer: {
    marginTop: 14,
    backgroundColor: ArtisanColors.white,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: ArtisanColors.border,
  },
  transcriptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: ArtisanColors.muted,
    marginBottom: 8,
  },
  transcriptInput: {
    fontSize: 14,
    color: ArtisanColors.dark,
    lineHeight: 21,
    minHeight: 80,
    padding: 0,
  },

  // Error
  errorBanner: {
    marginTop: 10,
    backgroundColor: ArtisanColors.errorBg,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: ArtisanColors.error,
  },

  // Cost
  costBox: {
    backgroundColor: ArtisanColors.white,
    borderRadius: 18,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: ArtisanColors.border,
  },
  rupee: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ArtisanColors.iconBg,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 23,
    fontWeight: '700',
    color: ArtisanColors.primary,
    marginRight: 14,
  },
  costTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ArtisanColors.darkMedium,
    marginBottom: 4,
  },
  costSubtitle: {
    fontSize: 11,
    color: ArtisanColors.muted,
    lineHeight: 16,
    maxWidth: 260,
  },
  costFields: {
    flex: 1,
  },
  costInputs: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  costInputWrap: {
    flex: 1,
  },
  costInputLabel: {
    fontSize: 11,
    color: ArtisanColors.muted,
    marginBottom: 6,
  },
  costInput: {
    backgroundColor: ArtisanColors.background,
    borderWidth: 1,
    borderColor: ArtisanColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 15,
    color: ArtisanColors.dark,
  },

  // Continue Button
  continueButton: {
    backgroundColor: ArtisanColors.primary,
    borderRadius: 17,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  continueButtonDisabled: {
    opacity: 0.7,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  helperText: {
    fontSize: 11,
    color: ArtisanColors.muted,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 12,
    paddingHorizontal: 15,
  },
  inlineMessage: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
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

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: ArtisanColors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ArtisanColors.dark,
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: ArtisanColors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ArtisanColors.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  modalOptionIcon: {
    fontSize: 24,
    marginRight: 14,
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: ArtisanColors.dark,
    marginBottom: 2,
  },
  modalOptionDesc: {
    fontSize: 12,
    color: ArtisanColors.muted,
  },
  modalCancelButton: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: ArtisanColors.muted,
  },

  // Language Options
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: ArtisanColors.background,
  },
  languageOptionSelected: {
    backgroundColor: ArtisanColors.primary,
  },
  languageOptionNative: {
    fontSize: 16,
    fontWeight: '600',
    color: ArtisanColors.dark,
    flex: 1,
  },
  languageOptionEnglish: {
    fontSize: 13,
    color: ArtisanColors.muted,
    marginLeft: 8,
  },
  languageOptionSelectedText: {
    color: ArtisanColors.white,
  },
});
