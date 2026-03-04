import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createUser, getNonce, verifySignature } from '../services/api'
import {
    connectWallet,
    disconnectWallet,
    signMessage,
} from '../services/solana'
import { setSession, supabase } from '../services/supabase'
import { AuthState, User } from '../types'

// ============================================
// STORAJJETİ AYARLA (STORAGE KEYS)
// ============================================

/**
 * STORAGE KEYS
 * 
 * AsyncStorage'da depolanacak anahtar-değer çiftleri
 * Uygulamayı kapatıp açtığında bu veriler aynen korunur
 * 
 * NEDEN GEREKLİ:
 * - App yeniden başlatıldığında oturum geri yüklensin
 * - Manuel login yapmasın kullanıcı
 * - Token'lar saklı olsun
 * 
 * HERBİR KEY:
 * - Ön ek: 'quizseeker_' (app identifikasyonu)
 * - Sonrası: Hangi verinin olduğu (wallet_auth_token, vb.)
 * 
 * GÜVENLIK NOTU:
 * - AsyncStorage şifrelenmemiş (production'da TypedArray kullan)
 * - Dev/test için güvenli
 * - Production: Keychain/Keystore kullan
 */
const STORAGE_KEYS = {
    /**
     * Wallet bağlantısı için auth token
     * Wallet tarafından verilen session token
     * Wallet ile işlem imzalarken gerekli
     */
    WALLET_AUTH_TOKEN: 'quizseeker_wallet_auth_token',

    /**
     * Supabase Access Token
     * API'ye her istek sırasında header'da gönderilir
     * JWT formatında
     * Süresi: ~1 saat
     */
    ACCESS_TOKEN: 'quizseeker_access_token',

    /**
     * Supabase Refresh Token
     * Access token'ı yenilemek için kullanılır
     * Süresi: Daha uzun (~30 gün)
     */
    REFRESH_TOKEN: 'quizseeker_refresh_token',

    /**
     * Cüzdan Adresi
     * Solana blockchain adres (public key)
     * Format: 'SxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx'
     * DB queries'de kullanılır
     */
    WALLET_ADDRESS: 'quizseeker_wallet_address',
}

// ============================================
// TİP TANIMLARI
// ============================================

/**
 * AUTH STORE ARAYÜZÜ
 * 
 * Wallet authentication ve kullanıcı oturumu yönetimi
 * 
 * DURUM (AuthState):
 * - isAuthenticated: Giriş yapıldı mı
 * - isLoading: Auth işlemi devam ediyor mu
 * - walletAddress: Kullanıcının cüzdan adresi
 * - user: Kullanıcı profili ve istatistikleri
 * - accessToken: API access token
 * 
 * İŞLEMLER:
 * - connect: Cüzdanı bağla, imzala, giriş yap
 * - disconnect: Cüzdanı ayır, logout yap
 * - setUser: Kullanıcı verilerini güncelle (partial)
 * - loadStoredAuth: Uygulama açılırken kayıtlı oturumu yükle
 * - checkAndResetDailyAttempts: Günlük deneme hakkını sıfırla
 * - refreshUserFromDatabase: DB'den kullanıcı verilerini güncelle
 * - syncUserAfterGameEnd: Oyun bittiğinde user state'ini senkronize et
 */
interface AuthStore extends AuthState {
    // ===== İŞLEMLER =====
    connect: () => Promise<void>
    disconnect: () => Promise<void>
    setUser: (user: User | Partial<User>) => void
    loadStoredAuth: () => Promise<void>
    checkAndResetDailyAttempts: () => Promise<void>
    refreshUserFromDatabase: () => Promise<void>
    syncUserAfterGameEnd: () => Promise<void>
}

// ============================================
// ZUSTAND STORE OLUŞTURMA
// ============================================

/**
 * AUTH STORE
 * 
 * Wallet authentication ve user session yönetimi
 * persist middleware ile AsyncStorage'da depolanır
 * 
 * PERSIST YAPISI:
 * - name: 'auth-store' (storage key'i)
 * - partialize: Hangi state'lerin depolanacağını belirt
 *   ✅ walletAddress, user, isAuthenticated, accessToken
 *   ❌ isLoading (transient, her açılışta false)
 * 
 * HYDRATION:
 * - App başladığında AsyncStorage'dan veriler otomatik yüklenir
 * - loadStoredAuth() ile token doğrulanır
 */
