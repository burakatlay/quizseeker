import {
    ApiResponse,
    GamePackage,
    GameResult,
    LeaderboardEntry,
    Question,
    User
} from '../types';
import { invokeFunction, supabase } from './supabase';

// ==================== AUTH ====================

interface AuthNonceResponse {
    nonce: string;
    message: string;
}

interface AuthVerifyFunctionResponse {
    isNewUser: boolean;
    user: User | null;
    auth: {
        token_hash: string;
    };
}

interface AuthVerifyResponse {
    isNewUser: boolean;
    user: User | null;
    session: {
        access_token: string;
        refresh_token: string;
        expires_at: number;
    };
}

export async function getNonce(walletAddress: string): Promise<AuthNonceResponse> {
    return await invokeFunction<AuthNonceResponse>('auth-wallet', {
        action: 'get_nonce',
        wallet_address: walletAddress,
    });
}

export async function verifySignature(
    walletAddress: string,
    signature: string,
    nonce: string
): Promise<AuthVerifyResponse> {
    const res = await invokeFunction<AuthVerifyFunctionResponse>('auth-wallet', {
        action: 'verify_signature',
        wallet_address: walletAddress,
        signature,
        nonce,
    });

    const { data, error } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: res.auth.token_hash,
    });

    if (error) throw error;
    if (!data.session) throw new Error('No session returned from verifyOtp');

    return {
        isNewUser: res.isNewUser,
        user: res.user,
        session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at!,
        },
    };
}

interface CreateUserResponse {
    user: User;
    referralCode: string;
    referredBy: number | null;
    welcomeXp: number;
}

export async function createUser(
    walletAddress: string,
    username?: string,
    referralCode?: string
): Promise<CreateUserResponse> {
    const response = await invokeFunction<ApiResponse<CreateUserResponse>>(
        'create-user',
        {
            walletAddress,
            username,
            referralCode,
        }
    );
    return response.data;
}

// ==================== GAME ====================

interface StartGameResponse {
    competitionId: number
    entryId: number
    playType: 'free' | 'package'
    remainingFree: number
    remainingPackage: number
    categoryId: string
    categoryName: string
    message: string
    questions: Question[]
}

export async function startGame(
    gameMode: 'free' | 'package' = 'free',
    categoryId: string
): Promise<StartGameResponse> {
    const response = await invokeFunction<ApiResponse<StartGameResponse>>(
        'start-game',
        {
            gameMode,
            categoryId,
        }
    )
    return response.data
}

interface SubmitAnswerResponse {
    isCorrect: boolean;
    questionScore: number;
    correctOption: {
        id: number;
        label: string;
        text: string;
    };
    answerTimeMs: number;
}

export async function submitAnswer(
    entryId: number,
    questionId: number,
    questionOrder: number,
    selectedOptionId: number | null,
    answerTimeMs: number
): Promise<SubmitAnswerResponse> {
    const response = await invokeFunction<ApiResponse<SubmitAnswerResponse>>(
        'submit-answer',
        {
            entryId,
            questionId,
            questionOrder,
            selectedOptionId,
            answerTimeMs,
        }
    );
    return response.data;
}

export async function completeGame(entryId: number): Promise<GameResult> {
    const response = await invokeFunction<ApiResponse<GameResult>>(
        'complete-game',
        { entryId }
    );
    return response.data;
}

// ==================== PROFILE ====================

interface ProfileResponse {
    profile: User & { globalRank: number };
    packages?: GamePackage[];
    equipped?: any[];
    recentGames?: any[];
    achievements?: any[];
}

export async function getProfile(walletAddress?: string): Promise<ProfileResponse> {
    const params = walletAddress ? `?wallet=${walletAddress}` : '';
    const response = await invokeFunction<ApiResponse<ProfileResponse>>(
        `get-profile${params}`,
        {}
    );
    return response.data;
}

export async function updateProfile(
    username?: string,
    avatarUrl?: string
): Promise<{ user: User }> {
    const response = await invokeFunction<ApiResponse<{ user: User }>>(
        'update-profile',
        { username, avatarUrl }
    );
    return response.data;
}

// ==================== LEADERBOARD ====================

interface LeaderboardResponse {
    type: 'global' | 'daily' | 'weekly';
    leaderboard: LeaderboardEntry[];
}

export async function getLeaderboard(
    type: 'global' | 'daily' | 'weekly' = 'global',
    limit: number = 100,
    offset: number = 0
): Promise<LeaderboardResponse> {
    const response = await invokeFunction<ApiResponse<LeaderboardResponse>>(
        `get-leaderboard?type=${type}&limit=${limit}&offset=${offset}`,
        {}
    );
    return response.data;
}

// ==================== STATS ====================

interface StatsResponse {
    overview: {
        totalGames: number;
        totalCorrect: number;
        totalScore: number;
        averageScore: number;
        overallAccuracy: number;
        currentStreak: number;
        longestStreak: number;
        skrWon: number;
        skrLost: number;
        netSkr: number;
    };
    daily: any[];
    categoryPerformance: any[];
}

export async function getStats(): Promise<StatsResponse> {
    const response = await invokeFunction<ApiResponse<StatsResponse>>(
        'get-stats',
        {}
    );
    return response.data;
}

export async function resetDailyAttempts(userId: number) {
    const response = await supabase
        .from('users')
        .update({
            daily_free_plays_remaining: 3,
            last_login_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single()

    if (response.error) throw response.error
    return response.data
}

