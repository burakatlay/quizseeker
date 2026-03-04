import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../constants'

// ============================================
// SUPABASE CLIENT OLUŞTURMA
// ============================================

/**
 * SUPABASE CLIENT INITIALIZATION
 * 
 * AMAÇ: Supabase ile backend bağlantısı kurmak
 * 
 * SUPABASE NEDİR:
 * - PostgreSQL database (realtime)
 * - Authentication (JWT based)
 * - Storage (file hosting)
 * - Edge Functions (serverless)
 * - Vector similarity search
 * 
 * CLIENT AYARLARI:
 * 
 * ✅ auth.storage: AsyncStorage
 *    - React Native ortamında local storage
 *    - Token'ları cihazda sakla
 *    - App yeniden açılırken oturum restore et
 * 
 * ✅ auth.autoRefreshToken: true
 *    - Access token sona ererse otomatik yenile
 *    - Refresh token kullan
 *    - User müdahale etmeden continue
 * 
 * ✅ auth.persistSession: true
 *    - Session'ı AsyncStorage'da sakla
 *    - App restart'ta restore et
 *    - Manual login gerekmez
 * 
 * ✅ auth.detectSessionInUrl: false
 *    - URL'den session detect etme
 *    - React Native'de URL session'u yoktur
 *    - Web için true olurdu
 * 
 * SUPABASE_URL:
 * - Örn: 'https://project-id.supabase.co'
 * - Project API endpoint
 * - Tüm request'ler buraya gider
 * 
 * SUPABASE_ANON_KEY:
 * - Public/Anonymous API key
 * - Client'te güvenli (rate limited)
 * - Authenticated requestler için access token gerekli
 * 
 * AKIŞ:
 * 1. Supabase client'ı initialize et
 * 2. Auth storage'ı AsyncStorage'a point et
 * 3. Auto refresh ve persistence'ı enable et
 * 4. App başladığında session restore et
 * 5. Requestler otomatik token'ı header'a ekle
 */
export const supabase: SupabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            // ===== STORAGE CONFIGURATION =====
            /**
             * Token'ları nerede sakla
             * AsyncStorage: React Native persistent storage
             * Dosya: /data/data/com.app.name/shared_prefs/
             */
            storage: AsyncStorage,

            // ===== AUTO REFRESH CONFIGURATION =====
            /**
             * Access token süresi bitse otomatik yenile
             * Refresh token ile yeni access token al
             * Background'da veya request sırasında
             */
            autoRefreshToken: true,

            // ===== PERSISTENCE CONFIGURATION =====
            /**
             * Session verilerini persist et
             * App kapatılırken: AsyncStorage'a yaz
             * App açılırken: AsyncStorage'dan oku ve restore et
             * Result: Kullanıcı yeniden login yapmasın
             */
            persistSession: true,

            // ===== URL DETECTION CONFIGURATION =====
            /**
             * URL'den session detect et
             * Web (OAuth callback): true
             * React Native (deep link): false
             * Deep link: custom protocol ile handle et
             */
            detectSessionInUrl: false,
        },
    }
)

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * 1. INVOKE EDGE FUNCTION
 */

/**
 * SUPABASE EDGE FUNCTION ÇAĞIR
 * 
 * AMAÇ: Serverless function'ı invoke et
 * 
 * EDGE FUNCTION NEDİR:
 * - Supabase Cloud'da çalışan serverless fonksiyonlar
 * - TypeScript/JavaScript
 * - HTTP endpoint ile trigger edilir
 * - Database access ve external API call yap
 * 
 * PARAMETRELER:
 * - name: Function adı
 *   Örn: 'purchase-package'
 *   Örn: 'verify-transaction'
 *   Supabase dashboard'dan tanımlı
 * 
 * - body: Request body
 *   { packageId: 1, txSignature: 'sig123' }
 *   JSON formatında serialize edilir
 * 
 * GENERIC TYPE:
 * - <T>: Response data type
 *   invokeFunction<PurchaseResult>('purchase-package', {...})
 * 
 * AKIŞ:
 * 1. Mevcut session'ı kontrol et
 * 2. Token varsa log'la (debug)
 * 3. Edge function'ı invoke et (body ile)
 * 4. Response varsa: <T> type'ında return et
 * 5. Error varsa: Hata log'la, throw et
 * 
 * SESSION HANDLING:
 * - Session varsa: Token otomatik header'a eklenir
 * - Session yoksa: Anonymous request (public functions)
 * - Önemli fonksiyonlar RLS ile protect edilir
 * 
 * ERROR HANDLING:
 * - FunctionsHttpError: Error body'sini parse et
 * - Stack trace'i log'la
 * - Caller'a throw et (UI error göster)
 * 
 * ÖRNEK KULLANIM:
 * 
 * // Paket satın alma
 * const result = await invokeFunction<{
 *   success: boolean
 *   userId: string
 *   packagesCount: number
 * }>('purchase-package', {
 *   packageId: 1,
 *   txSignature: 'sig...'
 * })
 * 
 * // Cevap doğrulama
 * const verified = await invokeFunction<{
 *   isCorrect: boolean
 *   score: number
 * }>('verify-answer', {
 *   entryId: 'entry123',
 *   questionId: 'q1',
 *   selectedOption: 2
 * })
 * 
 * HATA TÜRLERI:
 * 1. Network Error: İnternet yok
 * 2. FunctionsHttpError: Function error (500, 400, vb.)
 * 3. Auth Error: Session invalid
 * 4. Timeout: Request çok uzun sürüyor
 * 
 * SECURITY:
 * - Token header'da gönderilir (secure)
 * - RLS (Row Level Security) ile row access kontrol et
 * - Function'lar backend'de validate etsin
 * - User ID her zaman verify et
 * 
 * PERFORMANCE:
 * - ~500ms (network bağlı)
 * - Parallel: Promise.all ile multiple invoke
 * - Retry: Timeout'ta retry logic ekle
 * 
 * DEBUG:
 * - console.log token (partial)
 * - error.context.json() ile error body
 * - Network tab'ında request inspect et
 * 
 * BEST PRACTICES:
 * 1. Her invoke için type define et
 * 2. Function'lar idempotent olsun (tekrar çalışsa ok)
 * 3. Error handling: Try-catch outer'da
 * 4. Loading state UI'de göster
 * 5. Timeout handling (15 saniye max)
 */
