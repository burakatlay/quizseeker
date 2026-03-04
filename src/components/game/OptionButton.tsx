import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants';
import { QuestionOption } from '../../types';

interface OptionButtonProps {
    option: QuestionOption;
    onPress: () => void;
    disabled?: boolean;
    isSelected?: boolean;
    isCorrect?: boolean;
    showResult?: boolean;
}

export function OptionButton({
    option,
    onPress,
    disabled = false,
    isSelected = false,
    isCorrect = false,
    showResult = false,
}: OptionButtonProps) {
    const getBackgroundColor = () => {
        if (!showResult) {
            return isSelected ? COLORS.surfaceLight : COLORS.surface;
        }

        if (isCorrect) {
            return 'rgba(16, 185, 129, 0.2)'; // Success with opacity
        }

        if (isSelected && !isCorrect) {
            return 'rgba(239, 68, 68, 0.2)'; // Error with opacity
        }

        return COLORS.surface;
    };

    const getBorderColor = () => {
        if (!showResult) {
            return isSelected ? COLORS.primary : COLORS.border;
        }

        if (isCorrect) {
            return COLORS.success;
        }

        if (isSelected && !isCorrect) {
            return COLORS.error;
        }

        return COLORS.border;
    };

    const getLabelColor = () => {
        if (!showResult) {
            return isSelected ? COLORS.primary : COLORS.textSecondary;
        }

        if (isCorrect) {
            return COLORS.success;
        }

        if (isSelected && !isCorrect) {
            return COLORS.error;
        }

        return COLORS.textSecondary;
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.container,
                {
                    backgroundColor: getBackgroundColor(),
                    borderColor: getBorderColor(),
                    opacity: disabled && !showResult ? 0.6 : 1,
                },
            ]}
            activeOpacity={0.7}
        >
            <View style={[styles.labelContainer, { backgroundColor: getBorderColor() }]}>
                <Text style={[styles.label, { color: COLORS.text }]}>-</Text>
            </View>
            <Text style={styles.optionText}>{option.text}</Text>
            {showResult && isCorrect && (
                <Text style={styles.checkMark}>✓</Text>
            )}
            {showResult && isSelected && !isCorrect && (
                <Text style={styles.crossMark}>✗</Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        marginBottom: 12,
    },
    labelContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    optionText: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
        lineHeight: 22,
    },
    checkMark: {
        fontSize: 20,
        color: COLORS.success,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    crossMark: {
        fontSize: 20,
        color: COLORS.error,
        fontWeight: 'bold',
        marginLeft: 8,
    },
});