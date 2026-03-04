import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants';
import { Question } from '../../types';
import { Card } from '../common/Card';

interface QuestionCardProps {
    question: Question;
    questionNumber: number;
    totalQuestions: number;
}

export function QuestionCard({
    question,
    questionNumber,
    totalQuestions,
}: QuestionCardProps) {
    const getDifficultyColor = () => {
        switch (question.difficulty) {
            case 'easy':
                return COLORS.success;
            case 'medium':
                return COLORS.warning;
            case 'hard':
                return COLORS.error;
            default:
                return COLORS.textSecondary;
        }
    };

    const getDifficultyLabel = () => {
        switch (question.difficulty) {
            case 'easy':
                return 'Easy';
            case 'medium':
                return 'Medium';
            case 'hard':
                return 'Hard';
            default:
                return '';
        }
    };

    return (
        <Card style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.questionNumber}>
                    Soru {questionNumber}/{totalQuestions}
                </Text>
                <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor() }]}>
                    <Text style={styles.difficultyText}>{getDifficultyLabel()}</Text>
                </View>
            </View>

            {/* Question Image */}
            {question.imageUrl && (
                <Image source={{ uri: question.imageUrl }} style={styles.image} resizeMode="contain" />
            )}

            {/* Question Text */}
            <Text style={styles.questionText}>{question.prompt}</Text>
        </Card>
    );
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    questionNumber: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    difficultyBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    difficultyText: {
        fontSize: 12,
        color: COLORS.text,
        fontWeight: '600',
    },
    image: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 16,
        backgroundColor: COLORS.surfaceLight,
    },
    questionText: {
        fontSize: 18,
        color: COLORS.text,
        lineHeight: 26,
        fontWeight: '500',
    },
});