export async function invokeFunction<T>(
    name: string,
    body: any
): Promise<T> {
    try {
        // ===== SESSION KONTROL =====
        console.log(`📞 Invoking Edge Function: ${name}`)

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
            console.error('⚠️ Session fetch error:', sessionError.message)
        }

        if (!session) {
            console.warn(`⚠️ No active session for function: ${name}`)
            console.log('ℹ️ Function will be invoked as anonymous')
        } else {
            // Token'ın ilk 20 karakterini göster (security)
            const tokenPreview = session.access_token.slice(0, 20) + '...'
            console.log(`🔑 Request authenticated with token: ${tokenPreview}`)
        }

        // ===== FUNCTION İNVOKE ET =====
        console.log('📤 Sending request body:', {
            function: name,
            bodyKeys: Object.keys(body),
        })

        const { data, error } = await supabase.functions.invoke(name, {
            body,
        })

        // ===== ERROR HANDLING =====
        if (error) {
            console.error(`❌ Function error (${name}):`, {
                name: error.name,
                message: error.message,
                status: (error as any).status,
            })

            // Detaylı error body'sini çek
            if (error.name === 'FunctionsHttpError') {
                try {
                    const errContext = (error as any).context
                    if (errContext?.json) {
                        const errBody = await errContext.json()
                        console.error('📋 Error Response Body:', errBody)
                    }
                } catch (parseError) {
                    console.error('❌ Could not parse error body')
                }
            }

            throw error
        }

        // ===== SUCCESS =====
        console.log(`✅ Function success (${name}):`, {
            dataKeys: data ? Object.keys(data) : 'null',
        })

        return data as T

    } catch (error: any) {
        console.error(`❌ Function invocation failed (${name}):`, error.message)
        throw error
    }
}

/**
 * 2. GET SESSION
 */

/**
 * SUPABASE SESSION'I AL
 * 
 * AMAÇ: Mevcut user session'ını getir
 * 
 * SESSION NEDİR:
 * - User login durumu bilgisi
 * - İçerir: access_token, refresh_token, user_id, vb.
 * - Token'lar API request'lerinde kullanılır
 * 
 * KULLANIM:
 * 1. App başladığında session kontrol et
 * 2. Session varsa: Authenticated user
 * 3. Session yoksa: Anonymous user
 * 
 * RETURN:
 * {
 *   access_token: 'eyJhbGc...',
 *   refresh_token: 'refresh_...',
 *   expires_at: 1704067200,
 *   expires_in: 3600,
 *   token_type: 'bearer',
 *   user: {
 *     id: 'user-uuid',
 *     email: 'user@example.com'
 *   }
 * } | null
 * 
 * AKIŞ:
 * 1. getSession() çağır
 * 2. Session varsa: Return
 * 3. Session yoksa: null return
 * 4. Error varsa: Throw
 * 
 * TIMING:
 * - ~100ms (local check, network yok)
 * 
 * ERROR DURUMLARI:
 * - Session corrupted: Throw
 * - AsyncStorage error: Throw
 * 
 * ÖRNEK KULLANIM:
 * 
 * const session = await getSession()
 * if (session) {
 *   // Authenticated
 *   const userId = session.user.id
 *   const token = session.access_token
 * } else {
 *   // Anonymous
 *   // showLoginScreen()
 * }
 * 
 * BEST PRACTICES:
 * 1. App startup'ta kontrol et
 * 2. Protected operations öncesi verify et
 * 3. Token süresi aşmışsa: Refresh et
 * 4. Session fail'erse: User logout et
 */
