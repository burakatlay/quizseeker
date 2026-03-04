import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';
import { COLORS } from '../../constants';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export function Button({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    icon,
    style,
    textStyle,
}: ButtonProps) {
    const isDisabled = disabled || loading;

    const getSize = () => {
        switch (size) {
            case 'small':
                return { paddingVertical: 8, paddingHorizontal: 16 };
            case 'large':
                return { paddingVertical: 18, paddingHorizontal: 32 };
            default:
                return { paddingVertical: 14, paddingHorizontal: 24 };
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'small':
                return 14;
            case 'large':
                return 18;
            default:
                return 16;
        }
    };

    if (variant === 'primary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={isDisabled}
                style={[{ opacity: isDisabled ? 0.5 : 1 }, style]}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={[COLORS.primary, COLORS.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.button, getSize(), styles.primaryButton]}
                >
                    {loading ? (
                        <ActivityIndicator color={COLORS.text} size="small" />
                    ) : (
                        <>
                            {icon}
                            <Text style={[styles.buttonText, { fontSize: getFontSize() }, textStyle]}>
                                {title}
                            </Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    const getVariantStyle = () => {
        switch (variant) {
            case 'secondary':
                return {
                    backgroundColor: COLORS.surface,
                    borderWidth: 0,
                };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderColor: COLORS.primary,
                };
            case 'ghost':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                };
            default:
                return {};
        }
    };

    const getTextColor = () => {
        switch (variant) {
            case 'outline':
            case 'ghost':
                return COLORS.primary;
            default:
                return COLORS.text;
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            style={[
                styles.button,
                getSize(),
                getVariantStyle(),
                { opacity: isDisabled ? 0.5 : 1 },
                style,
            ]}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} size="small" />
            ) : (
                <>
                    {icon}
                    <Text
                        style={[
                            styles.buttonText,
                            { fontSize: getFontSize(), color: getTextColor() },
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        gap: 8,
    },
    primaryButton: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: {
        color: COLORS.text,
        fontWeight: '600',
    },
});