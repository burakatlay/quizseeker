import React from 'react';
import { StyleSheet, View, ViewStyle, type StyleProp } from 'react-native';
import { COLORS } from '../../constants';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'default' | 'elevated' | 'outline';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
    const getVariantStyle = () => {
        switch (variant) {
            case 'elevated':
                return {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                };
            case 'outline':
                return {
                    borderWidth: 1,
                    borderColor: COLORS.border,
                };
            default:
                return {};
        }
    };

    return (
        <View style={[styles.card, getVariantStyle(), style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
    },
});