export async function getSession() {
    try {
        console.log('🔍 Fetching current session...')

        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
            console.error('❌ Failed to get session:', error.message)
            throw error
        }

        if (session) {
            console.log('✅ Session found:', {
                userId: session.user?.id,
                expiresAt: new Date(session.expires_at! * 1000).toISOString(),
            })
        } else {
            console.log('ℹ️ No active session')
        }

        return session

    } catch (error: any) {
        console.error('❌ Get session error:', error.message)
        throw error
    }
}

/**
 * 3. SET SESSION MANUALLY
 */

/**
 * SUPABASE SESSION'ı MANUEL OLARAK AYARLA
 * 
 * AMAÇ: Authentication sonrası token'ları Supabase client'a set et
 * 
 * NE ZAMAN KULLANILIR:
 * 1. Wallet authentication:
 *    - Backend: Nonce imzala ve doğrula
 *    - Backend: Access token ve refresh token oluştur
 *    - Frontend: setSession() ile client'a set et
 * 
 * 2. OAuth callback:
 *    - OAuth provider'dan redirect
 *    - Token'lar URL'de gelir
 *    - setSession() ile set et
 * 
 * 3. Token refresh:
 *    - Refresh token ile yeni access token al
 *    - setSession() ile update et
 * 
 * PARAMETRELER:
 * - accessToken: JWT access token
 *   Format: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *   Süresi: ~1 saat
 *   Header'da: Authorization: Bearer {token}
 * 
 * - refreshToken: Refresh token
 *   Format: UUID style string
 *   Süresi: ~30 gün
 *   Access token'ı yenilemek için kullanılır
 * 
 * AKIŞ:
 * 1. Token'ları object olarak construct et
 * 2. setSession() ile Supabase client'a set et
 * 3. Client otomatik:
 *    a. Token'ları memory'de depola
 *    b. AsyncStorage'a yaz (persist)
 *    c. Header'lara ekle
 *    d. Auto-refresh configure et
 * 
 * RETURN:
 * {
 *   session: {
 *     access_token, refresh_token, expires_at, user
 *   }
 * }
 * 
 * TIMING:
 * - ~50ms (local only, network yok)
 * 
 * ERROR DURUMLARI:
 * - Token'lar invalid: Error
 * - AsyncStorage fail: Error
 * - Type mismatch: Error
 * 
 * ÖRNEK KULLANIM:
 * 
 * // Wallet authentication
 * const authResult = await verifySignature(wallet, sig, nonce)
 * const { accessToken, refreshToken } = authResult.session
 * 
 * // Set session
 * await setSession(accessToken, refreshToken)
 * 
 * // Artık session active
 * const session = await getSession()
 * console.log(session.user.id)
 * 
 * // Next: AsyncStorage'da sakla
 * await AsyncStorage.setItem('access_token', accessToken)
 * await AsyncStorage.setItem('refresh_token', refreshToken)
 * 
 * SECURITY:
 * - Token'lar HTTPS üzerinde gönderilsin
 * - AsyncStorage encrypted olmalı (production)
 * - Token'ları log'ta gösterme (full)
 * - Refresh token'ı backend'de verify et
 * 
 * BEST PRACTICES:
 * 1. Backend'den token'ları al
 * 2. setSession() ile set et
 * 3. AsyncStorage'da sakla (optional, persist zaten yapıyor)
 * 4. Success log'la
 * 5. Error: Auth flow restart et
 */
export async function setSession(
    accessToken: string,
    refreshToken: string
) {
    try {
        console.log('🔐 Setting new session...')

        const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        })

        if (error) {
            console.error('❌ Failed to set session:', error.message)
            throw error
        }

        if (data?.session) {
            console.log('✅ Session set successfully:', {
                userId: data.session.user?.id,
                expiresAt: new Date(
                    data.session.expires_at! * 1000
                ).toISOString(),
            })
        }

        return data

    } catch (error: any) {
        console.error('❌ Set session error:', error.message)
        throw error
    }
}

// ============================================
// SUPABASE EXPORT
// ============================================

/**
 * EXPORT SUMMARY
 * 
 * ✅ supabase: Supabase client (initialized)
 *    - Kullan: supabase.from('table').select()
 *    - Kullan: supabase.auth.signOut()
 * 
 * ✅ invokeFunction<T>(name, body)
 *    - Supabase Edge Function çağır
 *    - Generic type support
 *    - Error handling + logging
 * 
 * ✅ getSession()
 *    - Mevcut session'ı getir
 *    - Type safe
 *    - Error handling
 * 
 * ✅ setSession(accessToken, refreshToken)
 *    - Session manual set et
 *    - Authentication flow'da kullan
 *    - Persistence otomatik
 */