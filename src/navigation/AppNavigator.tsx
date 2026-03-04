import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Loading } from '../components/common/Loading'
import { COLORS } from '../constants'
import { useAuthStore } from '../stores/authStore'

// Screens
import { WelcomeScreen } from '../screens/auth/WelcomeScreen'
import { GamePlayScreen } from '../screens/game/GamePlayScreen'
import { GameResultScreen } from '../screens/game/GameResultScreen'
import { HomeScreen } from '../screens/home/HomeScreen'
import { LeaderboardScreen } from '../screens/leaderboard/LeaderboardScreen'
import { PackagesScreen } from '../screens/package/PackagesScreen'
import { ProfileScreen } from '../screens/profile/ProfileScreen'

// ============================================
// NAVIGATOR INSTANCES
// ============================================

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

// ============================================
// TAB ICON COMPONENT
// ============================================

interface TabIconProps {
    emoji: string
    focused: boolean
}

function TabIcon({ emoji, focused }: TabIconProps) {
    return (
        <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
            <Text style={styles.tabEmoji}>{emoji}</Text>
        </View>
    )
}

// ============================================
// BOTTOM TAB NAVIGATOR
// ============================================

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textSecondary,
                tabBarLabelStyle: styles.tabLabel,
            }}
        >
            {/* 🏠 Home / Games */}
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarLabel: 'Games',
                    tabBarIcon: ({ focused }) => (
                        <TabIcon emoji="🏠" focused={focused} />
                    ),
                }}
            />

            {/* 📦 Packages */}
            <Tab.Screen
                name="Packages"
                component={PackagesScreen}
                options={{
                    tabBarLabel: 'Packages',
                    tabBarIcon: ({ focused }) => (
                        <TabIcon emoji="📦" focused={focused} />
                    ),
                }}
            />

            {/* 🏆 Leaderboard */}
            <Tab.Screen
                name="Leaderboard"
                component={LeaderboardScreen}
                options={{
                    tabBarLabel: 'Leaderboard',
                    tabBarIcon: ({ focused }) => (
                        <TabIcon emoji="🏆" focused={focused} />
                    ),
                }}
            />

            {/* 👤 Profile */}
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ focused }) => (
                        <TabIcon emoji="👤" focused={focused} />
                    ),
                }}
            />
        </Tab.Navigator>
    )
}

// ============================================
// AUTH STACK (Welcome Screen)
// ============================================

function AuthStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen
                name="Welcome"
                component={WelcomeScreen}
            />
        </Stack.Navigator>
    )
}

// ============================================
// APP STACK (Main Tabs + Game Screens)
// ============================================

function AppStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            {/* Main Tab Navigator */}
            <Stack.Screen
                name="MainTabs"
                component={MainTabs}
            />

            {/* Game Play Screen (Modal-like) */}
            <Stack.Screen
                name="GamePlay"
                component={GamePlayScreen}
                options={{
                    gestureEnabled: false,
                }}
            />

            {/* Game Result Screen (Modal-like) */}
            <Stack.Screen
                name="GameResult"
                component={GameResultScreen}
                options={{
                    gestureEnabled: false,
                }}
            />
        </Stack.Navigator>
    )
}

// ============================================
// ROOT NAVIGATOR
// ============================================

interface AppNavigatorProps {
    // Can be extended with additional props if needed
}

export function AppNavigator({}: AppNavigatorProps) {
    const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore()

    // ============================================
    // LIFECYCLE
    // ============================================

    useEffect(() => {
        loadStoredAuth()
    }, [])

    // ============================================
    // LOADING STATE
    // ============================================

    if (isLoading) {
        return (
            <Loading
                fullScreen
                text="Loading QuizSeeker..."
            />
        )
    }

    // ============================================
    // RENDER
    // ============================================

    return (
        <NavigationContainer>
            {isAuthenticated ? <AppStack /> : <AuthStack />}
        </NavigationContainer>
    )
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    // ===== TAB BAR =====
    tabBar: {
        backgroundColor: COLORS.surface,
        borderTopColor: COLORS.border,
        borderTopWidth: 1,
        paddingTop: 8,
        paddingBottom: 8,
        height: 70,
    },

    // ===== TAB LABEL =====
    tabLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 4,
    },

    // ===== TAB ICON =====
    tabIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },

    tabIconFocused: {
        backgroundColor: 'rgba(0, 217, 255, 0.1)',
    },

    tabEmoji: {
        fontSize: 22,
    },
})