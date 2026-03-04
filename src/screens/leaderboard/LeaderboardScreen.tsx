import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card } from '../../components/common/Card'
import { Loading } from '../../components/common/Loading'
import { COLORS } from '../../constants'
import { useAuthStore } from '../../stores/authStore'
import { useUserStore } from '../../stores/userStore'
import { LeaderboardEntry } from '../../types'
import { formatNumber, getLevelInfo, shortenAddress } from '../../utils/format'

/**
 * Leaderboard type: Global (tüm zamanlar), Daily (bugün), Weekly (bu hafta)
 * Liderlik türü: Global, Daily, Weekly
 */
type LeaderboardType = 'global' | 'daily' | 'weekly'

/**
 * LeaderboardScreen - Üç türde liderlik tablosu gösterir
 * Global: Tüm zamanların toplamı
 * Daily: Bugünün verisi
 * Weekly: Pazartesi-Pazartesi haftalık verisi
 */
export function LeaderboardScreen() {
    // === STATE ===
    /** Aktif sekme: global, daily veya weekly */
    const [activeTab, setActiveTab] = useState<LeaderboardType>('global')
    
    // === STORE ===
    /** userStore'dan liderlik tablosu ve yükleme durumu */
    const { leaderboard, isLoading, fetchLeaderboard } = useUserStore()
    
    /** Oturum açan kullanıcının cüzdan adresi */
    const { walletAddress } = useAuthStore()

    // === EFFECTS ===
    /**
     * Sekme değiştiğinde, seçili türün verilerini çek
     * Dependencies: activeTab (sekme değiştiğinde tetikle)
     */
    useEffect(() => {
        fetchLeaderboard(activeTab)
    }, [activeTab, fetchLeaderboard])

    // === RENDER: TAB BUTTONS ===
    /**
     * Sekme butonunu render et
     * Aktif olanı vurgula (renk değiştir, metin rengi değiştir)
     */
    const renderTab = (type: LeaderboardType, label: string) => (
        <TouchableOpacity
            style={[styles.tab, activeTab === type && styles.activeTab]}
            onPress={() => setActiveTab(type)}
        >
            <Text style={[styles.tabText, activeTab === type && styles.activeTabText]}>
                {label}
            </Text>
        </TouchableOpacity>
    )

    // === RENDER: LEADERBOARD ITEM ===
    /**
     * Her kullanıcı satırını render et
     * İçeriği: Sıra #, Avatar, İsim, Seviye, XP puanı
     */
    const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
        // Mevcut kullanıcı mı? Cüzdan adresiyle karşılaştır
        const isCurrentUser = item.wallet_address === walletAddress
        
        // Seviye bilgisini al (color + name)
        const levelInfo = getLevelInfo(item.total_xp)
        
        // Sıra belirle: global_rank, daily_rank, weekly_rank'den biri
        const rank = item.global_rank || item.daily_rank || item.weekly_rank || index + 1

        /**
         * Sıra görünümü:
         * 1. → 🥇 (Altın)
         * 2. → 🥈 (Gümüş)
         * 3. → 🥉 (Bronz)
         * 4+. → #4, #5... (Normal metin)
         */
        const getRankDisplay = () => {
            if (rank === 1) return { emoji: '🥇', color: '#FFD700' }
            if (rank === 2) return { emoji: '🥈', color: '#C0C0C0' }
            if (rank === 3) return { emoji: '🥉', color: '#CD7F32' }
            return { emoji: null, color: COLORS.textSecondary }
        }

        const rankDisplay = getRankDisplay()

        return (
            <Card
                style={[
                    styles.itemCard,
                    isCurrentUser && styles.currentUserCard,
                ]}
            >
                {/* RANK INDICATOR */}
                <View style={styles.rankContainer}>
                    {rankDisplay.emoji ? (
                        <Text style={styles.rankEmoji}>{rankDisplay.emoji}</Text>
                    ) : (
                        <Text style={[styles.rankNumber, { color: rankDisplay.color }]}>
                            #{rank}
                        </Text>
                    )}
                </View>

                {/* USER INFO (Avatar + Name + Level) */}
                <View style={styles.userInfo}>
                    {/* Avatar (Emoji) */}
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarEmoji}>👤</Text>
                    </View>
                    
                    {/* İsim ve Seviye */}
                    <View style={styles.nameContainer}>
                        <Text style={styles.username}>
                            {item.username || shortenAddress(item.wallet_address || '', 4)}
                            {isCurrentUser && ' (You)'}
                        </Text>
                        
                        {/* Seviye + Adı (Dinamik renk) */}
                        <Text style={[styles.levelText, { color: levelInfo.color }]}>
                            Lv.{item.level} {levelInfo.name}
                        </Text>
                    </View>
                </View>

                {/* SCORE (XP Points) */}
                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreValue}>
                        {formatNumber(item.total_xp)}
                    </Text>
                    <Text style={styles.scoreLabel}>points</Text>
                </View>
            </Card>
        )
    }

    // === MAIN RENDER ===
    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <Text style={styles.title}>🏆 Leaderboard</Text>
            </View>

            {/* TABS */}
            <View style={styles.tabs}>
                {renderTab('global', 'Global')}
                {renderTab('daily', 'Today')}
                {renderTab('weekly', 'This Week')}
            </View>

            {/* LEADERBOARD LIST OR LOADING */}
            {isLoading ? (
                <Loading fullScreen text="Loading..." />
            ) : (
                <FlatList
                    data={leaderboard}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.wallet_address || Math.random().toString()}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyEmoji}>🏜️</Text>
                            <Text style={styles.emptyText}>No players yet</Text>
                            <Text style={styles.emptySubtext}>Be the first!</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    )
}

// === STYLESHEET ===
const styles = StyleSheet.create({
    // Container
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    // Header
    header: {
        padding: 16,
        paddingBottom: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
    },

    // Tabs
    tabs: {
        flexDirection: 'row',          // Yatay diz
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 8,                        // Sekmeler arasında boşluk
    },
    tab: {
        flex: 1,                       // Her sekme eşit genişlik
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
    },
    activeTab: {
        backgroundColor: COLORS.primary,  // Aktif sekmenin arka planı
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    activeTabText: {
        color: COLORS.text,            // Aktif sekmede metin aydınlat
    },

    // List
    listContent: {
        padding: 16,
        paddingTop: 0,
    },

    // List Item (Card)
    itemCard: {
        flexDirection: 'row',          // Yatay düzen
        alignItems: 'center',
        marginBottom: 12,
        padding: 12,
    },
    currentUserCard: {
        borderWidth: 2,
        borderColor: COLORS.primary,   // Mevcut kullanıcıyı border ile vurgula
    },

    // Rank Display
    rankContainer: {
        width: 40,
        alignItems: 'center',
    },
    rankEmoji: {
        fontSize: 24,
    },
    rankNumber: {
        fontSize: 16,
        fontWeight: 'bold',
    },

    // User Info
    userInfo: {
        flex: 1,
        flexDirection: 'row',          // Avatar ve İsim yan yana
        alignItems: 'center',
        marginLeft: 8,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,              // Yuvarlak avatar
        backgroundColor: COLORS.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarEmoji: {
        fontSize: 20,
    },
    nameContainer: {
        marginLeft: 12,
    },
    username: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    levelText: {
        fontSize: 12,
        marginTop: 2,
    },

    // Score
    scoreContainer: {
        alignItems: 'flex-end',
    },
    scoreValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    scoreLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
    },
    emptySubtext: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
})