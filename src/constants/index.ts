import { PublicKey } from '@solana/web3.js'

// ==================== SUPABASE CONFIG ====================
export const SUPABASE_URL = '..'
export const SUPABASE_ANON_KEY = '..'

// ==================== SOLANA CONFIG ====================
const HELIUS_API_KEY = '..'

export const SOLANA_RPC_URL = `..`

export const SOLANA_CLUSTER = 'mainnet-beta'

export const PLATFORM_WALLET = new PublicKey('..')

export const APP_IDENTITY = {
    name: 'QuizSeeker',
    uri: 'https://quizseeker.app',
    icon: 'favicon.ico',
}

// ==================== APP CONFIG ====================
export const APP_NAME = 'QuizSeeker'
export const QUESTIONS_PER_GAME = 10
export const DEFAULT_TIME_LIMIT = 10
export const MAX_SCORE_PER_QUESTION = 1000
export const MIN_SCORE_PER_QUESTION = 100

export const MAX_XP_PER_GAME = 10
export const MIN_XP_PER_GAME = 1

// ==================== THEME COLORS ====================
export const COLORS = {
    primary: '#6366F1',
    primaryLight: '#818CF8',
    primaryDark: '#4F46E5',

    // Secondary/Accent Palette
    secondary: '#06B6D4',
    accent: '#06B6D4',
    accentLight: '#22D3EE',

    // Background Palette
    background: '#0F172A',
    backgroundAlt: '#1E293B',
    surface: '#1E293B',
    surfaceLight: '#334155',

    // Text Colors
    text: '#F1F5F9',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',

    // Semantic Colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Border Colors
    border: '#334155',
    borderLight: '#475569',
}

// ==================== LEVEL THRESHOLDS ====================
export const LEVEL_THRESHOLDS = [
    { level: 1, name: 'Rookie', minXP: 0, maxXP: 199, color: '#808080' },
    { level: 2, name: 'Explorer', minXP: 200, maxXP: 599, color: '#4a90d9' },
    { level: 3, name: 'Scholar', minXP: 600, maxXP: 1199, color: '#1e90ff' },
    { level: 4, name: 'Analyst', minXP: 1200, maxXP: 1999, color: '#8b5cf6' },
    { level: 5, name: 'Strategist', minXP: 2000, maxXP: 2999, color: '#a855f7' },
    { level: 6, name: 'Master', minXP: 3000, maxXP: 4199, color: '#ffd700' },
    { level: 7, name: 'Sage', minXP: 4200, maxXP: 5699, color: '#ffa500' },
    { level: 8, name: 'Legend', minXP: 5700, maxXP: 7499, color: '#e5e4e2' },
    { level: 9, name: 'Mythic', minXP: 7500, maxXP: 9999, color: '#b9f2ff' },
    { level: 10, name: 'Oracle', minXP: 10000, maxXP: Infinity, color: '#ff00ff' },
]
