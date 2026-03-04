import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { useEffect, useState } from 'react'
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../../components/common/Button'
import { Card } from '../../components/common/Card'
import { Loading } from '../../components/common/Loading'
import { COLORS } from '../../constants'
import {
    transferSOLForPackage,
    waitForTransactionConfirmation,
} from '../../services/solana'
import { useAuthStore } from '../../stores/authStore'
import { useUserStore } from '../../stores/userStore'

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
    WALLET_AUTH_TOKEN: 'quizseeker_wallet_auth_token',
    RECEIVER_WALLET: 'quizseeker_receiver_wallet',
}

// ============================================
// TYPES
// ============================================

interface GamePackage {
    id: number
    name: string
    description: string
    price_sol: number
    game_count: number
    base_multiplier: number
}

interface UserPackage {
    id: number
    games_remaining: number
    games_total: number
    games_used: number
    game_packages?: GamePackage
}

interface PurchaseResult {
    gamesAdded: number
    multiplier: number
}

// ============================================
// COMPONENT
// ============================================

export function PackagesScreen() {
    // ===== STORES =====
    // Kullanıcı ve cüzdan bilgilerini al
    const { user, walletAddress } = useAuthStore()

    // Paket ve satın alma verilerini al
    const {
        packages,
        userPackages,
        isLoading,
        fetchGamePackages,
        fetchUserPackages
    } = useUserStore()

    // ===== STATE =====
    // Şu anda satın alınmakta olan paket ID'si
    const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)

    // Satın alma işlemi devam ediyor mu
    const [purchaseLoading, setPurchaseLoading] = useState(false)

    // ===== LIFECYCLE =====
    // İlk açılışta: Paketleri ve kullanıcı paketlerini yükle
    useEffect(() => {
        initializeScreen()
    }, [])

    /**
     * Ekranı başlat
     * 
     * Görevler:
     * 1. Mevcut paketleri yükle (game_packages)
     * 2. Kullanıcının satın aldığı paketleri yükle (user_packages)
     * 3. Alıcı cüzdan adresini cache'le (hızlı erişim için)
     */
    const initializeScreen = async () => {
        try {
            fetchGamePackages()
            fetchUserPackages()
            await cacheReceiverWallet()
        } catch (error) {
            console.error('❌ Initialize error:', error)
        }
    }

    /**
     * Alıcı cüzdan adresini AsyncStorage'a cache'le
     * 
     * Amaç: Uygulama her açılışında constant'tan okumak yerine
     * cache'den oku (hız + network tasarrufu)
     * 
     * Cüzdan: JBv9tBjzZidd4LcNpNgJ5NSYqJu22wHy22pxbvsDpSbG
     * (Platform'un treasury wallet'ı)
     */
    const cacheReceiverWallet = async () => {
        try {
            // Cache'de var mı kontrol et
            const cached = await AsyncStorage.getItem(STORAGE_KEYS.RECEIVER_WALLET)
            if (cached) return

            // Cache'de yok → Cüzdan adresini kaydet
            const receiverWallet = 'JBv9tBjzZidd4LcNpNgJ5NSYqJu22wHy22pxbvsDpSbG'
            await AsyncStorage.setItem(STORAGE_KEYS.RECEIVER_WALLET, receiverWallet)
            console.log('✅ Receiver wallet cached')
        } catch (error) {
            console.error('❌ Cache receiver wallet error:', error)
        }
    }

    /**
     * Cache'den alıcı cüzdan adresini al
     * 
     * Fallback: Cache'de yoksa, constant'tan al ve kaydet
     */
    const getReceiverWallet = async (): Promise<string> => {
        try {
            // Cache'den al
            const cached = await AsyncStorage.getItem(STORAGE_KEYS.RECEIVER_WALLET)
            if (cached) return cached

            // Fallback: Constant'tan al
            const fallbackWallet = 'JBv9tBjzZidd4LcNpNgJ5NSYqJu22wHy22pxbvsDpSbG'
            await AsyncStorage.setItem(STORAGE_KEYS.RECEIVER_WALLET, fallbackWallet)
            return fallbackWallet

        } catch (error: any) {
            console.error('❌ Get receiver wallet error:', error)
            throw new Error('Receiver wallet not found')
        }
    }

    /**
     * Paket satın alma işlemini başlat
     * 
     * AKIŞ:
     * 1. Validasyon (user + wallet)
     * 2. Auth token al (AsyncStorage'dan)
     * 3. Kullanıcı onayı (Alert)
     * 4. Solana transfer yap
     * 5. Blockchain'de doğrula
     * 6. Backend'e kaydı gönder
     * 7. UI'ı güncelle (success/error)
     */
    const handlePurchasePackage = async (pkg: GamePackage) => {
        // ===== VALIDATION =====
        if (!user) {
            Alert.alert('Error', 'Please log in to purchase packages')
            return
        }

        if (!walletAddress) {
            Alert.alert('Error', 'Wallet address not found')
            return
        }

        try {
            // UI State: Satın alma başladı
            setSelectedPackageId(pkg.id)
            setPurchaseLoading(true)

            console.log('💳 Purchase started:', pkg.name, `(${pkg.price_sol} SOL)`)

            // ===== GET AUTH TOKEN =====
            // Önceki wallet bağlantısından auth token'ı al
            const authToken = await AsyncStorage.getItem(STORAGE_KEYS.WALLET_AUTH_TOKEN)
            if (!authToken) {
                throw new Error('Auth token not found. Please reconnect wallet.')
            }

            // ===== GET RECEIVER WALLET =====
            const receiverWallet = await getReceiverWallet()

            // ===== USER CONFIRMATION =====
            // Kullanıcıdan satın alma işlemini onaylamasını iste
            await requestUserConfirmation(pkg)

            // ===== TRANSFER SOL =====
            console.log(`💸 Transferring ${pkg.price_sol} SOL to ${receiverWallet}...`)

            const txSignature = await transferSOLForPackage(
                receiverWallet,
                parseFloat(pkg.price_sol.toString()),
                authToken
            )

            if (!txSignature) {
                throw new Error('Transfer failed or was cancelled')
            }

            console.log('✅ Transaction sent:', txSignature)

            // ===== CONFIRM ON BLOCKCHAIN =====
            // Blockchain'de doğrulanması için bekle (max 45 saniye)
            showConfirmationAlert()

            const isConfirmed = await waitForTransactionConfirmation(txSignature, 45000)

            if (!isConfirmed) {
                console.warn('⚠️ Confirmation timeout, but transaction may still complete')
            }

            console.log('✅ Transaction confirmed on blockchain')

            // ===== UPDATE BACKEND =====
            // Backend'e satın alma işlemini kaydet
            const result = await useUserStore.getState().purchaseGamePackage(
                pkg.id,
                txSignature
            ) as PurchaseResult

            // ===== SUCCESS =====
            showSuccessAlert(pkg, result, txSignature)

            // Aktif paketleri yenile
            fetchUserPackages()

        } catch (error: any) {
            console.error('❌ Purchase error:', error)
            showErrorAlert(error)

        } finally {
            // UI State: Satın alma bitti
            setPurchaseLoading(false)
            setSelectedPackageId(null)
        }
    }

    /**
     * Kullanıcıdan satın alma işlemini onaylamasını iste
     * 
     * Göster: Paket adı, fiyat, uyarı
     * Bekleme: Kullanıcı "Confirm" veya "Cancel" tuşuna basana kadar
     */
    const requestUserConfirmation = (pkg: GamePackage): Promise<void> => {
        return new Promise((resolve, reject) => {
            Alert.alert(
                '💳 Purchase Package',
                `${pkg.name}\n◎ ${pkg.price_sol} SOL\n\n⚠️ Solana Wallet app will open.\nDo you want to continue?`,
                [
                    {
                        text: 'Cancel',
                        onPress: () => reject(new Error('User cancelled')),
                        style: 'cancel',
                    },
                    {
                        text: 'Confirm',
                        onPress: () => resolve(),
                        style: 'default',
                    },
                ]
            )
        })
    }

    /**
     * Blockchain doğrulaması devam ediyor uyarısını göster
     */
    const showConfirmationAlert = () => {
        Alert.alert(
            '⏳ Verifying',
            'Your transaction is being verified on blockchain...',
            [{ text: 'OK', style: 'default' }]
        )
    }

    /**
     * Satın alma başarılı uyarısını göster
     * 
     * Bilgiler:
     * - Paket adı
     * - Eklenen oyun sayısı
     * - XP multiplier
     * - Transaction signature (ilk 20 karakter)
     */
    const showSuccessAlert = (
        pkg: GamePackage,
        result: PurchaseResult,
        txSignature: string
    ) => {
        const xpBonus = Math.round((result.multiplier - 1) * 100)

        Alert.alert(
            '✅ Purchase Successful!',
            `${pkg.name}\n\n➕ ${result.gamesAdded} games added\n🎁 +${xpBonus}% XP boost\n💰 ${pkg.price_sol} SOL\n\n🔗 ${txSignature.slice(0, 20)}...`,
            [
                {
                    text: 'OK',
                    style: 'default',
                },
            ]
        )
    }

    /**
     * Hata mesajını göster
     * 
     * Hata türlerine göre farklı mesajlar:
     * - User cancelled
     * - Network timeout
     * - Session expired
     * - Unknown error
     */
    const showErrorAlert = (error: any) => {
        let message = error.message || 'Unknown error occurred'

        // Hata mesajını kullanıcı dostu hale getir
        if (message.includes('cancelled')) {
            message = 'Purchase cancelled'
        } else if (message.includes('timeout')) {
            message = 'Wallet did not respond. Please try again.'
        } else if (message.includes('expired')) {
            message = 'Wallet session expired. Please reconnect your wallet.'
        } else if (message.includes('Insufficient')) {
            message = 'Insufficient SOL balance. Please add funds.'
        }

        Alert.alert('❌ Purchase Failed', message)
    }

    // ===== RENDER =====
    if (isLoading && !packages.length) {
        return <Loading fullScreen text="Loading packages..." />
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Section */}
                <Card style={styles.headerCard}>
                    <Text style={styles.headerTitle}>🛍️ Game Packages</Text>
                    <Text style={styles.headerSubtitle}>
                        Purchase packages to unlock more games and boost your XP
                    </Text>
                </Card>

                {/* Active Packages Section */}
                {userPackages.length > 0 && (
                    <>
                        <Card style={styles.activeHeaderCard}>
                            <Text style={styles.activeTitle}>✅ Your Active Packages</Text>
                        </Card>

                        {userPackages.map((pkg) => (
                            <Card key={pkg.id} style={styles.activePackageCard}>
                                {/* Package Header */}
                                <View style={styles.activePackageHeader}>
                                    <View style={styles.activePackageInfo}>
                                        <Text style={styles.activePackageName}>
                                            {pkg.game_packages?.name}
                                        </Text>
                                        <Text style={styles.activePackageStats}>
                                            {pkg.games_remaining} games remaining
                                        </Text>
                                    </View>

                                    {/* Games Remaining Badge */}
                                    <View style={styles.gamesRemaining}>
                                        <Text style={styles.gamesRemainingText}>
                                            {pkg.games_remaining}
                                        </Text>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressFill,
                                            {
                                                width: `${(pkg.games_remaining / pkg.games_total) * 100}%`,
                                            }
                                        ]}
                                    />
                                </View>

                                {/* Progress Stats */}
                                <Text style={styles.progressText}>
                                    {pkg.games_used} / {pkg.games_total} used
                                </Text>

                                {/* XP Multiplier Badge */}
                                {pkg.game_packages && (
                                    <View style={styles.multiplierBadge}>
                                        <Text style={styles.multiplierText}>
                                            ✨ x{pkg.game_packages.base_multiplier} XP Boost
                                        </Text>
                                    </View>
                                )}
                            </Card>
                        ))}
                    </>
                )}

                {/* Available Packages Section */}
                <Card style={styles.purchaseHeaderCard}>
                    <Text style={styles.purchaseTitle}>📦 Available Packages</Text>
                </Card>

                {isLoading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : packages.length > 0 ? (
                    packages.map((pkg) => (
                        <Card key={pkg.id} style={styles.packageCard}>
                            {/* Package Header */}
                            <View style={styles.packageHeader}>
                                <View style={styles.packageInfo}>
                                    <Text style={styles.packageName}>{pkg.name}</Text>
                                    <Text style={styles.packageDesc}>{pkg.description}</Text>
                                </View>

                                {/* Price Badge */}
                                <View style={styles.priceBadge}>
                                    <Text style={styles.priceValue}>◎ {pkg.price_sol}</Text>
                                    <Text style={styles.priceLabel}>SOL</Text>
                                </View>
                            </View>

                            {/* Package Features */}
                            <View style={styles.featuresContainer}>
                                <View style={styles.feature}>
                                    <Text style={styles.featureIcon}>🎮</Text>
                                    <Text style={styles.featureText}>
                                        {pkg.game_count} Games
                                    </Text>
                                </View>

                                <View style={styles.featureDivider} />

                                <View style={styles.feature}>
                                    <Text style={styles.featureIcon}>✨</Text>
                                    <Text style={styles.featureText}>
                                        +{Math.round((pkg.base_multiplier - 1) * 100)}% XP
                                    </Text>
                                </View>
                            </View>

                            {/* Purchase Button */}
                            <Button
                                title={
                                    selectedPackageId === pkg.id && purchaseLoading
                                        ? '⏳ Opening wallet...'
                                        : '💳 Purchase'
                                }
                                onPress={() => handlePurchasePackage(pkg)}
                                disabled={purchaseLoading}
                                variant="primary"
                            />
                        </Card>
                    ))
                ) : (
                    <Card style={styles.emptyCard}>
                        <Text style={styles.emptyText}>No packages available</Text>
                    </Card>
                )}

                {/* Spacer */}
                <View style={styles.spacer} />
            </ScrollView>
        </SafeAreaView>
    )
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background
    },

    // ===== HEADER =====
    headerCard: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 16,
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4
    },
    headerSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center'
    },

    // ===== ACTIVE PACKAGES =====
    activeHeaderCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        marginTop: 24
    },
    activeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text
    },
    activePackageCard: {
        marginHorizontal: 16,
        marginBottom: 12
    },
    activePackageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    activePackageInfo: {
        flex: 1
    },
    activePackageName: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 2
    },
    activePackageStats: {
        fontSize: 13,
        color: COLORS.textSecondary
    },
    gamesRemaining: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center'
    },
    gamesRemainingText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff'
    },
    progressBar: {
        height: 8,
        backgroundColor: COLORS.surfaceLight,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 8
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 4
    },
    progressText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 12
    },
    multiplierBadge: {
        backgroundColor: COLORS.primary + '20',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start'
    },
    multiplierText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary
    },

    // ===== PURCHASE HEADER =====
    purchaseHeaderCard: {
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 12
    },
    purchaseTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text
    },

    // ===== LOADING =====
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center'
    },

    // ===== PACKAGE CARD =====
    packageCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        paddingVertical: 16
    },
    packageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    packageInfo: {
        flex: 1,
        marginRight: 12
    },
    packageName: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 4
    },
    packageDesc: {
        fontSize: 12,
        color: COLORS.textSecondary
    },
    priceBadge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: 'center'
    },
    priceValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff'
    },
    priceLabel: {
        fontSize: 11,
        color: '#fff',
        marginTop: 2
    },

    // ===== FEATURES =====
    featuresContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12
    },
    feature: {
        alignItems: 'center',
        flex: 1
    },
    featureDivider: {
        width: 1,
        height: 40,
        backgroundColor: COLORS.border
    },
    featureIcon: {
        fontSize: 20,
        marginBottom: 4
    },
    featureText: {
        fontSize: 12,
        color: COLORS.text,
        fontWeight: '500',
        textAlign: 'center'
    },

    // ===== EMPTY STATE =====
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        marginHorizontal: 16
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary
    },

    // ===== SPACER =====
    spacer: {
        height: 32
    }
})