export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            // ========================================
            // BAŞLANGIÇ DURUMU (INITIAL STATE)
            // ========================================

            /**
             * AuthState ilk değerleri
             * App açılırken bu değerlerle başlar
             * Ardından persist middleware tarafından AsyncStorage'dan yüklenir
             */
            isAuthenticated: false,
            isLoading: true,            // App başlarken true (session check sırasında)
            walletAddress: null,        // Null → Cüzdan bağlı değil
            user: null,                 // Null → Kullanıcı profili yok
            accessToken: null,          // Null → Token yok

            // ========================================
            // 1. CONNECT WALLET & AUTHENTICATE
            // ========================================

            /**
             * AMAÇ: Cüzdanı bağla ve giriş yap
             * 
             * AKIŞ (7 adım):
             * 
             * 1️⃣ CÜZDANI BAĞLA (Phantom/Solflare)
             *    - Wallet uygulamasını aç
             *    - Kullanıcıdan onay iste
             *    - Public key ve auth token al
             *    - İsim: connectWallet()
             *    - Return: { publicKey, authToken, walletAddress }
             * 
             * 2️⃣ NONCE AL (Server'dan)
             *    - Backend'e "getNonce" isteği gönder
             *    - Nonce: Unique random string (spam prevention)
             *    - Message: İmzalanacak mesaj
             *    - Return: { nonce, message }
             * 
             * 3️⃣ MESAJI İMZALA (Cüzdan ile)
             *    - İmzalama isteğini cüzdana gönder
             *    - Kullanıcı onay verirse: İmza al
             *    - Kullanıcı redderse: Error fırlat
             *    - Return: { signature }
             * 
             * 4️⃣ İMZAYI DOĞRULA (Server'da)
             *    - Backend'e signature gönder
             *    - Server: İmzayı cryptographically doğrula
             *    - Mevcut user mi, yeni user mi kontrol et
             *    - Return: { isNewUser, user, session }
             *    - session: { access_token, refresh_token }
             * 
             * 5️⃣ YENİ KULLANICI İSE PROFIL OLUŞTUR
             *    - DB'ye yeni user kaydı ekle
             *    - Default values: level 1, xp 0, 3 free plays, vb.
             *    - Referral code oluştur
             *    - Return: { user }
             * 
             * 6️⃣ SUPABASE OTURUMU AYARLA
             *    - Token'ları Supabase client'a kayıt et
             *    - AsyncStorage'da sakla (persistence için)
             *    - Return: Session established
             * 
             * 7️⃣ STATE'İ GÜNCELLE
             *    - isAuthenticated = true
             *    - walletAddress, user, accessToken set et
             *    - isLoading = false
             * 
             * VERİ AKIŞI (DİYAGRAM):
             * ```  
             * App.tsx  
             *   ↓  
             * Wallet Button "Connect" tıkla  
             *   ↓  
             * connect() çalış  
             *   ↓  
             * [Phantom/Solflare aç] ← Kullanıcı onayı  
             *   ↓  
             * connectWallet() ← Auth Token döner  
             *   ↓  
             * getNonce(walletAddress) ← Backend nonce döner  
             *   ↓  
             * signMessage(message, authToken) ← Cüzdan imzala  
             *   ↓  
             * verifySignature(wallet, sig, nonce) ← Backend verify et  
             *   ↓  
             * [Yeni user ise createUser()]  
             *   ↓  
             * setSession(accessToken, refreshToken) ← Supabase client set  
             *   ↓  
             * State update → isAuthenticated = true  
             *   ↓  
             * HomeScreen (navigation yap)  
             * ```
             * 
             * HATA DURUMLARI:
             * - Cüzdan bağlanamadı
             * - Nonce alınamadı
             * - İmza reddedildi
             * - İmza doğrulanamadı
             * - DB error
             * 
             * HATA YÖNETİMİ:
             * - Try-catch tüm işlemleri kapsa
             * - Error log'la
             * - isLoading false'a ayarla
             * - Error'ı throw et (UI error göster)
             * 
             * TIMING:
             * - Tüm işlem ~2-3 saniye sürer
             * - Bekleme: Kullanıcı Phantom'da confirm bekleme
             * 
             * KULLANIM:
             * - Connect button tıklandığında
             * - Loading spinner göster
             * - Error alert'i göster
             * - Success: HomeScreen'a git
             */
            connect: async () => {
                try {
                    set({ isLoading: true })

                    // ===== ADIM 1: CÜZDANI BAĞLA =====
                    console.log('🔗 Connecting to wallet...')
                    const { publicKey, authToken, walletAddress } = await connectWallet()
                    console.log('✅ Wallet connected:', walletAddress)

                    // AsyncStorage'da sakla (disconnect sırasında gerekli)
                    await AsyncStorage.setItem(STORAGE_KEYS.WALLET_AUTH_TOKEN, authToken)
                    await AsyncStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, walletAddress)

                    // ===== ADIM 2: NONCE AL =====
                    console.log('🔐 Requesting authentication nonce...')
                    const { nonce, message } = await getNonce(walletAddress)
                    console.log('✅ Nonce received')

                    // ===== ADIM 3: MESAJI İMZALA =====
                    console.log('✍️ Signing authentication message...')
                    const { signature } = await signMessage(message, authToken)
                    console.log('✅ Message signed successfully')

                    // ===== ADIM 4: İMZAYI DOĞRULA =====
                    console.log('🔍 Verifying signature with server...')
                    const authResult = await verifySignature(walletAddress, signature, nonce)
                    console.log('✅ Signature verified:', {
                        isNewUser: authResult.isNewUser,
                        userId: authResult.user?.id,
                    })

                    // ===== ADIM 5: YENİ KULLANICI İSE PROFIL OLUŞTUR =====
                    let user = authResult.user
                    if (authResult.isNewUser || !user) {
                        console.log('👤 Creating new user account...')
                        const createResult = await createUser(walletAddress)
                        user = createResult.user
                        console.log('✅ New user created:', {
                            userId: user.id,
                            referralCode: user.referral_code,
                        })
                    }

                    // ===== ADIM 6: SUPABASE OTURUMUNU AYARLA =====
                    if (authResult.session?.access_token) {
                        console.log('🔐 Setting Supabase session...')
                        await setSession(
                            authResult.session.access_token,
                            authResult.session.refresh_token
                        )

                        // Token'ları sakla
                        await AsyncStorage.setItem(
                            STORAGE_KEYS.ACCESS_TOKEN,
                            authResult.session.access_token
                        )
                        await AsyncStorage.setItem(
                            STORAGE_KEYS.REFRESH_TOKEN,
                            authResult.session.refresh_token
                        )
                        console.log('✅ Tokens stored securely')
                    }

                    // ===== ADIM 7: STATE'İ GÜNCELLE =====
                    const now = new Date().toISOString()

                    // Önce local state'i hızlı update et (UI responsive olsun)
                    set({
                        isAuthenticated: true,
                        isLoading: false,
                        walletAddress,
                        user: {
                            ...user,
                            last_login_at: now,
                        },
                        accessToken: authResult.session?.access_token || null,
                    })

                    // Sonra DB'yi update et (background)
                    const { data: freshUser } = await supabase
                        .from('users')
                        .update({ last_login_at: now })
                        .eq('id', user.id)
                        .select('*')
                        .single()

                    // DB verisi varsa, state'i güncelle
                    if (freshUser) {
                        set({ user: freshUser })
                    }

                    console.log('🎉 Authentication complete!')

                } catch (error: any) {
                    console.error('❌ Connection failed:', error.message)
                    set({ isLoading: false })
                    throw error
                }
            },

            // ========================================
            // 2. DISCONNECT WALLET
            // ========================================

            /**
             * AMAÇ: Cüzdanı ayır ve logout yap
             * 
             * AKIŞ:
             * 1. Stored auth token'ı al
             * 2. AsyncStorage'dan tüm token'ları sil
             * 3. Supabase oturumundan çık
             * 4. Wallet ile disconnect isteği gönder
             * 5. State'i sıfırla
             * 
             * CLEANUP ÖNEMLİ:
             * - Token'lar silinirse → Kullanıcı logout olur
             * - Wallet disconnected → Yeniden connect gerekecek
             * - State null'a reset → App clean başlar
             * 
             * HATA YÖNETİMİ:
             * - Wallet disconnect fail'ede devam et
             * - Storage clear mutlaka tamamlan
             * - DB'den logout session kaydı yap
             * 
             * KULLANIM:
             * - Logout button tıklandığında
             * - Profile > Settings > Disconnect
             * - App kapatılmak istendiğinde cleanup
             */
            disconnect: async () => {
                try {
                    set({ isLoading: true })

                    console.log('👋 Starting disconnect process...')

                    // Stored auth token'ı al (wallet disconnect'te gerekli)
                    const authToken = await AsyncStorage.getItem(STORAGE_KEYS.WALLET_AUTH_TOKEN)

                    // AsyncStorage'dan tüm token'ları sil
                    await AsyncStorage.multiRemove([
                        STORAGE_KEYS.WALLET_AUTH_TOKEN,
                        STORAGE_KEYS.ACCESS_TOKEN,
                        STORAGE_KEYS.REFRESH_TOKEN,
                        STORAGE_KEYS.WALLET_ADDRESS,
                    ])
                    console.log('✅ Local tokens cleared')

                    // Supabase'ten logout yap
                    await supabase.auth.signOut()
                    console.log('✅ Supabase session ended')

                    // Wallet'tan disconnect et (optional, fail'ede devam)
                    if (authToken) {
                        try {
                            await disconnectWallet(authToken)
                            console.log('✅ Wallet disconnected')
                        } catch (e) {
                            console.log('⚠️ Wallet disconnect skipped')
                        }
                    }

                    // State'i sıfırla
                    set({
                        isAuthenticated: false,
                        isLoading: false,
                        walletAddress: null,
                        user: null,
                        accessToken: null,
                    })

                    console.log('🎉 Disconnect complete!')

                } catch (error: any) {
                    console.error('❌ Disconnect error:', error.message)
                    set({ isLoading: false })
                }
            },

            // ========================================
            // 3. SET USER (PARTIAL UPDATE)
            // ========================================

            /**
             * AMAÇ: Kullanıcı verilerini güncelle (partial merge)
             * 
             * PARAMETRELER:
             * - userData: User | Partial<User>
             *   Tam user obj veya sadece değişecek alanlar
             * 
             * ÖZELLİK:
             * - Mevcut user verilerini korur (merge)
             * - Sadece verilen alanları update eder
             * - DB yazısı YAPMAZ (local only)
             * 
             * ÖRNEK KULLANIM:
             * - updateUsername() sonrası:
             *   setUser({ username: 'newName' })
             * 
             * - Bonus oyun eklendiyse:
             *   setUser({ daily_free_plays_remaining: 5 })
             * 
             * AKIŞ:
             * 1. State'den mevcut user'ı al
             * 2. Spread operator ile merge et
             * 3. Yeni state'i kayıt et
             * 
             * FORMÜL:
             * newUser = { ...oldUser, ...updates }
             */
            setUser: (userData) => {
                set((state) => ({
                    user: state.user
                        ? {
                            ...state.user,
                            ...(typeof userData === 'object' ? userData : {}),
                        }
                        : (userData as User),
                }))
            },

            // ========================================
            // 4. LOAD STORED AUTH
            // ========================================

            /**
             * AMAÇ: Uygulama açılırken kaydedilmiş oturumu geri yükle
             * 
             * KULLANIM:
             * - App.tsx useEffect'te, componentDidMount'a eşdeğer
             * - App başlarken otomatik çalışmalı
             * - SplashScreen'den geçmeden önce
             * 
             * AKIŞ:
             * 1. AsyncStorage'dan token'ları al
             * 2. Token'lar varsa: Supabase'te doğrula
             * 3. Doğru ise: User verilerini DB'den al
             * 4. User bulunursa: State'e set et
             * 5. Daily attempts reset'i kontrol et
             * 6. Başarısızsa: isLoading false, logout state'e
             * 
             * FETCH SÜRECI:
             * 1. ACCESS_TOKEN ve WALLET_ADDRESS al
             * 2. Supabase session check et
             * 3. Session valid ise DB'den user al
             * 4. User varsa, state'e kayıt et
             * 5. last_login_at güncelle
             * 6. Daily attempts reset check et
             * 
             * HATA DURUMLARI:
             * - Token'lar yok → Logout state
             * - Session invalid → Token refresh gerekli
             * - User bulunamadı → DB error
             * - Timestamp check fail → Devam et
             * 
             * TIMING:
             * - ~1 saniye
             * - Network bağlı
             * 
             * KULLANIM ÖRNEĞI:
             * useEffect(() => {
             *   useAuthStore.getState().loadStoredAuth()
             * }, [])
             */
            loadStoredAuth: async () => {
                try {
                    set({ isLoading: true })

                    console.log('🔄 Restoring stored session...')

                    // AsyncStorage'dan token'ları al (parallel)
                    const [accessToken, walletAddress] = await Promise.all([
                        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
                        AsyncStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS),
                    ])

                    if (accessToken && walletAddress) {
                        console.log('✅ Tokens found, verifying session...')

                        // Supabase'te session'ı doğrula
                        const { data: { session }, error } = await supabase.auth.getSession()

                        if (session && !error) {
                            console.log('✅ Session valid')

                            // User verilerini DB'den al
                            const { data: user } = await supabase
                                .from('users')
                                .select('*')
                                .eq('wallet_address', walletAddress)
                                .single()

                            if (user) {
                                const now = new Date().toISOString()

                                // last_login_at güncelle (background)
                                await supabase
                                    .from('users')
                                    .update({ last_login_at: now })
                                    .eq('id', user.id)

                                // State'e kayıt et
                                set({
                                    isAuthenticated: true,
                                    walletAddress,
                                    user: {
                                        ...user,
                                        last_login_at: now,
                                    },
                                    accessToken,
                                    isLoading: false,
                                })

                                console.log('✅ Session restored successfully')

                                // Daily attempts'ı kontrol et
                                await get().checkAndResetDailyAttempts()
                                return
                            }
                        }
                    }

                    console.log('ℹ️ No stored session found')
                    set({ isLoading: false })

                } catch (error) {
                    console.error('❌ Failed to restore session:', error)
                    set({ isLoading: false })
                }
            },

            // ========================================
            // 5. CHECK AND RESET DAILY ATTEMPTS
            // ========================================

            /**
             * AMAÇ: Günlük deneme hakkını sıfırla
             * 
             * MANTIK:
             * Kullanıcı her gün 3 free oyun oynayabilir
             * Gece yarısında (UTC) sıfırlanır
             * 
             * FLOW:
             * 1. Mevcut user'ı al
             * 2. Last login tarihi ile bugünü karşılaştır (UTC)
             * 3. Farklı günler ise:
             *    a. daily_free_plays_remaining = 3
             *    b. last_login_at = şimdi
             *    c. DB'ye yaz
             * 4. Aynı gün ise: Hiç birşey yapma
             * 
             * TARİH KARŞILAŞTIRMASI (ÖNEMLİ):
             * - Saate bakma, sadece günü karşılaştır
             * - UTC kullan (timezone independent)
             * - Format: 'YYYY-MM-DD'
             * 
             * ÖRNEK:
             * - Dün login: 2024-01-15 14:30
             * - Bugün: 2024-01-16 08:00
             * - Farklı gün → Reset
             * 
             * RESET:
             * - daily_free_plays_remaining: 3
             * - bonus_daily_plays: 0 (DB default)
             * - last_login_at: şimdi
             * 
             * HATA TOLERANSI:
             * - DB update fail'ede: Local state'i güncelle yine
             * - Game flow kesintiye uğramasın
             * 
             * KULLANIM:
             * - loadStoredAuth() sonrası otomatik
             * - loadStoredAuth() içinde çağrılır
             * - Tekrar çağrılmamalı (infinite loop risk)
             */
            checkAndResetDailyAttempts: async () => {
                try {
                    const { user } = get()

                    if (!user?.id) {
                        console.log('⚠️ No user, skipping daily reset check')
                        return
                    }

                    const now = new Date()
                    const lastLogin = user.last_login_at ? new Date(user.last_login_at) : null

                    // Tarihleri UTC'de karşılaştır (saat kısmı hariç)
                    const lastLoginDate = lastLogin
                        ? lastLogin.toLocaleDateString('en-CA', { timeZone: 'UTC' })
                        : null
                    const todayDate = now.toLocaleDateString('en-CA', { timeZone: 'UTC' })

                    console.log('📅 Daily reset check:', {
                        lastLogin: lastLoginDate,
                        today: todayDate,
                    })

                    // Farklı günler mi kontrol et
                    if (!lastLoginDate || lastLoginDate !== todayDate) {
                        console.log('🔄 New day detected - resetting free plays...')

                        try {
                            // DB'yi update et
                            const { data: updatedUser, error } = await supabase
                                .from('users')
                                .update({
                                    daily_free_plays_remaining: 3,
                                    last_login_at: now.toISOString(),
                                })
                                .eq('id', user.id)
                                .select('*')
                                .maybeSingle()

                            if (error) {
                                console.error('❌ Database update error:', error)

                                // Hata durumunda bile local state'i güncelle
                                set({
                                    user: {
                                        ...user,
                                        daily_free_plays_remaining: 3,
                                        last_login_at: now.toISOString(),
                                    },
                                })
                                return
                            }

                            // DB güncellemesi başarılı ise, state'i güncelle
                            if (updatedUser) {
                                set({ user: updatedUser })
                            }

                            console.log('✅ Daily free plays reset to 3')

                        } catch (dbError) {
                            console.error('❌ Daily reset database error:', dbError)
                        }

                    } else {
                        console.log('✅ Same day, no reset needed')
                    }

                } catch (error) {
                    console.error('❌ Daily reset check error:', error)
                }
            },

            // ========================================
            // 6. REFRESH USER FROM DATABASE
            // ========================================

            /**
             * AMAÇ: DB'den güncel user verilerini getir
             * 
             * NEDEN GEREKLİ:
             * - Backend'de user state değişti
             * - Local state outdated olabilir
             * - XP, level, plays vb. güncellendiyse
             * 
             * KULLANIM:
             * - Profile ekranına geçildiğinde
             * - Stats gösterilmesi gerektiğinde
             * - Manuel "Refresh" button tıklandığında
             * 
             * AKIŞ:
             * 1. Mevcut user ID'sini al
             * 2. DB'den user verilerini single query ile getir
             * 3. Başarılı ise: State'e kayıt et
             * 4. Başarısız ise: Error log'la, continue
             * 
             * VERI:
             * {
             *   id, username, level, total_xp,
             *   daily_free_plays_remaining,
             *   total_games_played,
             *   lifetime_score,
             *   current_streak, longest_streak
             * }
             * 
             * HATA YÖNETİMİ:
             * - Query fail'ede: Error log, devam
             * - Function throw etmez (non-blocking)
             * 
             * TIMING:
             * - ~500ms
             * - Network bağlı
             */
            refreshUserFromDatabase: async () => {
                try {
                    const { user, walletAddress } = get()

                    if (!walletAddress || !user?.id) {
                        console.log('⚠️ Cannot refresh: missing wallet or user ID')
                        return
                    }

                    console.log('🔄 Refreshing user data from database...')

                    const { data: freshUser, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', user.id)
                        .single()

                    if (error) {
                        console.error('❌ User refresh error:', error)
                        return
                    }

                    if (freshUser) {
                        set({ user: freshUser })
                        console.log('✅ User data refreshed:', {
                            plays: freshUser.daily_free_plays_remaining,
                            bonus: freshUser.bonus_daily_plays,
                            xp: freshUser.total_xp,
                            level: freshUser.level,
                        })
                    }

                } catch (error) {
                    console.error('❌ Refresh user database error:', error)
                }
            },

            // ========================================
            // 7. SYNC USER AFTER GAME END
            // ========================================

            /**
             * AMAÇ: Oyun bittiğinde user state'ini DB ile senkronize et
             * 
             * NEDEN GEREKLİ:
             * - Oyun bittiğinde backend:
             *   a. daily_free_plays_remaining azaltsın (-1)
             *   b. total_xp arttırsın
             *   c. level up kontrol etsin
             * - Local state bu değişiklikleri bilmez
             * - Frontend'de güncel veri göstermek için sync gerekli
             * 
             * AKIŞ:
             * 1. User ID'sini al
             * 2. DB'den fresh user data getir
             * 3. State'e kayıt et
             * 4. Log göster (plays, xp, level)
             * 
             * TIMING:
             * - GameEndScreen'da çalışmalı
             * - navigateToGameResult() öncesi
             * - Veya GameResult komponent mountunda
             * 
             * ÖZELLİK:
             * - Waiting/blocking değil (non-blocking)
             * - Fail etsede game flow devam
             * - Refresh olmazsa manual refresh button kullanabilir
             * 
             * ÖRNEK:
             * await endGame()
             * await syncUserAfterGameEnd()
             * navigate('GameResult')
             * 
             * HATA TOLERANSI:
             * - maybeSingle() kullan (null ok)
             * - Error'da throw etme
             * - Log'la, devam et
             */
            syncUserAfterGameEnd: async () => {
                try {
                    const { user } = get()

                    if (!user?.id) {
                        console.log('⚠️ Cannot sync: no user')
                        return
                    }

                    console.log('🎮 Game ended - syncing user data...')

                    // DB'den güncel user verisi getir
                    const { data: freshUser, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', user.id)
                        .maybeSingle()

                    if (error) {
                        console.error('❌ Sync error:', error)
                        return
                    }

                    if (freshUser) {
                        // State'e kayıt et
                        set({ user: freshUser })
                        console.log('✅ User synced after game:', {
                            plays: freshUser.daily_free_plays_remaining,
                            xp: freshUser.total_xp,
                            level: freshUser.level,
                        })
                    } else {
                        console.warn('⚠️ Fresh user data not found')
                    }

                } catch (error: any) {
                    console.error('❌ Sync after game error:', error.message)
                    // Continue, don't break game flow
                }
            },
        }),

        // ========================================
        // PERSIST MIDDLEWARE CONFIGURATION
        // ========================================

        {
            /**
             * PERSIST YAPISI
             * 
             * AMAÇ: State'i AsyncStorage'da depolayıp, app yeniden açılırken geri yükle
             * 
             * name: 'auth-store'
             * - AsyncStorage key'i
             * - Tüm persisted state bu key'in altında JSON olarak depolanır
             * 
             * storage: createJSONStorage(() => AsyncStorage)
             * - Storage engine belirt
             * - React Native: AsyncStorage
             * - Web: localStorage
             * 
             * partialize: (state) => ({ ... })
             * - Depolanacak state'leri seç
             * 
             * ✅ DEPOLANAN:
             * - walletAddress: Kullılmak gerekebilir
             * - user: Profil bilgisi
             * - isAuthenticated: Auth state
             * - accessToken: Token'ı sakla
             * 
             * ❌ DEPOLANMAYAN:
             * - isLoading: Transient state (her açılışta false)
             * - Error states: Işlemle gelen temp state
             * 
             * HYDRATION:
             * - App çalışırken persist middleware otomatik yükler
             * - loadStoredAuth() ile ek verification yapılır
             * 
             * RESET:
             * - Disconnect saat: AsyncStorage.removeItem() ile sil
             * - Persist otomatik cleanup yapacak
             */
            name: 'auth-store',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                walletAddress: state.walletAddress,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
                accessToken: state.accessToken,
            }),
        }
    )
)