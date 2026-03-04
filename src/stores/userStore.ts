import { create } from 'zustand'
import * as api from '../services/api'
import { supabase } from '../services/supabase'
import { GamePackage, LeaderboardEntry, User, UserPackage } from '../types'

// ============================================
// TİP TANIMLARI
// ============================================

/**
 * USER STORE ARAYÜZÜ
 * 
 * DURUM (State):
 * - profile: Kullanıcı profili, global ranking ve satın alınan paketler
 * - stats: Kullanıcı istatistikleri (toplam puan, streak, vb.)
 * - leaderboard: Liderlik tablosu (global, daily, weekly)
 * - packages: Satılık oyun paketleri
 * - userPackages: Kullanıcının satın aldığı paketler
 * - isLoading: Veri yükleme durumu
 * 
 * İŞLEMLER (Actions):
 * - fetchProfile: Kullanıcı profilini getir
 * - fetchStats: İstatistikleri getir
 * - fetchLeaderboard: Liderlik tablosunu getir
 * - updateUsername: Kullanıcı adını güncelle
 * - fetchGamePackages: Satılık paketleri getir
 * - fetchUserPackages: Satın alınan paketleri getir
 * - purchaseGamePackage: Paket satın al
 */
interface UserStore {
    // ===== DURUM (STATE) =====
    
    /**
     * Kullanıcı Profili
     * İçerir: username, level, xp, avatar, globalRank
     * packages: Satın alınan oyun paketleri
     */
    profile: (User & {
        globalRank: number
        packages?: GamePackage[]
    }) | null

    /**
     * Kullanıcı İstatistikleri
     * totalScore, totalGamesPlayed, currentStreak, longestStreak
     */
    stats: any | null

    /**
     * Liderlik Tablosu
     * Kullanıcıların puanlarına göre sıralanmış liste
     */
    leaderboard: LeaderboardEntry[]

    /**
     * Satılık Oyun Paketleri
     * Tüm kullanıcılara sunulan paketler (10 oyun, 20 oyun, vb.)
     */
    packages: GamePackage[]

    /**
     * Kullanıcının Satın Aldığı Paketler
     * Kalan oyun sayısı, sona erme tarihi, vb. bilgiler
     */
    userPackages: UserPackage[]

    /**
     * Yükleme Durumu
     * API çağrıları sırasında true, tamamlandığında false
     */
    isLoading: boolean

    // ===== İŞLEMLER (ACTIONS) =====
    fetchProfile: (walletAddress?: string) => Promise<void>
    fetchStats: () => Promise<void>
    fetchLeaderboard: (type?: 'global' | 'daily' | 'weekly') => Promise<void>
    updateUsername: (username: string) => Promise<void>
    fetchGamePackages: () => Promise<void>
    fetchUserPackages: () => Promise<void>
    purchaseGamePackage: (packageId: number, txSignature: string) => Promise<any>
}

// ============================================
// ZUSTAND STORE OLUŞTURMA
// ============================================

/**
 * USER STORE
 * 
 * Global state management for user-related data
 * Zustand kullanılır: Minimal boilerplate, fast updates
 */
