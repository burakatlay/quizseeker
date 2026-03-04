import React, { useEffect } from 'react'
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { Loading } from '../../components/common/Loading'
import { COLORS } from '../../constants'
import { useAuthStore } from '../../stores/authStore'
import { useUserStore } from '../../stores/userStore'
import { formatNumber, getLevelInfo, shortenAddress } from '../../utils/format'

// ============================================
// COMPONENT
// ============================================

export function ProfileScreen() {
    // ===== STORES =====
    // Kullanıcı ve wallet bilgilerini al
    const { user, walletAddress, disconnect, isLoading: authLoading } = useAuthStore()

    // Paket bilgilerini al
    const {
        userPackages,
        isLoading
    } = useUserStore()

    // ===== LIFECYCLE =====
    // İlk açılışta: Profil verilerini yükle
    useEffect(() => {
        initializeScreen()
    }, [])

    /**
     * Ekranı başlat
     * 
     * Görevler:
     * 1. Kullanıcının satın aldığı paketleri yükle
     */
    const initializeScreen = async () => {
        try {
            // Paket verileri zaten store'da yüklü
            // İhtiyaç varsa refresh yap
        } catch (error) {
            console.error('❌ Initialize error:', error)
        }
    }

    /**
     * Wallet bağlantısını kes
     * 
     * Akış:
     * 1. Kullanıcıdan onay iste
     * 2. Disconnect() işlemini çalıştır
     * 3. AuthStore'dan çıkış yap
     */
    const handleDisconnect = () => {
        Alert.alert(
            'Disconnect Wallet',
            'Are you sure you want to disconnect your wallet?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await disconnect()
                        } catch (error) {
                            console.error('❌ Disconnect error:', error)
                            Alert.alert('Error', 'Failed to disconnect wallet')
                        }
                    }
                }
            ]
        )
    }

    // ===== RENDER =====
    // Veriler yükleniyorsa, loading göster
    if (isLoading && !user) {
        return <Loading fullScreen text="Loading profile..." />
    }

    // Seviye bilgisini hesapla (XP'den)
    const levelInfo = user ? getLevelInfo(user.total_xp) : null

    // Kalan oyunları topla
    const totalGamesRemaining = userPackages.reduce(
        (sum, pkg) => sum + pkg.games_remaining,
        0
    )

    // Toplam oyun sayısı
    const totalGamesPurchased = userPackages.reduce(
        (sum, pkg) => sum + pkg.games_total,
        0
    )

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>

                {/* ===== PROFILE HEADER ===== */}
                {/* Kullanıcı adı, avatar, seviye göster */}
                <View style={styles.header}>
                    {/* Avatar Circle */}
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarEmoji}>👤</Text>
                    </View>

                    {/* Username */}
                    <Text style={styles.username}>
                        {user?.username || 'Anonymous Player'}
                    </Text>

                    {/* Wallet Address (Shortened) */}
                    <Text style={styles.walletAddress}>
                        {shortenAddress(walletAddress || '', 6)}
                    </Text>

                    {/* Level Badge */}
                    {levelInfo && (
                        <View style={[styles.levelBadge, { backgroundColor: levelInfo.color }]}>
                            <Text style={styles.levelBadgeText}>
                                Lv.{levelInfo.level} {levelInfo.name}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ===== XP PROGRESS SECTION ===== */}
                {/* Toplam XP ve sonraki seviyeye kalan XP'yi göster */}
                {user && levelInfo && (
                    <Card style={styles.xpCard}>
                        {/* Header */}
                        <View style={styles.xpHeader}>
                            <View>
                                <Text style={styles.xpLabel}>Total Experience</Text>
                                <Text style={styles.xpValue}>
                                    {formatNumber(user.total_xp)} XP
                                </Text>
                            </View>
                            <View style={styles.xpBadge}>
                                <Text style={styles.xpBadgeValue}>
                                    {levelInfo.level}
                                </Text>
                            </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={styles.progressSection}>
                            <View style={styles.progressBarContainer}>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${levelInfo.progressPercentage}%`,
                                                backgroundColor: levelInfo.color
                                            }
                                        ]}
                                    />
                                </View>
                            </View>

                            {/* Progress Info */}
                            <View style={styles.progressInfo}>
                                <Text style={styles.progressLabel}>
                                    {levelInfo.progressPercentage.toFixed(0)}% Progress
                                </Text>
                                <Text style={styles.progressSubtext}>
                                    {levelInfo.currentXP} / {levelInfo.nextLevelXP} XP to Level {levelInfo.level + 1}
                                </Text>
                            </View>
                        </View>

                        {/* Level Range */}
                        <View style={styles.levelRangeContainer}>
                            <Text style={styles.levelRangeText}>
                                Level {levelInfo.level}: {formatNumber(levelInfo.minXP)} - {formatNumber(levelInfo.maxXP)} XP
                            </Text>
                        </View>
                    </Card>
                )}

                {/* ===== MAIN STATS GRID ===== */}
                {/* 2x2 grid: Games Played, Streak, Packages, Rank */}
                {user && (
                    <View style={styles.statsGridContainer}>
                        {/* Total Games Played */}
                        <Card style={styles.statCard}>
                            <Text style={styles.statEmoji}>🎮</Text>
                            <Text style={styles.statValue}>
                                {formatNumber(user.total_games_played)}
                            </Text>
                            <Text style={styles.statLabel}>Games Played</Text>
                            <Text style={styles.statSubtext}>All time</Text>
                        </Card>

                        {/* Current Streak */}
                        <Card style={styles.statCard}>
                            <Text style={styles.statEmoji}>🔥</Text>
                            <Text style={styles.statValue}>
                                {user.current_streak}
                            </Text>
                            <Text style={styles.statLabel}>Current Streak</Text>
                            <Text style={styles.statSubtext}>Days in a row</Text>
                        </Card>

                        {/* Longest Streak */}
                        <Card style={styles.statCard}>
                            <Text style={styles.statEmoji}>⭐</Text>
                            <Text style={styles.statValue}>
                                {user.longest_streak}
                            </Text>
                            <Text style={styles.statLabel}>Best Streak</Text>
                            <Text style={styles.statSubtext}>Personal record</Text>
                        </Card>

                        {/* User Level */}
                        <Card style={styles.statCard}>
                            <Text style={styles.statEmoji}>🏆</Text>
                            <Text style={styles.statValue}>
                                {user.level}
                            </Text>
                            <Text style={styles.statLabel}>Level</Text>
                            <Text style={styles.statSubtext}>{levelInfo?.name}</Text>
                        </Card>
                    </View>
                )}

                {/* ===== PACKAGES SECTION ===== */}
                {/* Satın alınan paketleri göster */}
                {userPackages.length > 0 && (
                    <>
                        {/* Section Header */}
                        <Card style={styles.sectionHeaderCard}>
                            <View style={styles.sectionHeader}>
                                <View>
                                    <Text style={styles.sectionTitle}>📦 Active Packages</Text>
                                    <Text style={styles.sectionSubtitle}>
                                        {userPackages.length} package{userPackages.length > 1 ? 's' : ''} purchased
                                    </Text>
                                </View>
                                <View style={styles.sectionBadge}>
                                    <Text style={styles.sectionBadgeText}>
                                        {totalGamesRemaining}
                                    </Text>
                                    <Text style={styles.sectionBadgeLabel}>games</Text>
                                </View>
                            </View>
                        </Card>

                        {/* Summary Stats */}
                        <View style={styles.summaryGrid}>
                            {/* Total Games Purchased */}
                            <Card style={styles.summaryCard}>
                                <Text style={styles.summaryEmoji}>🎁</Text>
                                <View>
                                    <Text style={styles.summaryValue}>
                                        {totalGamesPurchased}
                                    </Text>
                                    <Text style={styles.summaryLabel}>Games Bought</Text>
                                </View>
                            </Card>

                            {/* Games Used */}
                            <Card style={styles.summaryCard}>
                                <Text style={styles.summaryEmoji}>✨</Text>
                                <View>
                                    <Text style={styles.summaryValue}>
                                        {totalGamesPurchased - totalGamesRemaining}
                                    </Text>
                                    <Text style={styles.summaryLabel}>Games Used</Text>
                                </View>
                            </Card>

                            {/* Games Remaining */}
                            <Card style={styles.summaryCard}>
                                <Text style={styles.summaryEmoji}>🚀</Text>
                                <View>
                                    <Text style={styles.summaryValue}>
                                        {totalGamesRemaining}
                                    </Text>
                                    <Text style={styles.summaryLabel}>Remaining</Text>
                                </View>
                            </Card>
                        </View>

                        {/* Package Details */}
                        {userPackages.map((pkg, index) => (
                            <Card key={pkg.id} style={styles.packageDetailCard}>
                                {/* Header */}
                                <View style={styles.packageDetailHeader}>
                                    <View style={styles.packageDetailInfo}>
                                        <Text style={styles.packageDetailName}>
                                            {pkg.game_packages?.name}
                                        </Text>
                                        <Text style={styles.packageDetailSubtext}>
                                            Package #{index + 1}
                                        </Text>
                                    </View>
                                    <View style={styles.packageDetailBadge}>
                                        <Text style={styles.packageDetailValue}>
                                            {pkg.games_remaining}
                                        </Text>
                                        <Text style={styles.packageDetailLabel}>left</Text>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.packageProgress}>
                                    <View style={styles.packageProgressBar}>
                                        <View
                                            style={[
                                                styles.packageProgressFill,
                                                {
                                                    width: `${(pkg.games_remaining / pkg.games_total) * 100}%`,
                                                    backgroundColor: COLORS.primary
                                                }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.packageProgressText}>
                                        {pkg.games_used} / {pkg.games_total} used
                                    </Text>
                                </View>

                                {/* Stats Grid */}
                                <View style={styles.packageStatsGrid}>
                                    {/* Total Games */}
                                    <View style={styles.packageStat}>
                                        <Text style={styles.packageStatLabel}>Total</Text>
                                        <Text style={styles.packageStatValue}>
                                            {pkg.games_total}
                                        </Text>
                                    </View>

                                    {/* Used Games */}
                                    <View style={styles.packageStat}>
                                        <Text style={styles.packageStatLabel}>Used</Text>
                                        <Text style={styles.packageStatValue}>
                                            {pkg.games_used}
                                        </Text>
                                    </View>

                                    {/* Remaining Games */}
                                    <View style={styles.packageStat}>
                                        <Text style={styles.packageStatLabel}>Remaining</Text>
                                        <Text style={styles.packageStatValue}>
                                            {pkg.games_remaining}
                                        </Text>
                                    </View>

                                    {/* XP Boost */}
                                    {pkg.game_packages && (
                                        <View style={styles.packageStat}>
                                            <Text style={styles.packageStatLabel}>XP Boost</Text>
                                            <Text style={styles.packageStatValue}>
                                                x{pkg.game_packages.base_multiplier}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </Card>
                        ))}
                    </>
                )}

                {/* ===== NO PACKAGES STATE ===== */}
                {userPackages.length === 0 && (
                    <Card style={styles.emptyPackageCard}>
                        <Text style={styles.emptyPackageEmoji}>📦</Text>
                        <Text style={styles.emptyPackageTitle}>No Packages Yet</Text>
                        <Text style={styles.emptyPackageSubtext}>
                            Purchase packages to unlock more games and boost your XP
                        </Text>
                    </Card>
                )}

                {/* ===== ACHIEVEMENTS SECTION ===== */}
                {/* İstatistiklere dayalı başarılar */}
                {user && (
                    <>
                        <Card style={styles.sectionHeaderCard}>
                            <Text style={styles.sectionTitle}>🏅 Milestones</Text>
                        </Card>

                        <View style={styles.milestonesGrid}>
                            {/* 100 Games Milestone */}
                            {user.total_games_played >= 100 && (
                                <Card style={styles.milestoneCard}>
                                    <Text style={styles.milestoneEmoji}>🎯</Text>
                                    <Text style={styles.milestoneTitle}>Century</Text>
                                    <Text style={styles.milestoneDesc}>
                                        Played 100+ games
                                    </Text>
                                </Card>
                            )}

                            {/* 7-Day Streak Milestone */}
                            {user.longest_streak >= 7 && (
                                <Card style={styles.milestoneCard}>
                                    <Text style={styles.milestoneEmoji}>🔥</Text>
                                    <Text style={styles.milestoneTitle}>On Fire</Text>
                                    <Text style={styles.milestoneDesc}>
                                        7+ day streak
                                    </Text>
                                </Card>
                            )}

                            {/* Level 5 Milestone */}
                            {user.level >= 5 && (
                                <Card style={styles.milestoneCard}>
                                    <Text style={styles.milestoneEmoji}>⭐</Text>
                                    <Text style={styles.milestoneTitle}>Rising Star</Text>
                                    <Text style={styles.milestoneDesc}>
                                        Reached Level 5
                                    </Text>
                                </Card>
                            )}

                            {/* Level 10 Milestone */}
                            {user.level >= 10 && (
                                <Card style={styles.milestoneCard}>
                                    <Text style={styles.milestoneEmoji}>👑</Text>
                                    <Text style={styles.milestoneTitle}>Legend</Text>
                                    <Text style={styles.milestoneDesc}>
                                        Reached Level 10
                                    </Text>
                                </Card>
                            )}
                        </View>
                    </>
                )}

                {/* ===== DISCONNECT BUTTON ===== */}
                <View style={styles.actions}>
                    <Button
                        title="Disconnect Wallet"
                        onPress={handleDisconnect}
                        variant="outline"
                        loading={authLoading}
                    />
                </View>

                {/* Spacer */}
                <View style={styles.spacer} />

            </ScrollView>
        </SafeAreaView>
    )
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background
    },

    // ===== HEADER =====
    header: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 16
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 3,
        borderColor: COLORS.primary
    },
    avatarEmoji: {
        fontSize: 50
    },
    username: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4
    },
    walletAddress: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 12,
        fontFamily: 'monospace'
    },
    levelBadge: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20
    },
    levelBadgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff'
    },

    // ===== XP CARD =====
    xpCard: {
        marginHorizontal: 16,
        marginBottom: 16
    },
    xpHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    xpLabel: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginBottom: 4
    },
    xpValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.primary
    },
    xpBadge: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center'
    },
    xpBadgeValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff'
    },

    // ===== PROGRESS SECTION =====
    progressSection: {
        marginBottom: 12
    },
    progressBarContainer: {
        marginBottom: 8
    },
    progressBar: {
        height: 12,
        backgroundColor: COLORS.surfaceLight,
        borderRadius: 6,
        overflow: 'hidden'
    },
    progressFill: {
        height: '100%',
        borderRadius: 6
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    progressLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text
    },
    progressSubtext: {
        fontSize: 12,
        color: COLORS.textSecondary
    },

    // ===== LEVEL RANGE =====
    levelRangeContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border
    },
    levelRangeText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontStyle: 'italic'
    },

    // ===== STATS GRID =====
    statsGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 16
    },
    statCard: {
        width: '47.5%',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12
    },
    statEmoji: {
        fontSize: 28,
        marginBottom: 8
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.text
    },
    statLabel: {
        fontSize: 13,
        color: COLORS.text,
        marginTop: 4,
        fontWeight: '600'
    },
    statSubtext: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2
    },

    // ===== SECTION HEADER =====
    sectionHeaderCard: {
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 12
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text
    },
    sectionSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2
    },
    sectionBadge: {
        alignItems: 'center',
        backgroundColor: COLORS.primary + '20',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12
    },
    sectionBadgeText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary
    },
    sectionBadgeLabel: {
        fontSize: 10,
        color: COLORS.textSecondary,
        marginTop: 2
    },

    // ===== SUMMARY GRID =====
    summaryGrid: {
        flexDirection: 'row',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 16
    },
    summaryCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 8
    },
    summaryEmoji: {
        fontSize: 20
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text
    },
    summaryLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 2
    },

    // ===== PACKAGE DETAIL CARD =====
    packageDetailCard: {
        marginHorizontal: 16,
        marginBottom: 12
    },
    packageDetailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    packageDetailInfo: {
        flex: 1
    },
    packageDetailName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text
    },
    packageDetailSubtext: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2
    },
    packageDetailBadge: {
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12
    },
    packageDetailValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff'
    },
    packageDetailLabel: {
        fontSize: 10,
        color: '#fff',
        marginTop: 2
    },

    // ===== PACKAGE PROGRESS =====
    packageProgress: {
        marginBottom: 12
    },
    packageProgressBar: {
        height: 8,
        backgroundColor: COLORS.surfaceLight,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 6
    },
    packageProgressFill: {
        height: '100%',
        borderRadius: 4
    },
    packageProgressText: {
        fontSize: 11,
        color: COLORS.textSecondary
    },

    // ===== PACKAGE STATS GRID =====
    packageStatsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        padding: 12
    },
    packageStat: {
        alignItems: 'center'
    },
    packageStatLabel: {
        fontSize: 11,
        color: COLORS.textSecondary
    },
    packageStatValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
        marginTop: 4
    },

    // ===== EMPTY PACKAGE STATE =====
    emptyPackageCard: {
        marginHorizontal: 16,
        marginVertical: 32,
        alignItems: 'center',
        paddingVertical: 32
    },
    emptyPackageEmoji: {
        fontSize: 48,
        marginBottom: 12
    },
    emptyPackageTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8
    },
    emptyPackageSubtext: {
        fontSize: 13,
        color: COLORS.textSecondary,
        textAlign: 'center'
    },

    // ===== MILESTONES =====
    milestonesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 16
    },
    milestoneCard: {
        width: '47.5%',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        backgroundColor: COLORS.primary + '10',
        borderWidth: 1,
        borderColor: COLORS.primary + '30'
    },
    milestoneEmoji: {
        fontSize: 28,
        marginBottom: 8
    },
    milestoneTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text
    },
    milestoneDesc: {
        fontSize: 11,
        color: COLORS.textSecondary,
        marginTop: 4,
        textAlign: 'center'
    },

    // ===== ACTIONS =====
    actions: {
        marginTop: 16,
        marginHorizontal: 16,
        marginBottom: 32
    },

    // ===== SPACER =====
    spacer: {
        height: 32
    }
})