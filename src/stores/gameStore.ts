import { create } from 'zustand'
import * as api from '../services/api'
import { AnswerRecord, GameResult, GameSession, Question } from '../types'

// ============================================
// TİP TANIMLARI
// ============================================

/**
 * GAME STORE ARAYÜZÜ
 * 
 * Oyun oturumu sırasında tüm oyun state'ini yönetir
 * Soruları, cevapları, sonuçları ve oyun akışını kontrol eder
 * 
 * DURUM (State):
 * - session: Mevcut oyun oturumunun tüm verileri
 * - currentQuestion: Şu an gösterilen soru
 * - questionStartTime: Sorunun başlama zamanı (timer için)
 * - isPlaying: Oyun devam ediyor mu
 * - isLoading: API çağrısı sırasında loading
 * - result: Oyun sonlandırıldığında sonuç verisi
 * - categoryId: Seçilen kategori ID'si
 * - categoryName: Seçilen kategori adı
 * - lastAnswerResult: Son verilen cevabın sonucu (feedback için)
 * 
 * İŞLEMLER (Actions):
 * - startGame: Yeni oyun başlat
 * - selectAnswer: Cevap seç
 * - nextQuestion: Sonraki soruya geç
 * - endGame: Oyunu bitir
 * - timeOut: Zaman aşımı (cevapsız cevap)
 * - resetGame: Oyun state'ini sıfırla
 */
interface GameStore {
    // ===== DURUM (STATE) =====

    /**
     * Oyun Oturumu
     * İçerir: Competition ID, Entry ID, Sorular, Cevaplar, Başlama zamanı
     * 
     * Yapısı:
     * {
     *   competitionId: string,
     *   entryId: string,
     *   playType: 'free' | 'package',
     *   categoryId: string,
     *   questions: Question[],
     *   currentQuestionIndex: number,
     *   answers: AnswerRecord[],
     *   startTime: number
     * }
     */
    session: GameSession | null

    /**
     * Mevcut Soru
     * Ekranda gösterilen soru
     * 
     * İçerir: id, text, options[], timeLimit, order
     */
    currentQuestion: Question | null

    /**
     * Soru Başlama Zamanı (milisaniye)
     * Cevaba harcanan süreyi hesaplamak için kullanılır
     * Formül: Date.now() - questionStartTime = answerTimeMs
     */
    questionStartTime: number

    /**
     * Oyun Devam Ediyor Mu
     * true: Oyun aktif, sorular gösteriliyor
     * false: Oyun bitmişor, loading, vb.
     */
    isPlaying: boolean

    /**
     * Yükleme Durumu
     * true: API çağrısı devam ediyor
     * false: İşlem tamamlandı
     * 
     * Şu durumlarda true:
     * - startGame API çağrısı
     * - selectAnswer API çağrısı
     * - endGame API çağrısı
     */
    isLoading: boolean

    /**
     * Oyun Sonuç Verisi
     * Oyun tamamlandığında API'den dönen sonuç
     * 
     * İçerir:
     * - sessionScore: Toplam puan
     * - correctCount: Doğru cevaplar
     * - xpGain: Kazanılan XP
     * - levelUp: Level atladı mı
     * - newLevel: Yeni level
     * - currentStreak: Mevcut seri
     * - longestStreak: En uzun seri
     * - newAchievements: Yeni başarılar
     */
    result: GameResult | null

    /**
     * Seçilen Kategori ID'si
     * Oyun başlatıldığında set edilir
     * Kategori listesi almak için kullanılır
     * 
     * Örn: 'cat_001' (Genel Kültür)
     */
    categoryId: string | null

    /**
     * Seçilen Kategori Adı
     * UI'de başlıkta gösterilir
     * 
     * Örn: 'General Knowledge'
     */
    categoryName: string | null

    /**
     * Son Cevabın Sonucu (Feedback)
     * Cevap verdikten sonra gösterilen feedback bilgisi
     * 
     * İçerir:
     * - isCorrect: Doğru mu yanlış mı
     * - score: Kazanılan puan
     * - correctOptionId: Doğru cevabın ID'si
     */
    lastAnswerResult: {
        isCorrect: boolean
        score: number
        correctOptionId: number
    } | null

