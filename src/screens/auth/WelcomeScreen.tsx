import { LinearGradient } from 'expo-linear-gradient'
import React, { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/common/Button'
import { COLORS } from '../../constants'
import { useAuthStore } from '../../stores/authStore'

export function WelcomeScreen() {
    const { connect, isLoading } = useAuthStore()
    const [showFullFeatures, setShowFullFeatures] = useState(false)

    const mainFeatures = [
        {
            emoji: "🧠",
            title: "Test Your Crypto Knowledge",
            description: "From Bitcoin to NFTs, DeFi and beyond — test your knowledge across 6 unique categories"
        },
        {
            emoji: "🎮",
            title: "Free Daily Games",
            description: "Get 3 free quiz chances every day. Connect your wallet, start playing, and earn points"
        },
        {
            emoji: "⚡",
            title: "Speed = Higher Scores",
            description: "Correct and fast answers earn maximum points. But be careful, wrong answers give zero points!"
        },
        {
            emoji: "🏆",
            title: "Compete on the Leaderboard",
            description: "Claim your spot on the global leaderboard and climb to the top with rewarded tournaments"
        },
        {
            emoji: "🔥",
            title: "Streak Bonuses",
            description: "Play daily to maintain your streaks and earn cumulative XP bonuses with each consecutive day"
        },
        {
            emoji: "⭐",
            title: "Levels & Achievements",
            description: "Level up as you play, unlock rare badges and special achievements to customize your profile"
        }
    ]

    const extraFeatures = [
        {
            emoji: "💰",
            title: "Coming Soon - Earn with SKR",
            description: "Stake Solana's SPL token SKR to compete against other players. Risky but rewarding!"
        },
        {
            emoji: "💎",
            title: "Coming Soon - Shop & Cosmetics",
            description: "Buy avatar frames, background items, and XP boosters with SKR to gain an edge"
        },
        {
            emoji: "👥",
            title: "Coming Soon - Friends Mode",
            description: "Create private rooms, invite friends with referral codes, and play together"
        }
    ]

    const handleConnectWallet = async () => {
        try {
            await connect()
        } catch (error: any) {
            console.error('Connect error:', error)
            Alert.alert(
                'Connection Error',
                error.message || 'Wallet connection failed. Please try again.',
                [{ text: 'OK' }]
            )
        }
    }

    return (
        <LinearGradient
            colors={[COLORS.background, '#1a1a3e', COLORS.background]}
            style={styles.gradient}
        >
            <SafeAreaView style={styles.container}>
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.logoSection}>
                            <Image
                                source={require('./../../../assets/banner.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>
                        
                        <Text style={styles.tagline}>
                            Turn Your Crypto Knowledge Into Exciting Competition
                        </Text>
                    </View>

                    {/* Main Features */}
                    <View style={styles.featuresSection}>
                        <Text style={styles.sectionTitle}>✨ Key Features</Text>
                        
                        <View style={styles.features}>
                            {mainFeatures.map((feature, index) => (
                                <FeatureItem
                                    key={index}
                                    emoji={feature.emoji}
                                    title={feature.title}
                                    description={feature.description}
                                />
                            ))}
                        </View>
                    </View>

                    {/* Extra Features */}
                    {showFullFeatures && (
                        <View style={styles.extraFeaturesSection}>
                            <Text style={styles.sectionTitle}>🎁 Coming Soon</Text>
                            
                            <View style={styles.features}>
                                {extraFeatures.map((feature, index) => (
                                    <FeatureItem
                                        key={index}
                                        emoji={feature.emoji}
                                        title={feature.title}
                                        description={feature.description}
                                    />
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Show More Button */}
                    {!showFullFeatures && (
                        <View style={styles.showMoreContainer}>
                            <Button
                                title="Show More Features"
                                onPress={() => setShowFullFeatures(true)}
                                variant="secondary"
                            />
                        </View>
                    )}

                    {/* Info Box */}
                    <View style={styles.infoBox}>
                        <Text style={styles.infoTitle}>💡 How to Get Started?</Text>
                        <Text style={styles.infoText}>
                            1. Connect your wallet{'\n'}
                            2. Pick one of 6 categories{'\n'}
                            3. Answer 10 questions{'\n'}
                            4. Earn points and climb the leaderboard!
                        </Text>
                    </View>

                    {/* Social Proof 
                    <View style={styles.socialProof}>
                        <View style={styles.stat}>
                            <Text style={styles.statNumber}>1,200+</Text>
                            <Text style={styles.statLabel}>Questions</Text>
                        </View>
                        <View style={styles.stat}>
                            <Text style={styles.statNumber}>6</Text>
                            <Text style={styles.statLabel}>Categories</Text>
                        </View>
                        <View style={styles.stat}>
                            <Text style={styles.statNumber}>∞</Text>
                            <Text style={styles.statLabel}>Fun</Text>
                        </View>
                    </View>*/}
                </ScrollView>

                {/* Connect Button */}
                <View style={styles.buttonContainer}>
                    <Button
                        title={isLoading ? 'Connecting...' : '🔌 Connect Wallet'}
                        onPress={handleConnectWallet}
                        loading={isLoading}
                        size="large"
                    />
                </View>
            </SafeAreaView>
        </LinearGradient>
    )
}

function FeatureItem({
    emoji,
    title,
    description,
}: {
    emoji: string
    title: string
    description: string
}) {
    return (
        <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>{emoji}</Text>
            <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>{description}</Text>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingBottom: 20,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoSection: {
        marginBottom: 16,
    },
    logo: {
        height: 140,
    },
    tagline: {
        fontSize: 16,
        color: COLORS.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 8,
    },
    featuresSection: {
        marginBottom: 24,
    },
    extraFeaturesSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 16,
    },
    features: {
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.surface,
        padding: 14,
        borderRadius: 12,
        gap: 12,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
    },
    featureEmoji: {
        fontSize: 28,
        marginTop: 2,
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 3,
    },
    featureDescription: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    },
    showMoreContainer: {
        marginBottom: 24,
    },
    infoBox: {
        backgroundColor: 'rgba(100, 200, 255, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
        marginBottom: 24,
    },
    infoTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: 10,
    },
    infoText: {
        fontSize: 13,
        color: COLORS.text,
        lineHeight: 20,
    },
    socialProof: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
    },
    stat: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    disclaimer: {
        fontSize: 12,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 16,
        fontStyle: 'italic',
    },
    buttonContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    walletHint: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 12,
        textAlign: 'center',
    },
})