import React, { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../constants'

// ============================================
// TİP TANIMLARI
// ============================================

interface TimerProps {
    /**
     * Süre: Cevaplamak için ayrılan toplam süre (saniye cinsinden)
     * Tipik değer: 10 saniye
     */
    duration: number

    /**
     * Callback: Süre bittiğinde tetiklenir
     * Soruyu otomatik olarak zaman aşımı olarak işaretlemek için kullanılır
     */
    onTimeUp: () => void

    /**
     * Opsiyonel duraklama bayrağı
     * true olduğunda: Timer duraklatılır ve onTimeUp tetiklenmez
     * Kullanıcı cevap seçtiğinde kullanılır
     */
    isPaused?: boolean
}

// ============================================
// AÇIKLAMA: Timer Komponenti
// ============================================
/**
 * TIMER KOMPONENTİ
 * 
 * Bu komponent, quiz oyunundaki her soru için geri sayım sayacını yönetir.
 * 
 * ANA ÖZELLİKLER:
 * 1. Geri Sayım Gösterimi: Kalan saniyeyi belirgin şekilde gösterir (örn: "7s")
 * 2. İlerleme Çubuğu: Zaman dolmaya başladıkça dolan animasyonlu çubuk
 * 3. Renk Kodlaması:
 *    - Yeşil/Primary: Normal (>5 saniye)
 *    - Sarı/Warning: Uyarı (3-5 saniye)
 *    - Kırmızı/Error: Tehlike (<3 saniye)
 * 4. Duraklama Desteği: Kullanıcı cevap verdiğinde geri sayımı durdur
 * 5. Soru Değiştiğinde Sıfırla: duration prop değiştiğinde sıfırlansın
 * 
 * PERFORMANS NOTLARI:
 * - İlerleme çubuğu için Animated.timing kullanılır (smooth animasyon)
 * - 1 saniye aralığı ile geri sayım güncellemeleri
 * - Cleanup bellek sızıntılarını önler
 * - didTimeUp bayrağı çift tetiklenmeyi engeller
 */

export function Timer({ duration, onTimeUp, isPaused = false }: TimerProps) {
    // ============================================
    // DURUM YÖNETİMİ
    // ============================================

    /**
     * Kalan süre (saniye cinsinden)
     * duration'dan 0'a kadar azalır
     */
    const [timeLeft, setTimeLeft] = useState<number>(duration)

    /**
     * İlerleme çubuğu için animasyonlu genişlik
     * Aralık: 0 (boş) ile 100 (dolu)
     * duration süresi içinde 100'den 0'a kadar animasyonlanır
     */
    const animatedWidth = useRef(new Animated.Value(100)).current

    /**
     * Geri sayım için aralık referansı
     * Duraklama/unmount'ta temizlemek için saklı tutulur
     */
    const intervalRef = useRef<number | null>(null)

    /**
     * Çift onTimeUp çağrılarını önlemek için bayrak
     * onTimeUp her soru için sadece bir kez çalışmalı
     */
    const didTimeUp = useRef(false)

    // ============================================
    // YAŞ DÖNGÜSÜ: Süre değiştiğinde sıfırla
    // ============================================
    /**
     * Soru değiştiğinde (duration prop güncelleme):
     * 1. timeLeft'i ilk dönemi olarak ayarla
     * 2. İlerleme çubuğunu 100%'e sıfırla
     * 3. timeUp bayrağını sıfırla
     * 
     * Bu, her yeni sorunun taze başlamasını sağlar
     */
    useEffect(() => {
        setTimeLeft(duration)
        animatedWidth.setValue(100)
        didTimeUp.current = false
    }, [duration])

    // ============================================
    // YAŞ DÖNGÜSÜ: Duraklama/Devam ve Geri Sayım Döngüsü
    // ============================================
    /**
     * Ana timer efekti:
     * - Duraklama/devam mantığını yönetir
     * - Animasyonlu ilerleme çubuğunu yönetir
     * - 1 saniye geri sayım aralığını çalıştırır
     * - Süre bitince onTimeUp tetikler
     * - Unmount veya duraklama sırasında temizliği yapar
     * 
     * YÜRÜTME AKIŞI:
     * 1. Duraklatılmışsa: Çalışan aralığı temizle ve dön
     * 2. İlerleme çubuğu animasyonunu başlat (100% → 0%, duration*1000ms)
     * 3. Geri sayım aralığını başlat (1 saniye artışlar)
     * 4. Her artışta: timeLeft'i 1 azalt
     * 5. timeLeft ≤ 0 olduğunda: onTimeUp'ı çağır (sadece bir kez)
     * 6. Temizlik: Duraklama/unmount'ta aralığı temizle
     */
    useEffect(() => {
        // ===== BÖLÜM 1: DURAKLAMA İŞLEMİ =====
        /**
         * Duraklatılmışsa (kullanıcı cevap verdi):
         * - Çalışan aralığı temizle
         * - İlerleme çubuğu animasyonunu durdur
         * - Erken dön (yeniden başlatma)
         * 
         * Bu, sayacı UI'de mevcut konumda dondurur
         */
        if (isPaused) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
            return
        }

        // ===== BÖLÜM 2: İLERLEME ÇUBUĞU ANIMASYONU =====
        /**
         * Animated.timing:
         * - Genişliği 100'den 0'a animasyonla
         * - Süre: duration * 1000 milisaniye
         * - Geri sayım sayacı ile senkronize edilir
         * 
         * Bu, zaman dolmaya başladıkça smooth görsel tükenme efekti oluşturur
         */
        Animated.timing(animatedWidth, {
            toValue: 0,
            duration: duration * 1000,
            useNativeDriver: false,
        }).start()

        // ===== BÖLÜM 3: GERI SAYIM ARALIGI =====
        /**
         * 1 saniye aralığı döngüsü:
         * - Her 1000ms'de güncelleşir
         * - timeLeft'i azaltır
         * - Zamanın bitip bitmediğini kontrol et
         * 
         * timeLeft ≤ 1 olduğunda:
         * 1. Aralığı temizle (döngüyü durdur)
         * 2. didTimeUp bayrağını kontrol et (çift çağrıları önle)
         * 3. Bayrağı true'ya ayarla
         * 4. onTimeUp çağrısını ertele (setTimeout)
         *    (state güncellemeleri tamamlandığından emin olmak için)
         * 5. Callback'den sonra bayrağı sıfırla (sonraki soru için)
         */
        intervalRef.current = (setInterval(() => {
            setTimeLeft((prev) => {
                // Zaman bitti
                if (prev <= 1) {
                    // Aralığı temizle
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current)
                        intervalRef.current = null
                    }

                    // Çift callback'i önle
                    if (!didTimeUp.current) {
                        didTimeUp.current = true
                        
                        // Callback'i sonraki render döngüsüne ertele
                        setTimeout(() => {
                            onTimeUp?.()
                            didTimeUp.current = false
                        }, 0)
                    }

                    return 0
                }

                // Sayacı azalt
                return prev - 1
            })
        }, 1000) as unknown as number)

        // ===== BÖLÜM 4: TEMIZLIK =====
        /**
         * Temizlik fonksiyonu:
         * - isPaused değiştiğinde çağrılır
         * - duration değiştiğinde çağrılır
         * - Komponent unmount olduğunda çağrılır
         * 
         * Bellek sızıntılarını ve sahipsiz aralıkları engeller
         */
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [duration, isPaused, onTimeUp])

    // ============================================
    // YARDIMCI FONKSİYONLAR
    // ============================================

    /**
     * Kalan zamana göre sayacın rengini belirle
     * 
     * Renkler aciliyet derecesini gösterir:
     * - Error (Kırmızı): < 3 saniye → Zaman kritik
     * - Warning (Sarı): 3-5 saniye → Acele et
     * - Primary (Mavi): > 5 saniye → Yeterli zaman
     */
    const getTimeColor = (): string => {
        if (timeLeft <= 3) return COLORS.error        // 🔴 Kritik
        if (timeLeft <= 5) return COLORS.warning      // 🟡 Uyarı
        return COLORS.primary                         // 🔵 Normal
    }

    /**
     * Animasyonlu genişlik değerini yüzdeye dönüştür
     * 
     * Giriş: Animasyonlu değer (0-100)
     * Çıkış: Genişlik stili için string yüzde
     * 
     * Örnek:
     * - animatedWidth = 100 → '100%'
     * - animatedWidth = 50 → '50%'
     * - animatedWidth = 0 → '0%'
     */
    const widthInterpolate = animatedWidth.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
    })

    // ============================================
    // RENDER
    // ============================================

    return (
        <View style={styles.container}>
            {/* ===== SAYAC GÖRÜNTÜSÜ ===== */}
            {/* 
             * Büyük geri sayım numarası "s" son eki ile
             * Renk, kalan zamana göre değişir
             */}
            <View style={styles.timerRow}>
                <Text style={[styles.timerText, { color: getTimeColor() }]}>
                    {timeLeft}
                </Text>
                <Text style={styles.secondsText}>s</Text>
            </View>

            {/* ===== İLERLEME ÇUBUĞU ===== */}
            {/*
             * Kalan zamanın görsel temsili
             * 
             * YAPILANDIRMA:
             * 1. Konteyner: Tam genişlikli arka plan izleme
             * 2. Doldurma: Animasyonlu genişlik, tükenüyor
             * 
             * ANIMASYON:
             * - Genişliği 100%'den 0%'ye smooth animasyon
             * - Renk, sayacın aciliyet seviyesi ile uyuşur
             * 
             * AMAÇ:
             * - Hızlı görsel geri bildirim
             * - Sadece sayılardan daha iyi UX
             * - Çubuk tükenişi ile bilinçaltı uyarı
             */}
            <View style={styles.progressBar}>
                <Animated.View
                    style={[
                        styles.progressFill,
                        {
                            width: widthInterpolate,
                            backgroundColor: getTimeColor(),
                        },
                    ]}
                />
            </View>
        </View>
    )
}