    // ===== İŞLEMLER (ACTIONS) =====
    startGame: (gameMode: 'free' | 'package', categoryId: string) => Promise<void>
    selectAnswer: (optionId: number | null) => Promise<any>
    nextQuestion: () => void
    endGame: () => Promise<void>
    timeOut: () => Promise<void>
    resetGame: () => void
}

// ============================================
// ZUSTAND STORE OLUŞTURMA
// ============================================

/**
 * GAME STORE
 * 
 * Oyun oturumunun tüm state'ini merkezi olarak yönetir
 * Zustand: Minimal boilerplate, performant updates
 */
export const useGameStore = create<GameStore>((set, get) => ({
    // ========================================
    // BAŞLANGIÇ DURUMU (INITIAL STATE)
    // ========================================

    /**
     * Oyun başlamadan önceki başlangıç durumu
     * Tüm state'ler null/false/empty olarak başlar
     * Action'lar aracılığıyla doldurulur
     */
    session: null,
    currentQuestion: null,
    questionStartTime: 0,
    isPlaying: false,
    isLoading: false,
    result: null,
    categoryId: null,
    categoryName: null,
    lastAnswerResult: null,

    // ========================================
    // 1. START GAME
    // ========================================

    /**
     * AMAÇ: Yeni oyun oturumu başlat
     * 
     * PARAMETRELER:
     * - gameMode: 'free' | 'package'
     *   'free': Sınırsız oyun (reklam gösterilir)
     *   'package': Satın alınan paket oyunları
     * 
     * - categoryId: Seçilen kategori ID'si
     *   Örn: 'cat_001' (Genel Kültür)
     *   Örn: 'cat_002' (Bilim)
     *   Örn: 'cat_003' (Tarih)
     * 
     * AKIŞ:
     * 1. Mevcut oyun verilerini temizle
     * 2. Loading state'ini true'ya ayarla
     * 3. API'ye oyun başlatma isteği gönder (gameMode + categoryId)
     * 4. 10 soru ve metadata getirilir
     * 5. GameSession objesi oluştur
     * 6. State'e kaydet (session, currentQuestion, category bilgileri)
     * 7. isPlaying = true'ya ayarla
     * 8. Loading state'ini false'a ayarla
     * 
     * API RESPONSE (gameData):
     * {
     *   competitionId: 'comp_123',
     *   entryId: 'entry_456',      // ← Tüm sonraki çağrılar için gerekli
     *   playType: 'free' | 'package',
     *   categoryId: 'cat_001',
     *   categoryName: 'General Knowledge',
     *   questions: [
     *     { questionId, text, options, timeLimit, order }
     *   ]
     * }
     * 
     * GAME SESSION YAPISI:
     * {
     *   competitionId: Rekabet kimliği
     *   entryId: Oyun oturumu kimliği (kritik)
     *   playType: Oyun türü
     *   categoryId: Kategori
     *   questions: 10 soru
     *   currentQuestionIndex: 0 (ilk soruda başla)
     *   answers: [] (henüz cevap yok)
     *   startTime: Oyun başlama zamanı
     * }
     * 
     * HATA YÖNETİMİ:
     * - API başarısız olursa: Error log'la, throw et
     * - Loading state'i false'a ayarla
     * - Caller'ın hata göstermesini sağla
     * 
     * KULLANIM:
     * - Kategori seçildikten sonra "Play" butonuna tıklama
     * - Oyun ekranına geçmeden önce
     * 
     * ÖRNEK:
     * try {
     *   await useGameStore.getState().startGame('free', 'cat_001')
     *   // Oyun ekranına git
     * } catch (error) {
     *   Alert.alert('Error', 'Failed to start game')
     * }
     */
    startGame: async (gameMode = 'free', categoryId: string) => {
        try {
            set({ isLoading: true, result: null, lastAnswerResult: null })

            // API'ye oyun başlatma isteği
            const gameData = await api.startGame(gameMode, categoryId)

            console.log('🎮 Game started successfully:', {
                categoryId: gameData.categoryId,
                categoryName: gameData.categoryName,
                questionsCount: gameData.questions.length,
                entryId: gameData.entryId,
                gameMode: gameData.playType,
            })

            // GameSession objesi oluştur
            const session: GameSession = {
                competitionId: gameData.competitionId,
                entryId: gameData.entryId,
                playType: gameData.playType,
                categoryId: gameData.categoryId,
                questions: gameData.questions,
                currentQuestionIndex: 0,
                answers: [],
                startTime: Date.now(),
            }

            // State'e kaydet
            set({
                session,
                currentQuestion: session.questions[0],
                questionStartTime: Date.now(),
                isPlaying: true,
                isLoading: false,
                categoryId: gameData.categoryId,
                categoryName: gameData.categoryName,
            })
        } catch (error) {
            console.error('❌ Failed to start game:', error)
            set({ isLoading: false })
            throw error
        }
    },

    // ========================================
    // 2. SELECT ANSWER
    // ========================================

    /**
     * AMAÇ: Kullanıcının seçtiği cevapı işle
     * 
     * PARAMETRELER:
     * - optionId: Seçilen seçenek ID'si
     *   null: Cevap verilmedi (zaman aşımı)
     *   1-4: Seçenek ID'si
     * 
     * AKIŞ:
     * 1. Session ve currentQuestion'ı al
     * 2. Cevaba harcanan zamanı hesapla
     *    answerTimeMs = Date.now() - questionStartTime
     * 3. Loading state'ini true'ya ayarla
     * 4. API'ye cevabı gönder (entryId, questionId, optionId, timeMs)
     * 5. API doğru/yanlış kontrol eder, puan hesaplar
     * 6. AnswerRecord oluştur (sonraki soru için)
     * 7. Answers array'ine ekle
     * 8. lastAnswerResult set et (feedback göster)
     * 9. Loading state'ini false'a ayarla
     * 10. Response return et
     * 
     * API RESPONSE:
     * {
     *   isCorrect: boolean,
     *   questionScore: number,     // 0-100 arası
     *   correctOption: { id: 2 }   // Doğru cevap
     * }
     * 
     * ANSWER RECORD YAPISI:
     * {
     *   questionId: Soru ID'si,
     *   questionOrder: 1-10 (sıra),
     *   selectedOptionId: 2 (null ise cevapsız),
     *   answerTimeMs: 5000 (5 saniye),
     *   isCorrect: true,
     *   score: 85 (kazanılan puan)
     * }
     * 
     * PUAN HESAPLAMA (Server-side):
     * - Doğru ise: timeLimit - answerTimeMs = score
     * - Yanlış ise: 0 puan
     * - Bonus: baseMultiplier * bonus
     * 
     * KULLANIM:
     * - Kullanıcı OptionButton'a tıklar
     * - Timer durdurulur (isPaused = true)
     * - Feedback gösterilir (2 saniye)
     * - "Next Question" butonuna tıklandığında nextQuestion()
     * 
     * HATA YÖNETİMİ:
     * - API başarısız olursa: Error log'la, throw et
     * - Loading state'i false'a ayarla
     */
    selectAnswer: async (optionId: number | null) => {
        const { session, currentQuestion, questionStartTime } = get()

        if (!session || !currentQuestion) {
            console.warn('⚠️ No active session or question')
            return null
        }

        // Cevapa harcanan zamanı hesapla
        const answerTimeMs = Date.now() - questionStartTime

        try {
            set({ isLoading: true })

            // API'ye cevabı gönder
            const response = await api.submitAnswer(
                session.entryId,
                currentQuestion.questionId,
                currentQuestion.order,
                optionId,
                answerTimeMs
            )

            console.log('📝 Answer submitted:', {
                questionOrder: currentQuestion.order,
                selected: optionId,
                isCorrect: response.isCorrect,
                score: response.questionScore,
                timeMs: answerTimeMs,
            })

            // AnswerRecord oluştur
            const answerRecord: AnswerRecord = {
                questionId: currentQuestion.questionId,
                questionOrder: currentQuestion.order,
                selectedOptionId: optionId,
                answerTimeMs,
                isCorrect: response.isCorrect,
                score: response.questionScore,
            }

            // Answers array'ine ekle
            const updatedAnswers = [...session.answers, answerRecord]

            // State güncelle
            set({
                session: {
                    ...session,
                    answers: updatedAnswers,
                },
                lastAnswerResult: {
                    isCorrect: response.isCorrect,
                    score: response.questionScore,
                    correctOptionId: response.correctOption.id,
                },
                isLoading: false,
            })

            return response

        } catch (error) {
            console.error('❌ Failed to submit answer:', error)
            set({ isLoading: false })
            throw error
        }
    },

    // ========================================
    // 3. TIME OUT
    // ========================================

    /**
     * AMAÇ: Zaman aşımı durumunu işle
     * 
     * PARAMETRELER: Yok
     * 
     * AKIŞ:
     * 1. selectAnswer(null) çağır
     * 2. null → "no answer" anlamı
     * 3. API puan vermez (isCorrect = false, score = 0)
     * 4. lastAnswerResult set edilir (❌ feedback gösterilir)
     * 
     * KULLANIM:
     * - Timer countdownu 0 ulaştığında
     * - Timer komponenti handleTimeUp() çağırır
     * - timeOut() otomatik olarak selectAnswer(null) çağırır
     * 
     * FEEDBACK:
     * Ekranda "❌ Wrong" ve "+0 points" gösterilir
     */
    timeOut: async () => {
        console.log('⏰ Time expired - submitting null answer')
        await get().selectAnswer(null)
    },

    // ========================================
    // 4. NEXT QUESTION
    // ========================================

    /**
     * AMAÇ: Sonraki soruya geç
     * 
     * PARAMETRELER: Yok
     * 
     * AKIŞ:
     * 1. Mevcut session'ı al
     * 2. currentQuestionIndex'i 1 arttır
     * 3. Eğer tüm sorular bittiyse:
     *    a. endGame() çağır
     *    b. Dön
     * 4. Değilse:
     *    a. Session'ı güncelle
     *    b. Sonraki soruyu set et
     *    c. Yeni soru başlama zamanı set et (timer resetleme için)
     *    d. lastAnswerResult'ı temizle (feedback'i kaldır)
     * 
     * AKIŞ ÖRNEĞİ:
     * Soru 1 → [Next clicked] → Soru 2 → ... → Soru 10 → endGame()
     * 
     * TIMING:
     * - Feedback gösterilir (2 saniye)
     * - "Next Question" butonuna tıklandığında bu çalışır
     * - Yeni Timer hemen başlar
     * 
     * KULLANIM:
     * - Feedback gösterildikten sonra "Next" butonuna tıkla
     * - Soru 10'da tıklanırsa endGame() çalışır otomatik
     */
    nextQuestion: () => {
        const { session } = get()

        if (!session) {
            console.warn('⚠️ No active session')
            return
        }

        const nextIndex = session.currentQuestionIndex + 1

        // Son soru mu kontrol et
        if (nextIndex >= session.questions.length) {
            console.log('🏁 Last question reached - ending game')
            get().endGame()
            return
        }

        console.log(`➜ Moving to question ${nextIndex + 1} of 10`)

        // State güncelle
        set({
            session: {
                ...session,
                currentQuestionIndex: nextIndex,
            },
            currentQuestion: session.questions[nextIndex],
            questionStartTime: Date.now(), // Timer'ı resetle
            lastAnswerResult: null,        // Feedback'i kaldır
        })
    },

    // ========================================
    // 5. END GAME
    // ========================================

    /**
     * AMAÇ: Oyunu tamamla ve sonuçları getir
     * 
     * PARAMETRELER: Yok
     * 
     * AKIŞ:
     * 1. Session'ı al
     * 2. isPlaying = false'a ayarla
     * 3. Loading state'ini true'ya ayarla
     * 4. API'ye oyun tamamlama isteği gönder (entryId)
     * 5. API:
     *    a. Tüm cevapları puanla
     *    b. Toplam puan hesapla
     *    c. XP kazancı hesapla
     *    d. Level atladı mı kontrol et
     *    e. Yeni başarılar kontrol et
     * 6. Result verisi return et
     * 7. Result state'e kaydet
     * 8. Loading state'ini false'a ayarla
     * 
     * API RESPONSE (result):
     * {
     *   sessionScore: 850,          // Toplam puan
     *   correctCount: 8,            // Doğru cevaplar
     *   xpGain: 425,               // Kazanılan XP
     *   levelUp: true,             // Level atladı mı
     *   newLevel: 5,               // Yeni level
     *   totalXp: 2425,             // Toplam XP (cumulative)
     *   currentStreak: 3,          // Mevcut seri
     *   longestStreak: 5,          // En uzun seri
     *   newAchievements: [         // Yeni başarılar
     *     { id, name, emoji, description }
     *   ]
     * }
     * 
     * PUAN ÖRNEĞI:
     * Soru 1: 10s limit, 5s'de cevapla → 50 puan
     * Soru 2: 10s limit, yanlış → 0 puan
     * Soru 3: 10s limit, 2s'de cevapla → 80 puan
     * ...
     * Total: 850 puan
     * XP: 850 / 2 = 425 XP
     * 
     * KULLANIM:
     * - Soru 10'da "Next Question" tıklandığında otomatik
     * - Veya nextQuestion() içinde manual çağrılır
     * - GameResultScreen'a navigasyondan önce çalışmalı
     * 
     * HATA YÖNETİMİ:
     * - API başarısız olursa: Error log'la, throw et
     * - Loading state'i false'a ayarla
     * - User tekrar denesin veya Home'a dönüş
     */
    endGame: async () => {
        const { session } = get()

        if (!session) {
            console.warn('⚠️ No active session to end')
            return
        }

        try {
            set({ isLoading: true, isPlaying: false })

            console.log('🏁 Ending game - submitting results...')

            // API'ye oyun tamamlama isteği
            const result = await api.completeGame(session.entryId)

            console.log('✅ Game completed successfully:', {
                sessionScore: result.sessionScore,
                correctCount: result.correctCount,
                xpGain: result.xpGain,
                levelUp: result.levelUp,
                newLevel: result.newLevel,
                achievementsCount: result.newAchievements.length,
            })

            // Result state'e kaydet
            set({
                result,
                isLoading: false,
            })

        } catch (error) {
            console.error('❌ Failed to end game:', error)
            set({ isLoading: false })
            throw error
        }
    },

    // ========================================
    // 6. RESET GAME
    // ========================================

    /**
     * AMAÇ: Oyun state'ini sıfırla
     * 
     * PARAMETRELER: Yok
     * 
     * AKIŞ:
     * Tüm oyun state'lerini başlangıç değerlerine döndür
     * 
     * NE ZAMAN ÇALIŞIR:
     * 1. Oyun bittikten sonra "Play Again" butonuna tıklandığında
     * 2. "Back to Home" butonuna tıklandığında
     * 3. Ana sayfaya dönüş öncesi
     * 
     * WHY IMPORTANT:
     * - Bir önceki oyun verilerini temizler
     * - Yeni oyunun temiz state'te başlamasını sağlar
     * - Memory leak'i önler
     * - Hata durumlarını engeller
     * 
     * KULLANIM:
     * - GameResultScreen'daki "Play Again" butonunda
     * - useEffect cleanup'ında (unmount sırasında)
     * - Home navigasyonu öncesi
     */
    resetGame: () => {
        console.log('🔄 Resetting game state')
        set({
            session: null,
            currentQuestion: null,
            questionStartTime: 0,
            isPlaying: false,
            isLoading: false,
            result: null,
            categoryId: null,
            categoryName: null,
            lastAnswerResult: null,
        })
    },
}))