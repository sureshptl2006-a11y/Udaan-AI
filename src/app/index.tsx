import { StyleSheet, View, Pressable, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>ArtisanAI</Text>
          <Text style={styles.greeting}>Namaste! 👋</Text>
        </View>

        <View style={styles.profileCircle}>
          <Text style={styles.profileText}>A</Text>
        </View>
      </View>

      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeTitle}>Grow your craft with AI</Text>
        <Text style={styles.welcomeSubtitle}>
          Turn your handmade products into professional digital listings.
        </Text>
      </View>

      {/* Add Product Card */}
      <Pressable
        style={styles.addProductCard}
        onPress={() => router.push('/add-product')}
      >
        <View style={styles.cameraCircle}>
          <Text style={styles.cameraIcon}>📷</Text>
        </View>

        <View style={styles.addProductText}>
          <Text style={styles.addProductTitle}>Add New Product</Text>
          <Text style={styles.addProductSubtitle}>
            Create a professional listing with AI
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </Pressable>

      {/* Quick Actions */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>

      <View style={styles.quickActions}>
        <Pressable style={styles.quickCard}>
          <Text style={styles.quickIcon}>📦</Text>
          <Text style={styles.quickTitle}>My Products</Text>
          <Text style={styles.quickSubtitle}>Manage your products</Text>
        </Pressable>

        <Pressable style={styles.quickCard}>
          <Text style={styles.quickIcon}>🛍️</Text>
          <Text style={styles.quickTitle}>Marketplace</Text>
          <Text style={styles.quickSubtitle}>Find buyers</Text>
        </Pressable>
      </View>

      {/* AI Features */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your AI Business Manager</Text>
      </View>

      <View style={styles.featureCard}>
        <View style={styles.featureIconBox}>
          <Text style={styles.featureIcon}>✨</Text>
        </View>

        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>Professional Photos</Text>
          <Text style={styles.featureSubtitle}>
            Enhance product photos automatically
          </Text>
        </View>
      </View>

      <View style={styles.featureCard}>
        <View style={styles.featureIconBox}>
          <Text style={styles.featureIcon}>🎙️</Text>
        </View>

        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>Speak to Create</Text>
          <Text style={styles.featureSubtitle}>
            Describe your product in your own language
          </Text>
        </View>
      </View>

      <View style={styles.featureCard}>
        <View style={styles.featureIconBox}>
          <Text style={styles.featureIcon}>💰</Text>
        </View>

        <View style={styles.featureText}>
          <Text style={styles.featureTitle}>Smart Pricing</Text>
          <Text style={styles.featureSubtitle}>
            Get AI-powered pricing suggestions
          </Text>
        </View>
      </View>

      {/* Bottom spacing */}
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },

  content: {
    padding: 20,
    paddingTop: 55,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },

  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#5A321F',
  },

  greeting: {
    fontSize: 14,
    color: '#8B6F5A',
    marginTop: 3,
  },

  profileCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E8C9A8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  profileText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5A321F',
  },

  welcomeSection: {
    marginBottom: 22,
  },

  welcomeTitle: {
    fontSize: 27,
    fontWeight: '700',
    color: '#342218',
    marginBottom: 8,
  },

  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#806B5D',
    maxWidth: 340,
  },

  addProductCard: {
    backgroundColor: '#C86B3C',
    borderRadius: 22,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },

  cameraCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F6D9C5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cameraIcon: {
    fontSize: 25,
  },

  addProductText: {
    flex: 1,
    marginLeft: 16,
  },

  addProductTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 5,
  },

  addProductSubtitle: {
    fontSize: 13,
    color: '#FBE9DD',
  },

  arrow: {
    fontSize: 32,
    color: '#FFFFFF',
    marginLeft: 8,
  },

  sectionHeader: {
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#342218',
  },

  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 30,
  },

  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 17,
    borderWidth: 1,
    borderColor: '#EDE3D9',
  },

  quickIcon: {
    fontSize: 25,
    marginBottom: 12,
  },

  quickTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A3022',
    marginBottom: 5,
  },

  quickSubtitle: {
    fontSize: 12,
    color: '#8B7769',
    lineHeight: 17,
  },

  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDE3D9',
  },

  featureIconBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#F5E5D6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  featureIcon: {
    fontSize: 23,
  },

  featureText: {
    flex: 1,
    marginLeft: 14,
  },

  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A3022',
    marginBottom: 4,
  },

  featureSubtitle: {
    fontSize: 12,
    color: '#8B7769',
    lineHeight: 17,
  },
});