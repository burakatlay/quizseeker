import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useCallback, useEffect, useState } from 'react'
import {
    Alert,
    Dimensions,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { Loading } from '../../components/common/Loading'
import { COLORS } from '../../constants'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'
import { useUserStore } from '../../stores/userStore'

const { width } = Dimensions.get('window')

// ============================================
// TYPE DEFINITIONS
// ============================================

interface GameCategory {
    id: string
    name: string
    fullName: string
    description: string
    icon: string
    available: boolean
}

interface ExtraMode {
    id: string
    name: string
    description: string
    icon: string
    badge?: string
    available: boolean
}

// ============================================
// MAIN COMPONENT
// ============================================

export function HomeScreen({ navigation }: any) {
    // State Management
    const { user, checkAndResetDailyAttempts, refreshUserFromDatabase } = useAuthStore()
    const { startGame, isLoading } = useGameStore()
    const { profile, fetchProfile } = useUserStore()

    const [packagePlays, setPackagePlays] = useState(0)

    // ============================================
    // LIFECYCLE HOOKS
    // ============================================

    useFocusEffect(
        useCallback(() => {
            if (user?.id) {
                checkAndResetDailyAttempts()
                refreshUserFromDatabase()
                fetchProfile()
            }
        }, [user?.id])
    )

    useEffect(() => {
        calculatePackagePlays()
    }, [profile?.packages])

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    const calculatePackagePlays = useCallback(() => {
        if (profile?.packages && Array.isArray(profile.packages)) {
            const total = profile.packages.reduce(
                (sum: number, pkg: any) => sum + (pkg.games_remaining || 0),
                0
            )
            setPackagePlays(total)
        } else {
            setPackagePlays(0)
        }
    }, [profile?.packages])

    const getRemainingPlays = (): number => {
        const dailyRemaining = user?.daily_free_plays_remaining || 0
        const bonusRemaining = user?.bonus_daily_plays || 0
        return dailyRemaining + bonusRemaining + packagePlays
    }

    // ============================================
    // DATA: GAME CATEGORIES (6 Unique Categories)
    // ============================================

    const getGameCategories = (): GameCategory[] => [
        {
            id: '1',
            name: 'Token Logo',
            fullName: 'Token Logo → Token Name',
            description: 'Guess the token by its logo',
            icon: '🪙',
            available: true,
        },
        {
            id: '2',
            name: 'NFT Visual',
            fullName: 'NFT Image → Collection Name',
            description: 'Identify the collection',
            icon: '🖼️',
            available: true,
        },
        {
            id: '3',
            name: 'Project Logo',
            fullName: 'Project Logo → Project Name',
            description: 'Recognize the project',
            icon: '🏢',
            available: false,
        },
        {
            id: '4',
            name: 'Chain Logo',
            fullName: 'Chain Logo → Blockchain Name',
            description: 'Identify the blockchain',
            icon: '⛓️',
            available: false,
        },
        {
            id: '5',
            name: 'Protocol Interface',
            fullName: 'Protocol UI → Protocol Name',
            description: 'Guess the DeFi protocol',
            icon: '📊',
            available: false,
        },
        {
            id: '6',
            name: 'Crypto Concept',
            fullName: 'Concept Icon → Concept Name',
            description: 'Learn crypto terminology',
            icon: '🧠',
            available: false,
        },
    ]

    // ============================================
    // DATA: SPECIAL MODES (Coming Soon)
    // ============================================

    const getExtraModes = (): ExtraMode[] => [
        {
            id: 'skr_pool_10',
            name: 'SKR Pool 10',
            description: '10 SKR entry + 0.0003 SOL fee',
            icon: '🎲',
            badge: '💰',
            available: false,
        },
        {
            id: 'skr_pool_100',
            name: 'SKR Pool 100',
            description: '100 SKR entry + 0.0003 SOL fee',
            icon: '🏆',
            badge: '💰',
            available: false,
        },
        {
            id: 'custom_room',
            name: 'Friend Room',
            description: 'Play with friends using a private code',
            icon: '👥',
            badge: '👫',
            available: false,
        },
        {
            id: 'tournament',
            name: 'Tournament',
            description: 'Weekly competition with rewards',
            icon: '🎯',
            badge: '🏅',
            available: false,
        },
    ]

    // ============================================
    // EVENT HANDLERS
    // ============================================

    const handlePlayCategory = async (categoryId: string) => {
        // Validation
        if (!user) {
            Alert.alert('Error', 'Please log in first')
            return
        }

        const totalRemaining = getRemainingPlays()
        if (totalRemaining <= 0) {
            Alert.alert(
                '🎮 No Play Attempts Left',
                'You\'ve used all your plays.\n\n💰 Buy a package or ⏰ come back tomorrow.'
            )
            return
        }

        try {
            console.log('🎮 Starting game with category:', categoryId)
            await startGame('free', categoryId)
            navigation.navigate('GamePlay', { categoryId })
        } catch (error: any) {
            console.error('❌ Game start error:', error)
            Alert.alert('Error', `Failed to start game: ${error.message}`)
        }
    }

    const handleExtraMode = (modeId: string) => {
        if (!user) {
            Alert.alert('Error', 'Please log in first')
            return
        }

        switch (modeId) {
            case 'skr_pool_10':
            case 'skr_pool_100':
                navigation.navigate('PoolLobby', { poolType: modeId })
                break
            case 'custom_room':
                navigation.navigate('CustomRoom')
                break
            case 'tournament':
                navigation.navigate('Tournament')
                break
        }
    }

    // ============================================
    // RENDER: LOADING STATE
    // ============================================

    if (isLoading) {
        return <Loading fullScreen text="Loading..." />
    }

    // ============================================
    // RENDER: MAIN SCREEN
    // ============================================

    const gameCategories = getGameCategories()
    const extraModes = getExtraModes()
    const totalRemaining = getRemainingPlays()
    const dailyRemaining = user?.daily_free_plays_remaining || 0

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
            >
                {/* ====== LOGO SECTION ====== */}
                <View style={styles.logoSection}>
                    <Image
                        source={require('./../../../assets/banner.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>

                {/* ====== QUICK STATS ====== */}
                {user && (
                    <View style={styles.statsSection}>
                        <LinearGradient
                            colors={[COLORS.surfaceLight, COLORS.surface]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.statsCard}
                        >
                            <View style={styles.statsRow}>
                                {/* Level Stat */}
                                <View style={styles.statItem}>
                                    <Text style={styles.statIcon}>⭐</Text>
                                    <Text style={styles.statValue}>{user.level}</Text>
                                    <Text style={styles.statLabel}>Level</Text>
                                </View>

                                <View style={styles.statDivider} />

                                {/* XP Stat */}
                                <View style={styles.statItem}>
                                    <Text style={styles.statIcon}>✨</Text>
                                    <Text style={styles.statValue}>{user.total_xp || 0}</Text>
                                    <Text style={styles.statLabel}>XP</Text>
                                </View>

                                <View style={styles.statDivider} />

                                {/* Remaining Plays Stat */}
                                <View style={styles.statItem}>
                                    <Text style={styles.statIcon}>🎮</Text>
                                    <Text style={styles.statValue}>{totalRemaining}</Text>
                                    <Text style={styles.statLabel}>Plays</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                )}

                {/* ====== GAME CATEGORIES ====== */}
                <View style={styles.categoriesSection}>
                    <Text style={styles.sectionTitle}>Game Categories</Text>

                    <View style={styles.categoriesList}>
                        {gameCategories.map((category) => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                isDisabled={!category.available || totalRemaining <= 0}
                                onPress={() => handlePlayCategory(category.id)}
                            />
                        ))}
                    </View>
                </View>

                {/* ====== SPECIAL MODES (Coming Soon) ====== */}
                <View style={styles.extraModesSection}>
                    <Text style={styles.sectionTitle}>Special Modes</Text>

                    <View style={styles.extraModesGrid}>
                        {extraModes.map((mode) => (
                            <SpecialModeCard
                                key={mode.id}
                                mode={mode}
                                onPress={() => handleExtraMode(mode.id)}
                            />
                        ))}
                    </View>
                </View>

                {/* ====== PLAYS INFO ====== */}
                <View style={styles.infoSection}>
                    <Card style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <Text style={styles.infoIcon}>📅</Text>
                            <Text style={styles.infoTitle}>Your Plays</Text>
                        </View>

                        <View style={styles.playsList}>
                            {/* Free Plays */}
                            <View style={styles.playItem}>
                                <Text style={styles.playLabel}>Daily Free</Text>
                                <Text style={styles.playValue}>{dailyRemaining}/3</Text>
                            </View>

                            {/* Bonus Plays */}
                            {(user?.bonus_daily_plays || 0) > 0 && (
                                <View style={styles.playItem}>
                                    <Text style={styles.playLabel}>Bonus</Text>
                                    <Text style={styles.playValue}>
                                        {user?.bonus_daily_plays}
                                    </Text>
                                </View>
                            )}

                            {/* Package Plays */}
                            {packagePlays > 0 && (
                                <View style={styles.playItem}>
                                    <Text style={styles.playLabel}>Package</Text>
                                    <Text style={styles.playValue}>{packagePlays}</Text>
                                </View>
                            )}
                        </View>

                        {/* Reset Info */}
                        {dailyRemaining < 3 && (
                            <Text style={styles.resetText}>
                                ⏰ You'll get 3 new plays tomorrow at 00:00 UTC
                            </Text>
                        )}
                    </Card>

                    {/* Buy Packages CTA */}
                    {packagePlays === 0 && (
                        <Card style={[styles.infoCard, styles.ctaCard]}>
                            <View style={styles.ctaHeader}>
                                <Text style={styles.ctaIcon}>💰</Text>
                                <Text style={styles.ctaTitle}>Buy Packages</Text>
                            </View>
                            <Text style={styles.ctaText}>
                                Get unlimited plays with special XP multipliers
                            </Text>
                            <Button
                                title="🛍️ Go to Shop"
                                onPress={() => navigation.navigate('Packages')}
                                variant="outline"
                            />
                        </Card>
                    )}
                </View>

                {/* Spacing */}
                <View style={styles.bottomSpacing} />
            </ScrollView>
        </SafeAreaView>
    )
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface CategoryCardProps {
    category: GameCategory
    isDisabled: boolean
    onPress: () => void
}

function CategoryCard({ category, isDisabled, onPress }: CategoryCardProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.8}
            style={[
                styles.categoryCardRow,
                isDisabled && styles.categoryCardRowDisabled,
            ]}
        >
            <LinearGradient
                colors={[COLORS.primaryLight, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.categoryGradientRow}
            >
                <View style={styles.categoryRowContent}>
                    <Text style={styles.categoryIconRow}>{category.icon}</Text>
                    <View style={styles.categoryTextContainer}>
                        <Text style={styles.categoryNameRow}>{category.name}</Text>
                        <Text style={styles.categoryFullNameRow}>
                            {category.fullName}
                        </Text>
                        <Text style={styles.categoryDescRow}>
                            {category.description}
                        </Text>
                    </View>
                </View>
                <Text style={styles.categoryArrow}>›</Text>
            </LinearGradient>
        </TouchableOpacity>
    )
}

interface SpecialModeCardProps {
    mode: ExtraMode
    onPress: () => void
}

function SpecialModeCard({ mode, onPress }: SpecialModeCardProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={!mode.available}
            activeOpacity={0.8}
            style={[
                styles.extraModeCard,
                !mode.available && styles.extraModeCardDisabled,
            ]}
        >
            <LinearGradient
                colors={[COLORS.primaryLight, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.extraModeGradient}
            >
                <View style={styles.extraModeContent}>
                    <Text style={styles.extraModeIcon}>{mode.icon}</Text>
                    {mode.badge && (
                        <View style={styles.extraModeBadge}>
                            <Text style={styles.extraModeBadgeText}>
                                {mode.badge}
                            </Text>
                        </View>
                    )}
                </View>
                <Text style={styles.extraModeName}>{mode.name}</Text>
                <Text style={styles.extraModeDesc}>{mode.description}</Text>
            </LinearGradient>
        </TouchableOpacity>
    )
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    // Container
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    // Logo Section
    logoSection: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    logo: {
        height: 180,
        marginTop: 20,
        marginRight: 15,
        alignItems: 'center',
    },

    // Stats Section
    statsSection: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    statsCard: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.accent,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: COLORS.border,
        marginHorizontal: 12,
    },

    // Categories Section
    categoriesSection: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },
    categoriesList: {
        gap: 10,
    },
    categoryCardRow: {
        borderRadius: 14,
        overflow: 'hidden',
        height: 100,
    },
    categoryCardRowDisabled: {
        opacity: 0.5,
    },
    categoryGradientRow: {
        flex: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'space-between',
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
    },
    categoryRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    categoryIconRow: {
        fontSize: 40,
        marginRight: 12,
    },
    categoryTextContainer: {
        flex: 1,
    },
    categoryNameRow: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 2,
    },
    categoryFullNameRow: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.9)',
        marginBottom: 4,
        fontStyle: 'italic',
    },
    categoryDescRow: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
    },
    categoryArrow: {
        fontSize: 28,
        color: '#fff',
        marginLeft: 8,
        opacity: 0.8,
    },

    // Extra Modes Section
    extraModesSection: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    extraModesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'space-between',
    },
    extraModeCard: {
        width: (width - 52) / 2,
        borderRadius: 12,
        overflow: 'hidden',
    },
    extraModeCardDisabled: {
        opacity: 0.5,
    },
    extraModeGradient: {
        padding: 12,
        minHeight: 130,
        justifyContent: 'space-between',
    },
    extraModeContent: {
        alignItems: 'center',
        marginBottom: 8,
    },
    extraModeIcon: {
        fontSize: 36,
    },
    extraModeBadge: {
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 6,
    },
    extraModeBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '600',
    },
    extraModeName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 4,
    },
    extraModeDesc: {
        fontSize: 9,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
    },

    // Info Section
    infoSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    infoCard: {
        marginBottom: 12,
        borderRadius: 12,
    },
    ctaCard: {
        backgroundColor: COLORS.error + '15',
        borderColor: COLORS.error,
        borderWidth: 1,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    ctaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    ctaIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    ctaTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.error,
    },
    ctaText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 12,
    },
    playsList: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
        paddingVertical: 8,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
    },
    playItem: {
        alignItems: 'center',
    },
    playLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    playValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.accent,
    },
    resetText: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },

    // Spacing
    bottomSpacing: {
        height: 24,
    },
})