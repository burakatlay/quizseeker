// User Types
export interface User {
    id: number;
    wallet_address: string;
    username: string | null;
    avatar_url: string | null;
    referral_code: string;
    total_xp: number;
    level: number;
    total_competition_score: number;
    total_games_played: number;
    total_correct_answers: number;
    current_streak: number;
    longest_streak: number;
    daily_free_plays_remaining: number;
    bonus_daily_plays: number;
    created_at: string;
    last_login_at: string | null;
}

// ➕ EKLE: Package Type
export interface GamePackage {
    id: number
    code: string
    name: string
    description: string
    game_count: number
    price_sol: number
    base_multiplier: number
    bonus_games: number
    is_active: boolean
    display_order: number
    created_at: string
    updated_at: string
}

export interface UserPackage {
    id: number
    user_id: number
    games_remaining: number
    games_total: number
    games_used: number
    purchased_at: string
    is_active: boolean
    depleted_at: string | null
    tx_signature: string
    game_packages: GamePackage
}



// Game Types
export interface Question {
    questionId: number;
    categoryId: number;
    difficulty: 'easy' | 'medium' | 'hard';
    prompt: string;
    imageUrl: string;
    timeLimit: number;
    options: QuestionOption[];
    order: number;
}

export interface QuestionOption {
    id: number;
    label: string;
    text: string;
}

export interface GameSession {
    competitionId: number
    entryId: number
    playType: 'free' | 'package'
    categoryId: string  // ✅ YENİ
    questions: Question[]
    currentQuestionIndex: number
    answers: AnswerRecord[]
    startTime: number
}

export interface AnswerRecord {
    questionId: number;
    questionOrder: number;
    selectedOptionId: number | null;
    answerTimeMs: number;
    isCorrect: boolean;
    score: number;
}

export interface GameResult {
    sessionScore: number;
    correctCount: number;
    xpGain: number;
    newLevel: number;
    levelUp: boolean;
    currentStreak: number;
    longestStreak: number;
    totalXp: number;
    answers: {
        order: number;
        isCorrect: boolean;
        timeMs: number;
        score: number;
        difficulty: string;
    }[];
    newAchievements: Achievement[];
}

// Achievement Types
export interface Achievement {
    name: string;
    description: string;
    xpReward: number;
    emoji: string;
}

// Leaderboard Types
export interface LeaderboardEntry {
    id: number;
    username: string | null;
    avatar_url: string | null;
    level: number;
    total_xp: number;
    total_competition_score: number;
    global_rank: number;
    daily_rank: number;
    weekly_rank: number;
    wallet_address: string;
}

// Auth Types
export interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    walletAddress: string | null;
    user: User | null;
    accessToken: string | null;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

// ➕ EKLE: Profile Response Type (get-profile endpoint'ten dönen)
export interface ProfileResponse {
    profile: User & {
        globalRank: number;
    };
    packages?: GamePackage[]; // ➕ Paketler
    equipped?: any[];
    recentGames?: any[];
    achievements?: any[];
}