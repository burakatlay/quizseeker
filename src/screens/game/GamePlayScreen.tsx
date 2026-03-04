import { useNavigation } from '@react-navigation/native'
import React, { useEffect, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/common/Button'
import { Loading } from '../../components/common/Loading'
import { OptionButton } from '../../components/game/OptionButton'
import { QuestionCard } from '../../components/game/QuestionCard'
import { Timer } from '../../components/game/Timer'
import { COLORS, QUESTIONS_PER_GAME } from '../../constants'
import { useGameStore } from '../../stores/gameStore'

// ============================================
// TYPE DEFINITIONS
// ============================================

interface GameState {
    selectedOptionId: number | null
    showResult: boolean
    isPaused: boolean
    hasSubmitted: boolean
}

// ============================================
// MAIN COMPONENT
// ============================================

export function GamePlayScreen() {
    const navigation = useNavigation<any>()

    // Store Management
    const {
        session,
        currentQuestion,
        categoryName,
        isLoading,
        lastAnswerResult,
        selectAnswer,
        nextQuestion,
        timeOut,
        endGame,
    } = useGameStore()

    // ============================================
    // STATE MANAGEMENT
    // ============================================

    const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null)
    const [showResult, setShowResult] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [hasSubmitted, setHasSubmitted] = useState(false)
    const [navigateToResults, setNavigateToResults] = useState(false)

    // Refs for cleanup and safety
    const isMounted = useRef(true)
    const timeUpScheduled = useRef(false)

    // ============================================
    // LIFECYCLE HOOKS
    // ============================================

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMounted.current = false
        }
    }, [])

    // Safe navigation to results
    useEffect(() => {
        if (
            navigateToResults &&
            session &&
            session.answers.length === QUESTIONS_PER_GAME &&
            !isLoading
        ) {
            navigation.replace('GameResult')
        }
    }, [navigateToResults, session?.answers.length, isLoading, navigation])

    // Reset state when question changes
    useEffect(() => {
        setSelectedOptionId(null)
        setShowResult(false)
        setIsPaused(false)
        setHasSubmitted(false)
    }, [currentQuestion?.questionId])

    // ============================================
    // EVENT HANDLERS
    // ============================================

    const handleSelectOption = async (optionId: number) => {
        // Prevent multiple submissions
        if (showResult || isLoading || hasSubmitted) return

        setSelectedOptionId(optionId)
        setIsPaused(true)
        setHasSubmitted(true)

        try {
            await selectAnswer(optionId)
            if (isMounted.current) {
                setShowResult(true)
            }
        } catch (error) {
            console.error('❌ Select answer error:', error)
            if (isMounted.current) {
                Alert.alert(
                    'Error',
                    'Failed to submit answer'
                )
            }
        }
    }

    const handleTimeUp = async () => {
        // Prevent double execution
        if (showResult || !isMounted.current) return

        if (isMounted.current) {
            setIsPaused(true)
        }

        try {
            await timeOut()
            if (isMounted.current) {
                if (!timeUpScheduled.current) {
                    timeUpScheduled.current = true
                    setTimeout(() => {
                        if (isMounted.current) {
                            setShowResult(true)
                        }
                        timeUpScheduled.current = false
                    }, 0)
                }
            }
        } catch (error) {
            console.error('❌ Time out error:', error)
        }
    }

    const handleNextQuestion = async () => {
        if (!session) return

        const currentQuestionNumber = session.currentQuestionIndex + 1

        // Check if this is the last question
        if (currentQuestionNumber === QUESTIONS_PER_GAME) {
            try {
                console.log('🏁 Last question - ending game...')
                await endGame()
                setNavigateToResults(true)
                navigation.navigate('GameResult')
            } catch (error) {
                console.error('❌ End game error:', error)
                Alert.alert(
                    'Error',
                    `Failed to save results: ${(error as any).message}`
                )
            }
        } else {
            // Move to next question
            nextQuestion()
        }
    }

    // ============================================
    // LOADING STATE
    // ============================================

    if (!session || !currentQuestion) {
        return <Loading fullScreen text="Loading game..." />
    }

    // ============================================
    // COMPUTED VALUES
    // ============================================

    const currentQuestionNumber = session.currentQuestionIndex + 1
    const totalScore = session.answers.reduce((sum, a) => sum + a.score, 0)
    const isLastQuestion = currentQuestionNumber === QUESTIONS_PER_GAME

    // ============================================
    // RENDER
    // ============================================

    return (
        <SafeAreaView style={styles.container}>
            {/* ====== HEADER / SCORE ====== */}
            <View style={styles.headerSection}>
                {/* Score Display */}
                <View style={styles.scoreRow}>
                    <Text style={styles.scoreLabel}>Score</Text>
                    <Text style={styles.scoreValue}>{totalScore}</Text>
                </View>

                {/* Progress */}
                <Text style={styles.progressText}>
                    Question {currentQuestionNumber} / {QUESTIONS_PER_GAME}
                </Text>
            </View>

            {/* ====== TIMER ====== */}
            <Timer
                key={String(currentQuestion.questionId)}
                duration={currentQuestion.timeLimit}
                onTimeUp={handleTimeUp}
                isPaused={isPaused}
            />

            {/* ====== QUESTION CARD ====== */}
            <QuestionCard
                question={currentQuestion}
                questionNumber={currentQuestionNumber}
                totalQuestions={QUESTIONS_PER_GAME}
            />

            {/* ====== OPTIONS CONTAINER ====== */}
            <View style={styles.optionsContainer}>
                {currentQuestion.options.map((option) => (
                    <OptionButton
                        key={option.id}
                        option={option}
                        onPress={() => handleSelectOption(option.id)}
                        disabled={showResult || isLoading}
                        isSelected={selectedOptionId === option.id}
                        isCorrect={lastAnswerResult?.correctOptionId === option.id}
                        showResult={showResult}
                    />
                ))}
            </View>

            {/* ====== RESULT FEEDBACK ====== */}
            {showResult && lastAnswerResult && (
                <View style={styles.resultContainer}>
                    {/* Result Badge */}
                    <View
                        style={[
                            styles.resultBadge,
                            {
                                backgroundColor: lastAnswerResult.isCorrect
                                    ? COLORS.success
                                    : COLORS.error,
                            },
                        ]}
                    >
                        <Text style={styles.resultText}>
                            {lastAnswerResult.isCorrect ? '✅ Correct!' : '❌ Wrong'}
                        </Text>
                        <Text style={styles.resultScore}>
                            +{lastAnswerResult.score} points
                        </Text>
                    </View>

                    {/* Next Button */}
                    <Button
                        title={
                            isLastQuestion
                                ? '📊 See Results'
                                : '➜ Next Question'
                        }
                        onPress={handleNextQuestion}
                        style={styles.nextButton}
                        disabled={isLoading}
                    />
                </View>
            )}
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

    // ===== HEADER SECTION =====
    headerSection: {
        marginBottom: 16,
    },

    scoreRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },

    scoreLabel: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },

    scoreValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.primary,
    },

    progressText: {
        textAlign: 'center',
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 4,
    },

    // ===== OPTIONS =====
    optionsContainer: {
        flex: 1,
    },

    // ===== RESULT SECTION =====
    resultContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },

    resultBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 12,
        marginBottom: 16,
    },

    resultText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },

    resultScore: {
        fontSize: 16,
        color: '#fff',
        opacity: 0.9,
    },

    nextButton: {
        minWidth: 200,
    },
})