export const useUserStore = create<UserStore>((set, get) => ({
    // ========================================
    // BAŞLANGIÇ DURUMU (INITIAL STATE)
    // ========================================

    /**
     * Uygulamaya ilk çalışması durumun başlangıç değerleri
     * Null/empty olarak başlar, action'lar aracılığıyla doldurulur
     */
    profile: null,
    stats: null,
    leaderboard: [],
    packages: [],
    userPackages: [],
    isLoading: false,

    // ========================================
    // 1. FETCH PROFILE
    // ========================================

    /**
     * AMAÇ: Kullanıcı profilini API'den getir
     * 
     * PARAMETRELER:
     * - walletAddress (opsiyonel): Belirli cüzdan adresinin profili
     *   Boş bırakılırsa: Giriş yapan kullanıcının profili
     * 
     * AKIŞ:
     * 1. Loading state'ini true'ya ayarla
     * 2. API'den profil verisi getir
     * 3. Verileri parse et ve log'la (debug için)
     * 4. Profile'ın içine packages'ı ekle
     * 5. State'e kaydet
     * 6. Loading state'ini false'a ayarla
     * 
     * VERİ YAPISI:
     * {
     *   profile: {
     *     id, username, level, xp, avatar, globalRank
     *   },
     *   packages: [
     *     { id, name, game_count, ... }
     *   ]
     * }
     * 
     * HATA YÖNETİMİ:
     * - API başarısız olursa: Error log'la, loading false'a ayarla
     * - Devam et (graceful error handling)
     */
    fetchProfile: async (walletAddress?: string) => {
        try {
            set({ isLoading: true })

            // API'den profil verisi getir
            const response = await api.getProfile(walletAddress)

            console.log('📊 Profile API Response:', {
                username: response.profile?.username,
                level: response.profile?.level,
                packagesCount: response.packages?.length || 0,
            })

            // Profile'ın içine packages'ı ekle
            // Bunun nedeni: UI'de paketler profile ile beraber gösterilir
            const profileWithPackages = {
                ...response.profile,
                packages: response.packages || [],
            }

            // State'e kaydet
            set({
                profile: profileWithPackages,
                isLoading: false,
            })

            console.log('✅ Profile loaded successfully:', {
                username: response.profile.username,
                level: response.profile.level,
                packagesCount: response.packages?.length || 0,
            })

        } catch (error) {
            console.error('❌ Failed to load profile:', error)
            set({ isLoading: false })
        }
    },

    // ========================================
    // 2. FETCH STATS
    // ========================================

    /**
     * AMAÇ: Kullanıcı istatistiklerini getir
     * 
     * İSTATİSTİKLER:
     * - totalScore: Tüm oyunlarda toplam puan
     * - totalGamesPlayed: Oynanan toplam oyun sayısı
     * - currentStreak: Şu andaki doğru cevap serisi
     * - longestStreak: En uzun doğru cevap serisi
     * - accuracyRate: Doğru cevap yüzdesi
     * 
     * KULLANIM:
     * Stats sayfasında, kullanıcının performans verilerini göster
     * 
     * HATA YÖNETİMİ:
     * - Başarısız olursa: Error log'la
     */
    fetchStats: async () => {
        try {
            set({ isLoading: true })
            const data = await api.getStats()
            set({ stats: data, isLoading: false })
            console.log('✅ Statistics loaded')
        } catch (error) {
            console.error('❌ Failed to load statistics:', error)
            set({ isLoading: false })
        }
    },

    // ========================================
    // 3. FETCH LEADERBOARD
    // ========================================

    /**
     * AMAÇ: Liderlik tablosunu getir
     * 
     * PARAMETRELER:
     * - type: 'global' | 'daily' | 'weekly'
     *   global: Tüm zamanın en iyi oyuncuları
     *   daily: Bugünün en iyi oyuncuları
     *   weekly: Bu haftanın en iyi oyuncuları
     * 
     * VERİ:
     * - rank: Sıralaması
     * - username: Kullanıcı adı
     * - score: Puanı
     * - avatar: Profil resmi
     * - level: Seviyesi
     * 
     * KULLANIM:
     * Leaderboard ekranında göster
     * 
     * HATA YÖNETİMİ:
     * - Başarısız olursa: Boş liste göster
     */
    fetchLeaderboard: async (type = 'global') => {
        try {
            set({ isLoading: true })
            const data = await api.getLeaderboard(type)
            set({ leaderboard: data.leaderboard, isLoading: false })
            console.log(`✅ Leaderboard loaded (${type})`)
        } catch (error) {
            console.error(`❌ Failed to load leaderboard (${type}):`, error)
            set({ isLoading: false })
        }
    },

    // ========================================
    // 4. UPDATE USERNAME
    // ========================================

    /**
     * AMAÇ: Kullanıcı adını güncelle
     * 
     * PARAMETRELER:
     * - username: Yeni kullanıcı adı
     * 
     * AKIŞ:
     * 1. Loading state'ini true'ya ayarla
     * 2. API'ye username güncelleme isteği gönder
     * 3. Başarılı olursa: Profil verilerini yenile
     * 4. Loading state'ini false'a ayarla
     * 5. Başarısız olursa: Error fırlat (caller'ı error handle etsin)
     * 
     * HATA YÖNETİMİ:
     * - Error'ı throw et (caller'ın try-catch'i işlesin)
     * - Loading state'ini false'a ayarla
     * 
     * ÖRNEK KULLANIM:
     * try {
     *   await useUserStore.getState().updateUsername('newName')
     * } catch (error) {
     *   Alert.alert('Error', 'Failed to update username')
     * }
     */
    updateUsername: async (username: string) => {
        try {
            set({ isLoading: true })
            await api.updateProfile(username)
            
            // Username başarılı güncellendikten sonra profil verilerini yenile
            await get().fetchProfile()
            set({ isLoading: false })
            
            console.log(`✅ Username updated to: ${username}`)
        } catch (error) {
            console.error('❌ Failed to update username:', error)
            set({ isLoading: false })
            throw error // Caller'ın hata işlemesini sağla
        }
    },

    // ========================================
    // 5. FETCH GAME PACKAGES (YENİ)
    // ========================================

    /**
     * AMAÇ: Satılık oyun paketlerini Supabase'ten getir
     * 
     * PAKET TÜRLERI:
     * - Starter: 10 oyun
     * - Standard: 25 oyun
     * - Premium: 50 oyun
     * - Elite: 100 oyun
     * 
     * VERİ:
     * - id, code, name, description
     * - game_count: Kaç oyun içeriyor
     * - price_sol: Fiyat (Solana)
     * - base_multiplier: Puan çarpanı
     * - display_order: UI'de gösterim sırası
     * 
     * SORGU DETAYLARı:
     * - SELECT: Tüm sütunları getir
     * - WHERE: Sadece aktif paketler
     * - ORDER BY: display_order'a göre sırala (A→Z)
     * 
     * KULLANIM:
     * - App başlarken bir kez çağrıl
     * - Packages ekranında paketleri göster
     * 
     * HATA YÖNETİMİ:
     * - Başarısız olursa: Boş liste, error log'la
     */
    fetchGamePackages: async () => {
        try {
            console.log('📦 Fetching available game packages...')

            const { data, error } = await supabase
                .from('game_packages')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true })

            if (error) {
                throw error
            }

            set({ packages: data || [] })
            console.log(`✅ Game packages loaded: ${data?.length} packages`)
        } catch (error) {
            console.error('❌ Failed to load game packages:', error)
            set({ packages: [] })
        }
    },

    // ========================================
    // 6. FETCH USER PACKAGES (YENİ)
    // ========================================

    /**
     * AMAÇ: Kullanıcının satın aldığı paketleri getir
     * 
     * VERİ:
     * - id: Package ID
     * - games_remaining: Kalan oyun sayısı
     * - games_total: Toplam oyun sayısı
     * - games_used: Kullanılan oyun sayısı
     * - is_active: Paket hala aktif mi
     * - purchased_at: Satın alım tarihi
     * - depleted_at: Bitme tarihi (null = hala aktif)
     * - tx_signature: Blockchain işlem imzası
     * - game_packages: Paket bilgileri (nested)
     * 
     * SORGU:
     * - SELECT: Tüm sütunları ve nested game_packages'ı getir
     * - WHERE: Sadece aktif paketler
     * - ORDER BY: En yeni satın alımlar önce
     * 
     * VERİ DÖNÜŞÜMÜ (ÖNEMLİ):
     * Supabase nested select'te array döndürebilir
     * Bunun nedeni: One-to-many ilişki
     * Çözüm: Array[0]'ı al, objeye dönüştür
     * 
     * ÖRNEK (API RESPONSE):
     * {
     *   id: 1,
     *   games_remaining: 5,
     *   game_packages: [
     *     { id: 1, name: "Starter", game_count: 10 }
     *   ]
     * }
     * 
     * DÖNÜŞÜM SONRASI:
     * {
     *   id: 1,
     *   games_remaining: 5,
     *   game_packages: { id: 1, name: "Starter", game_count: 10 }
     * }
     * 
     * KULLANIM:
     * - Profile ekranında aktif paketleri göster
     * - "5 Games Remaining" mesajı göster
     */
    fetchUserPackages: async () => {
        try {
            console.log('📦 Fetching your purchased packages...')

            const { data, error } = await supabase
                .from('user_packages')
                .select(`
                    id,
                    user_id,
                    games_remaining,
                    games_total,
                    games_used,
                    purchased_at,
                    is_active,
                    depleted_at,
                    tx_signature,
                    game_packages(
                        id,
                        code,
                        name,
                        description,
                        game_count,
                        price_sol,
                        base_multiplier,
                        bonus_games,
                        is_active,
                        display_order,
                        created_at,
                        updated_at
                    )
                `)
                .eq('is_active', true)
                .order('purchased_at', { ascending: false })

            if (error) {
                throw error
            }

            console.log('📊 Raw API Response:', data)

            // VERİ DÖNÜŞÜMÜ: Nested array'i objeye dönüştür
            const transformedData = data?.map((item: any) => ({
                ...item,
                game_packages: Array.isArray(item.game_packages)
                    ? item.game_packages[0] // Dizi ise ilk elemanı al
                    : item.game_packages,   // Değilse direkt kullan
            })) as UserPackage[]

            set({ userPackages: transformedData || [] })
            console.log(`✅ User packages loaded: ${transformedData?.length} packages`)
        } catch (error) {
            console.error('❌ Failed to load user packages:', error)
            set({ userPackages: [] })
        }
    },

    // ========================================
    // 7. PURCHASE GAME PACKAGE (YENİ)
    // ========================================

    /**
     * AMAÇ: Oyun paketi satın al
     * 
     * PARAMETRELER:
     * - packageId: Satın alınacak paketin ID'si
     * - txSignature: Blockchain işlem imzası (Solana transfer tamamlandıktan sonra)
     * 
     * AKIŞ:
     * 1. Loading state'ini true'ya ayarla
     * 2. Supabase Cloud Function'ı çağır
     * 3. Function'da:
     *    a. Blockchain işlemini doğrula
     *    b. Veritabanında user_package kaydı oluştur
     *    c. Başarı/başarısızlık return et
     * 4. Başarılı olursa:
     *    a. User packages'ı yenile
     *    b. Profile'ı yenile (level up olmuş olabilir)
     *    c. Success message göster
     * 5. Loading state'ini false'a ayarla
     * 6. Data return et
     * 
     * BLOCKCHAIN VERİFİKASYON:
     * - txSignature: Solana blockchain'deki işlem kimliği
     * - Function bu işlemi doğrular
     * - Eğer geçersizse: Error fırlat
     * 
     * HATA DURUMLARI:
     * - Network hatası
     * - İşlem başarısız (yetersiz bakiye)
     * - İşlem doğrulanamadı (geçersiz signature)
     * 
     * ÖRNEK KULLANIM:
     * try {
     *   const result = await useUserStore.getState().purchaseGamePackage(1, 'sig123')
     *   Alert.alert('Success', 'Package purchased!')
     * } catch (error) {
     *   Alert.alert('Error', 'Purchase failed: ' + error.message)
     * }
     */
    purchaseGamePackage: async (packageId: number, txSignature: string) => {
        try {
            console.log('💳 Purchasing game package:', { packageId, txSignature })
            set({ isLoading: true })

            // Supabase Edge Function'ı çağır
            // Function: Blockchain doğrulaması + DB işlemi
            const { data, error } = await supabase.functions.invoke('purchase-package', {
                body: {
                    packageId,
                    txSignature,
                },
            })

            console.log('📡 Purchase API Response:', { data, error })

            if (error) {
                console.error('❌ Purchase function error:', error)
                throw error
            }

            console.log('✅ Purchase successful:', data)

            // Başarılı olduktan sonra veriler güncelle
            // Kullanıcı yeni bir paket aldığı için:
            // 1. User packages listesi güncelle
            // 2. Bonus oyunlardan dolayı level up olmuş olabilir → Profile güncelle
            await get().fetchUserPackages()
            await get().fetchProfile()

            set({ isLoading: false })
            return data

        } catch (error: any) {
            console.error('❌ Package purchase failed:', error.message)
            set({ isLoading: false })
            throw error // Caller'ın hata işlemesini sağla
        }
    },
}))