// ============================================
// STİLLER
// ============================================

const styles = StyleSheet.create({
    // ===== KONTEYNER =====
    /**
     * Sayac ve ilerleme çubuğu için ana sarmalayıcı
     * Ortalanmış ve soru altında boşluk bırakılmış
     */
    container: {
        alignItems: 'center',
        marginBottom: 16,
    },

    // ===== SAYAC GÖRÜNTÜ SATIRI =====
    /**
     * İçeren flex satır:
     * - Büyük geri sayım numarası (örn: "7")
     * - Saniye son eki (örn: "s")
     * 
     * Baseline hizalanması "7s" doğal görünmesini sağlar
     */
    timerRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 8,
    },

    /**
     * Ana geri sayım numarası
     * - Büyük yazı tipi (48pt) görünürlük için
     * - Kalın ağırlık vurgu için
     * - Renk zaman aciliyetine göre değişir
     */
    timerText: {
        fontSize: 48,
        fontWeight: 'bold',
    },

    /**
     * Saniye son eki
     * - Sayıdan daha küçük yazı tipi (24pt)
     * - Hassas renk (ikincil metin)
     * - Boşluk için küçük sol kenar
     */
    secondsText: {
        fontSize: 24,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },

    // ===== İLERLEME ÇUBUĞU =====
    /**
     * İlerleme çubuğu için arka plan izleme
     * - Tam genişlik
     * - Açık gri arka plan
     * - Modern görünüş için yuvarlak köşeler
     * - Doldurma, border-radius'u saygı görsün diye overflow hidden
     */
    progressBar: {
        width: '100%',
        height: 6,
        backgroundColor: COLORS.surface,
        borderRadius: 3,
        overflow: 'hidden',
    },

    /**
     * İlerleme çubuğunun içindeki animasyonlu doldurma
     * - Yükseklik ana öğe ile uyuşur
     * - Animasyonlu genişlik (0% ile 100% arasında)
     * - Renk zaman aciliyetine göre
     * - Parlatma için yuvarlak köşeler
     * 
     * ANIMASYON:
     * animatedWidth'dan hesaplanan width 100'den 0'a animasyonlanır
     * zaman duration'dan 0'a kadar geri sayarken
     */
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
})