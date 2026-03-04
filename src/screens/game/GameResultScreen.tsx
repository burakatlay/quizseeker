import React, { useState } from 'react'
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { Loading } from '../../components/common/Loading'
import { COLORS } from '../../constants'
import { useGameStore } from '../../stores/gameStore'

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ResultStats {
    emoji: string
    title: string
    subtitle?: string
}

// ============================================
// MAIN COMPONENT
// ============================================

export function GameResultScreen({ navigation }: any) {
    const { result, isLoading } = useGameStore()
    const [isNavigating, setIsNavigating] = useState(false)

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading || !result) {
        return <Loading fullScreen text="Loading results..." />
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    const getResultMessage = (): ResultStats => {
        if (result.correctCount >= 7) {
            return {
                emoji: '🎉',
                title: 'Excellent!',
                subtitle: 'Outstanding performance!',
            }
        } else if (result.correctCount >= 5) {
            return {
                emoji: '😊',
                title: 'Good!',
                subtitle: 'Well done!',
            }
        } else {
            return {
                emoji: '💪',
                title: 'Keep Going!',
                subtitle: 'You\'ll do better next time!',
            }
        }
    }

    const getXPDisplay = (): string => {
        return result.levelUp ? `+${result.xpGain} XP 🎉` : `+${result.xpGain} XP`
    }

    // ============================================
    // EVENT HANDLERS
    // ============================================

    const handleBackHome = async () => {
        try {
            setIsNavigating(true)
            console.log('🏠 Navigating to Home...')
            navigation.navigate('Home')
        } catch (error: any) {
            console.error('❌ Navigation error:', error)
            setIsNavigating(false)
        }
    }

    // ============================================
    // COMPUTED VALUES
    // ============================================

    const resultMessage = getResultMessage()
    const xpText = getXPDisplay()
    const hasAchievements = result.newAchievements && result.newAchievements.length > 0

    // ============================================
    // RENDER
    // ============================================

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* ====== RESULT TITLE ====== */}
                <Card style={styles.titleCard}>
                    <Text style={styles.titleEmoji}>{resultMessage.emoji}</Text>
                    <Text style={styles.title}>{resultMessage.title}</Text>
                    {resultMessage.subtitle && (
                        <Text style={styles.subtitle}>{resultMessage.subtitle}</Text>
                    )}
                </Card>

                {/* ====== SCORE SUMMARY ====== */}
                <Card style={styles.scoreCard}>
                    {/* Score Points */}
                    <View style={styles.scoreItem}>
                        <Text style={styles.scoreIcon}>🎯</Text>
                        <Text style={styles.scoreValue}>{result.sessionScore}</Text>
                        <Text style={styles.scoreLabel}>Points</Text>
                    </View>

                    <View style={styles.scoreDivider} />

                    {/* Correct Answers */}
                    <View style={styles.scoreItem}>
                        <Text style={styles.scoreIcon}>✅</Text>
                        <Text style={styles.scoreValue}>{result.correctCount}/10</Text>
                        <Text style={styles.scoreLabel}>Correct</Text>
                    </View>

                    <View style={styles.scoreDivider} />

                    {/* XP Gained */}
                    <View style={styles.scoreItem}>
                        <Text style={styles.scoreIcon}>✨</Text>
                        <Text style={styles.scoreValue}>{xpText}</Text>
                        <Text style={styles.scoreLabel}>Gained</Text>
                    </View>
                </Card>

                {/* ====== LEVEL UP CELEBRATION ====== */}
                {result.levelUp && (
                    <Card style={[styles.achievementCard, styles.levelUpCard]}>
                        <Text style={styles.achievementEmoji}>🚀</Text>
                        <Text style={styles.achievementTitle}>LEVEL UP!</Text>
                        <Text style={styles.achievementText}>
                            You reached Level {result.newLevel}!
                        </Text>
                    </Card>
                )}

                {/* ====== NEW ACHIEVEMENTS ====== */}
                {hasAchievements && (
                    <Card style={styles.achievementsCard}>
                        <Text style={styles.achievementsTitle}>🏆 New Achievements</Text>

                        {result.newAchievements.map((achievement, index) => (
                            <View
                                key={index}
                                style={styles.achievementItem}
                            >
                                <Text style={styles.achievementItemEmoji}>
                                    {achievement.emoji}
                                </Text>
                                <View style={styles.achievementItemContent}>
                                    <Text style={styles.achievementItemName}>
                                        {achievement.name}
                                    </Text>
                                    <Text style={styles.achievementItemDesc}>
                                        {achievement.description}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </Card>
                )}

                {/* ====== STATISTICS ====== */}
                <Card style={styles.statsCard}>
                    <Text style={styles.statsTitle}>📊 Your Statistics</Text>

                    {/* Total XP */}
                    <View style={styles.statLine}>
                        <Text style={styles.statLabel}>Total XP:</Text>
                        <Text style={styles.statValue}>{result.totalXp}</Text>
                    </View>

                    {/* Current Streak */}
                    <View style={styles.statLine}>
                        <Text style={styles.statLabel}>Current Streak:</Text>
                        <Text style={styles.statValue}>{result.currentStreak}</Text>
                    </View>

                    {/* Longest Streak */}
                    <View style={styles.statLine}>
                        <Text style={styles.statLabel}>Longest Streak:</Text>
                        <Text style={styles.statValue}>{result.longestStreak}</Text>
                    </View>
                </Card>

                {/* ====== ACTION BUTTON ====== */}
                <Card style={styles.actionCard}>
                    <Button
                        title={
                            isNavigating
                                ? '⏳ Loading...'
                                : '🏠 Back to Home'
                        }
                        onPress={handleBackHome}
                        disabled={isNavigating}
                    />
                </Card>
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
        backgroundColor: COLORS.background,
        padding: 16,
    },

    // ===== TITLE SECTION =====
    titleCard: {
        alignItems: 'center',
        marginBottom: 16,
    },

    titleEmoji: {
        fontSize: 48,
        marginBottom: 8,
    },

    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },

    subtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },

    // ===== SCORE CARD =====
    scoreCard: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 16,
        padding: 16,
    },

    scoreItem: {
        alignItems: 'center',
        flex: 1,
    },

    scoreIcon: {
        fontSize: 24,
        marginBottom: 8,
    },

    scoreValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 4,
    },

    scoreLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },

    scoreDivider: {
        width: 1,
        height: 50,
        backgroundColor: COLORS.border,
    },

    // ===== ACHIEVEMENT CARDS =====
    achievementCard: {
        alignItems: 'center',
        marginBottom: 16,
        padding: 16,
    },

    levelUpCard: {
        backgroundColor: COLORS.primary + '20',
    },

    achievementEmoji: {
        fontSize: 40,
        marginBottom: 8,
    },

    achievementTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 4,
    },

    achievementText: {
        fontSize: 14,
        color: COLORS.text,
    },

    // ===== ACHIEVEMENTS LIST =====
    achievementsCard: {
        marginBottom: 16,
    },

    achievementsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },

    achievementItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    achievementItemEmoji: {
        fontSize: 24,
        marginRight: 12,
    },

    achievementItemContent: {
        flex: 1,
    },

    achievementItemName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 2,
    },

    achievementItemDesc: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },

    // ===== STATS CARD =====
    statsCard: {
        marginBottom: 16,
    },

    statsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 12,
    },

    statLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    statLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },

    statValue: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
    },

    // ===== ACTION CARD =====
    actionCard: {
        marginBottom: 32,
    },
})