import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants';

interface LoadingProps {
    text?: string;
    fullScreen?: boolean;
}

export function Loading({ text = 'Loading...', fullScreen = false }: LoadingProps) {
    if (fullScreen) {
        return (
            <View style={styles.fullScreen}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.text}>{text}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            {text && <Text style={styles.text}>{text}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    fullScreen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        gap: 16,
    },
    text: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
});