import {
    transact,
    Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js'
import {
    Cluster,
    Connection,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
} from '@solana/web3.js'
import bs58 from 'bs58'
import { Buffer } from 'buffer'
import { APP_IDENTITY, SOLANA_CLUSTER, SOLANA_RPC_URL } from '../constants'

// ============================================
// SOLANA CONNECTION SETUP
// ============================================

/**
 * SOLANA CONNECTION INITIALIZATION
 * 
 * AMAÇ: Blockchain ile iletişim kurarak transaction'ları göndermek
 * 
 * SOLANA BLOCKCHAİN NEDİR:
 * - Proof of History (PoH) consensus
 * - ~400ms block time
 * - ~65,000 tx/s throughput
 * - Proof of Stake validation
 * 
 * RPC ENDPOINTS:
 * - Helius (SOLANA_RPC_URL): Premium, fast, reliable
 * - Public API (api.mainnet-beta.solana.com): Free but slow
 * - Fallback strategy: Helius → Public RPC
 * 
 * CONNECTION AYARLARI:
 * - commitment: 'confirmed'
 *   Block finalizasyonu seviyesi
 *   - 'processed': Block validate edildi (hızlı ama risky)
 *   - 'confirmed': Block bir validator tarafından confirm edildi
 *   - 'finalized': Block 32+ validator confirm etti (güvenli)
 *   Seçim: 'confirmed' = balance + hızlı
 * 
 * LAMPORTS:
 * - 1 SOL = 1,000,000,000 Lamports (nano-SOL)
 * - Minimum transfer: 1 Lamport
 * - Fee: ~5,000 Lamports per tx
 * 
 * KULLANIM:
 * - connection.getLatestBlockhash()
 * - connection.getBalance()
 * - connection.getSignatureStatus()
 * - connection.sendRawTransaction()
 */
export const connection = new Connection(SOLANA_RPC_URL, {
    commitment: 'confirmed',
})

// ============================================
// TİP TANIMLARI
// ============================================

/**
 * AUTHORIZATION RESULT
 * 
 * Wallet bağlandığında dönen veri
 */
export interface AuthorizationResult {
    /**
     * Public key (Solana adresi)
     * Format: PublicKey (58 base58 char)
     * Örn: 'SxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx'
     */
    publicKey: PublicKey

    /**
     * Auth token (session token)
     * Wallet API ile iletişim için
     * Disconnect sırasında gerekli
     */
    authToken: string

    /**
     * Wallet adresi (string)
     * publicKey.toBase58() ile aynı
     * DB storage için
     */
    walletAddress: string
}

/**
 * MOBILE WALLET ADAPTER ACCOUNT
 * 
 * Phantom/Solflare tarafından dönen account
 */
interface MWAAccount {
    /**
     * Account adresi (Base64 veya Base58)
     * Base64 ise decode et
     * Base58 ise doğrudan PublicKey yap
     */
    address: string

    /**
     * Account label (opt)
     * Örn: "Main Wallet"
     */
    label?: string
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * BASE64 STRING'İ DECODE ET
 * 
 * AMAÇ: Base64 encoded string'i Uint8Array'e dönüştür
 * 
 * NEDEN GEREKLİ:
 * - Wallet adapter'dan Base64 address verebilir
 * - PublicKey için Uint8Array gerekli
 * - PublicKey(bytes) constructor'ı kullan
 * 
 * KULLANIM:
 * const bytes = decodeBase64('YWJjZGVmZ2g=')
 * const publicKey = new PublicKey(bytes)
 */
function decodeBase64(base64String: string): Uint8Array {
    return Buffer.from(base64String, 'base64')
}

/**
 * STRING'İN BASE64 OLUP OLMADIĞINI KONTROL ET
 * 
 * AMAÇ: Address format'ını belirle (Base64 vs Base58)
 * 
 * BASE64 REGEX:
 * - [A-Za-z0-9+/]: Base64 karakterleri
 * - =* : Padding (0-3 tane)
 * 
 * ÖRNEK:
 * isBase64('YWJjZGVmZ2g=') → true
 * isBase64('SxXxXxXxXxXxX...') → false (Base58)
 */
function isBase64(str: string): boolean {
    const base64Regex = /^[A-Za-z0-9+/]+=*$/
    return base64Regex.test(str) && (str.includes('/') || str.includes('+') || str.endsWith('='))
}

/**
 * ACCOUNT'TAN PUBLIC KEY OLUŞTUR
 * 
 * AMAÇ: MWA account'unu PublicKey'e dönüştür
 * 
 * AKIŞ:
 * 1. Address al
 * 2. Base64 mi kontrol et
 * 3. Evet: Decode et
 * 4. Hayır: Doğrudan PublicKey yap
 * 
 * WHY IMPORTANT:
 * - Wallet adapter'lar farklı format verebilir
 * - Normalization yapmalıyız
 * - Consistent PublicKey döndür
 */
function getPublicKeyFromAccount(account: MWAAccount): PublicKey {
    const address = account.address

    if (isBase64(address)) {
        const bytes = decodeBase64(address)
        return new PublicKey(bytes)
    }

    return new PublicKey(address)
}

// ============================================
// TIMEOUT WRAPPER (CRITICAL)
// ============================================

/**
 * TIMEOUT İLE PROMISE'İ WRAP ET
 * 
 * AMAÇ: Network hang'den kurtul
 * 
 * PROBLEM:
 * - Network slow → getLatestBlockhash() sonsuza kadar bekle
 * - User UX bozulur
 * - Transfer başarısız olur
 * 
 * ÇÖZÜM:
 * - Promise.race() kullan
 * - Timeout set et (15-120 saniye)
 * - Timeout'a ulaştığında: Error fırlat
 * - Caller fallback veya retry yapabilir
 * 
 * ÖRNEK:
 * const result = await withTimeout(
 *   connection.getLatestBlockhash(),
 *   15000  // 15 saniye
 * )
 * 
 * RACE MEKANIZMI:
 * - Promise 1: Gerçek işlem (getLatestBlockhash)
 * - Promise 2: Timer (15 saniye)
 * - Hangisi önce sonuç verirse, o kazanır
 * - Timeout önce: Error fırlat
 * - İşlem önce: Result return et
 * 
 * TIMING ÖNEMLERI:
 * - getLatestBlockhash: 1-15 saniye (normal 1-3s)
 * - signAndSendTransactions: 120 saniye (user onayı)
 * - getBalance: 2-5 saniye
 * - getSignatureStatus: 3-5 saniye
 */
async function withTimeout<T>(
    promise: Promise<T>,
    ms: number
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(
                () => reject(new Error(`Request timeout after ${ms}ms`)),
                ms
            )
        ),
    ])
}

// ============================================
// BLOCKHASH FETCHING (CRITICAL)
// ============================================

/**
 * BLOCKHASH VE FALLBACK STRATEJİSİ
 * 
 * AMAÇ: Blockchain'den en son blockhash'ı al (fallback ile)
 * 
 * BLOCKHASH NEDİR:
 * - Recent block'un cryptographic hash'ı
 * - Transaction'da gerekli
 * - Replay attack'ten koruma sağlar
 * - ~5 dakika valid (600 block ~= 4 dakika)
 * - Süresini aştıktan sonra: "Blockhash not found" error
 * 
 * AKIŞ:
 * 
 * 1️⃣ TRY: Helius RPC (Premium)
 *    - Hızlı (1-2s)
 *    - Reliable
 *    - Timeout: 15 saniye
 *    - Success → Return
 *    - Timeout → Next
 * 
 * 2️⃣ FALLBACK: Public RPC
 *    - Free (rate limited)
 *    - Slower (3-10s)
 *    - Timeout: 10 saniye
 *    - Success → Return
 *    - Failure → Error
 * 
 * HATA TÜRLERI:
 * - Network error: Fallback try
 * - Timeout: Fallback try
 * - Both fail: Throw error
 * 
 * NEDEN FALLBACK GEREKLİ:
 * - Helius can be slow/down
 * - Public RPC backup
 * - At least one should work
 * - Improved reliability
 * 
 * KULLANIM:
 * const { blockhash, lastValidBlockHeight } =
 *   await getLatestBlockhashWithFallback()
 * 
 * transaction.recentBlockhash = blockhash
 */
async function getLatestBlockhashWithFallback(): Promise<{
    blockhash: string
    lastValidBlockHeight: number
}> {
    console.log('🔗 Fetching blockhash from Helius...')

    try {
        // TRY: Helius (15 saniye timeout)
        const result = await withTimeout(
            connection.getLatestBlockhash('confirmed'),
            15000
        )
        console.log('✅ Got blockhash from Helius')
        return result

    } catch (error: any) {
        console.warn('⚠️ Helius timeout, trying public RPC...')
        console.warn('   Error:', error.message)

        try {
            // FALLBACK: Public RPC (10 saniye timeout)
            const publicConnection = new Connection(
                'https://api.mainnet-beta.solana.com',
                { commitment: 'confirmed' }
            )
            console.log('🔗 Fetching from public RPC...')

            const result = await withTimeout(
                publicConnection.getLatestBlockhash('confirmed'),
                10000
            )
            console.log('✅ Got blockhash from public RPC')
            return result

        } catch (fallbackError: any) {
            console.error('❌ Both RPC calls failed')
            throw new Error(
                `Cannot fetch blockhash: ${fallbackError.message}`
            )
        }
    }
}

// ============================================
// 1. CONNECT WALLET
// ============================================

/**
 * CÜZDANI BAĞLA
 * 
 * AMAÇ: Phantom/Solflare wallet'ı bağla ve authorize et
 * 
 * WALLET ADAPTER NEDİR:
 * - Mobile Wallet Adapter (MWA) protokolü
 * - Phantom, Solflare, vb. wallet'lar arasında bridge
 * - App → transact() → Wallet app → User approval
 * - Public key ve auth token return et
 * 
 * AKIŞ:
 * 1. transact() çağır (wallet session aç)
 * 2. wallet.authorize() çağır
 *    - Cluster: mainnet-beta (production)
 *    - Identity: App info (QuizSeeker)
 * 3. User onayını bekle (Phantom/Solflare)
 * 4. Account (public key) al
 * 5. Public key'i format et
 * 6. Return: { publicKey, authToken, walletAddress }
 * 
 * CLUSTER'LER:
 * - 'mainnet-beta': Production (gerçek SOL)
 * - 'devnet': Development (test SOL)
 * - 'testnet': Testing (public test)
 * 
 * TIMING:
 * - ~3-5 saniye (user confirm bekleme + network)
 * 
 * ERROR DURUMLARI:
 * - Wallet yok (Phantom kurulu değil)
 * - Kullanıcı reddetti
 * - Network error
 * - Timeout
 * 
 * RETURN:
 * {
 *   publicKey: PublicKey,
 *   authToken: 'auth_token_from_phantom',
 *   walletAddress: 'SxXxXxXxXxXxXxXxXx...'
 * }
 * 
 * KULLANIM:
 * const auth = await connectWallet()
 * // Use: auth.walletAddress for DB
 * // Use: auth.authToken for signing
 * // Use: auth.publicKey for transactions
 */
export async function connectWallet(): Promise<AuthorizationResult> {
    const authResult = await transact(
        async (wallet: Web3MobileWallet) => {
            console.log('📱 Connecting to wallet...')

            // Wallet authorization isteği (15 saniye timeout)
            const authorizationResult = await withTimeout(
                wallet.authorize({
                    cluster: SOLANA_CLUSTER as Cluster,
                    identity: APP_IDENTITY,
                }),
                15000
            )

            console.log('✅ Wallet connected successfully')

            // First account'u al (genellikle tek account)
            const account = authorizationResult.accounts[0] as MWAAccount
            const publicKey = getPublicKeyFromAccount(account)
            const walletAddress = publicKey.toBase58()

            console.log('✅ Wallet address:', walletAddress)

            return {
                publicKey,
                authToken: authorizationResult.auth_token,
                walletAddress,
            }
        }
    )

    return authResult
}

// ============================================
// 2. TRANSFER SOL FOR PACKAGE
// ============================================

/**
 * PAKET SATIŞI İÇİN SOL TRANSFER ET
 * 
 * AMAÇ: Kullanıcıdan treasury'ye SOL gönder
 * 
 * SOLANA TRANSACTION LIFECYCLE:
 * 
 * STEP 1: BUILD
 * ├─ Blockhash al (recent block hash)
 * ├─ SystemProgram.transfer() create et
 * ├─ Transaction object'e ekle
 * └─ recentBlockhash ve feePayer set et
 * 
 * STEP 2: SIGN
 * ├─ Transaction user'a gönder (Phantom)
 * ├─ User imzayla (private key)
 * ├─ Signed transaction return et
 * └─ İmzasız tx gönderilse: Invalid error
 * 
 * STEP 3: SEND
 * ├─ Signed tx blockchain'e gönder
 * ├─ ~400ms sonra broadcast
 * ├─ Mempool'da bekle
 * └─ Next leader slot'ta include et
 * 
 * STEP 4: CONFIRM
 * ├─ 'processed': Validator tarafından process edildi
 * ├─ 'confirmed': 31+ validators confirm etti
 * ├─ 'finalized': Fully finalized (güvenli)
 * └─ Poll: Every 2 seconds (waitForTransactionConfirmation)
 * 
 * PARAMETRELER:
 * - receiverAddress: Treasury wallet (Solana address)
 *   Örn: 'SxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx'
 * 
 * - amountSOL: SOL miktarı
 *   Örn: 0.1 SOL
 *   Backend'den gelir (package price)
 *   Dönüştürülür: amountSOL * LAMPORTS_PER_SOL
 * 
 * - authToken: Wallet session token
 *   connectWallet() sonrası al
 *   Her wallet session'da farklı
 * 
 * AKIŞ (ÖNEMLİ OPTIMIZATION):
 * 
 * ❌ ESKİ YÖNTEMİ (SLOW):
 * transact() aç
 *   ↓
 * Blockhash al (network hang)
 *   ↓
 * Wallet app aç (gecikme)
 *   ↓
 * Tx build ve sign
 * 
 * ✅ YENİ YÖNTEMİ (FAST):
 * Blockhash al (paralel)
 * Wallet app aç (aynı zamanda)
 * Blockhash hazır → Hızlı build
 * 
 * DETAY AÇIKLAMA:
 * 1️⃣ BLOCKHASH FETCH (outside transact)
 *    - Helius ile paralel fetch et
 *    - Fallback: Public RPC
 *    - Timeout: 10 saniye
 *    - User wait etmez
 * 
 * 2️⃣ OPEN WALLET (transact çalış)
 *    - Phantom/Solflare açılır
 *    - Blockhash zaten hazır!
 *    - Build hızlı olur
 * 
 * 3️⃣ BUILD TRANSACTION
 *    - SystemProgram.transfer() program instruction
 *    - Amount: lamports'a convert et
 *    - Blockhash: Zaten fetched (hızlı)
 * 
 * 4️⃣ SIGN & SEND
 *    - wallet.signAndSendTransactions()
 *    - User approve → Phantom imzalar
 *    - Tx blockchain'e gönderilir
 *    - Signature return et
 * 
 * RETRY LOGIC:
 * - MAX_RETRIES = 2 (try 1, fail, try 2, fail, throw)
 * - Arası: 3 saniye wait (network recover)
 * - Fail reason log'la
 * 
 * ERROR DURUMLARI:
 * - Insufficient balance: "Insufficient funds"
 * - Blockhash expired: "Blockhash not found"
 * - User reject: SignCancelled error
 * - Network timeout: Retry
 * - Invalid address: Invalid public key
 * 
 * HATA YÖNETİMİ:
 * - Her step'i try-catch ile wrap et
 * - Error'ı log'la
 * - Retry yapılsın
 * - Max retry'dan sonra: Throw
 * 
 * SECURITY:
 * - Receiver address: Backend'den doğrulanacak
 * - Amount: Backend'den doğrulanacak
 * - Private key: Cihazda kalır (Phantom imzalar)
 * - Blockchain: Immutable (undo yok)
 * 
 * TIMING:
 * - Blockhash fetch: 1-3 saniye
 * - Wallet authorize: 1-5 saniye
 * - Sign: 0.5-1 saniye
 * - Send: ~400ms
 * - Total: ~5-10 saniye
 * - User confirm wait: +indefinite (user speed)
 * 
 * KULLANIM:
 * try {
 *   const txSig = await transferSOLForPackage(
 *     'treasury_address',
 *     0.1,  // 0.1 SOL
 *     authToken
 *   )
 *   await waitForTransactionConfirmation(txSig)
 *   // Backend'e txSig gönder (package unlock)
 * } catch (error) {
 *   Alert.alert('Transfer failed', error.message)
 * }
 */
export async function transferSOLForPackage(
    receiverAddress: string,
    amountSOL: number,
    authToken: string
): Promise<string> {
    const MAX_RETRIES = 2
    let lastError: any = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(
                `💳 Transfer attempt ${attempt}/${MAX_RETRIES}`
            )

            // ===== STEP 1: FETCH BLOCKHASH (PARALLEL) =====
            // Wallet app açılmadan ÖNCE blockhash al
            // Böylece user waitlemez

            console.log('🔗 Fetching blockhash (in parallel)...')

            let blockhash: string

            try {
                // Try: Helius (hızlı, premium)
                const result = await withTimeout(
                    connection.getLatestBlockhash('confirmed'),
                    10000
                )
                blockhash = result.blockhash
                console.log(
                    '✅ Got blockhash from Helius:',
                    blockhash.slice(0, 8) + '...'
                )

            } catch (error: any) {
                // Fallback: Public RPC
                console.warn(
                    '⚠️ Helius slow/down, trying public RPC...'
                )

                try {
                    const publicConnection = new Connection(
                        'https://api.mainnet-beta.solana.com',
                        { commitment: 'confirmed' }
                    )
                    const result = await withTimeout(
                        publicConnection.getLatestBlockhash('confirmed'),
                        8000
                    )
                    blockhash = result.blockhash
                    console.log(
                        '✅ Got blockhash from public RPC:',
                        blockhash.slice(0, 8) + '...'
                    )

                } catch (fallbackError) {
                    throw new Error(
                        `Cannot fetch blockhash: ${fallbackError}`
                    )
                }
            }

            // ===== STEP 2: OPEN WALLET & BUILD TX =====
            // Blockhash hazır! Şimdi wallet aç
            // Build hızlı olacak (blockhash ready)

            console.log('📱 Opening wallet for signing...')

            const txSignature = await transact(
                async (wallet: Web3MobileWallet) => {
                    // 1. Authorize
                    console.log('🔑 Authorizing wallet...')
                    const authResult = await withTimeout(
                        wallet.authorize({
                            cluster: SOLANA_CLUSTER as Cluster,
                            identity: APP_IDENTITY,
                        }),
                        15000
                    )
                    console.log('✅ Authorization successful')

                    // 2. Get sender public key
                    const account = authResult.accounts[0] as MWAAccount
                    const senderPublicKey = getPublicKeyFromAccount(account)

                    console.log('📤 Sender:', senderPublicKey.toBase58())
                    console.log('📥 Receiver:', receiverAddress)
                    console.log(`💰 Amount: ${amountSOL} SOL`)

                    // 3. Build transaction
                    console.log('🔨 Building transaction...')
                    const receiverPublicKey = new PublicKey(receiverAddress)

                    const transaction = new Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: senderPublicKey,
                            toPubkey: receiverPublicKey,
                            lamports: amountSOL * LAMPORTS_PER_SOL,
                        })
                    )

                    transaction.recentBlockhash = blockhash // ← Already fetched!
                    transaction.feePayer = senderPublicKey

                    console.log('✅ Transaction built')

                    // 4. Sign and send
                    console.log(
                        '📱 Requesting signature from wallet...'
                    )
                    const signedTransactions = await withTimeout(
                        wallet.signAndSendTransactions({
                            transactions: [transaction],
                        }),
                        120000 // User has 2 minutes to approve
                    )

                    // 5. Extract signature
                    const sig =
                        typeof signedTransactions[0] === 'string'
                            ? signedTransactions[0]
                            : bs58.encode(
                                signedTransactions[0] as Uint8Array
                            )

                    console.log(
                        '✅ Transaction sent to blockchain:',
                        sig.slice(0, 20) + '...'
                    )

                    return sig
                }
            )

            console.log('🎉 Transfer completed successfully')
            return txSignature

        } catch (error: any) {
            lastError = error
            console.error(
                `❌ Attempt ${attempt} failed:`,
                error.message
            )

            if (attempt < MAX_RETRIES) {
                console.log(
                    `⏳ Waiting 3 seconds before retry...`
                )
                await new Promise(r =>
                    setTimeout(r, 3000)
                )
            }
        }
    }

    throw (
        lastError ||
        new Error('Transfer failed after all retries')
    )
}

// ============================================
// 3. DISCONNECT WALLET
// ============================================

/**
 * CÜZDANI AYIR
 * 
 * AMAÇ: Wallet session'ı sonlandır
 * 
 * AKIŞ:
 * 1. Auth token'ı kullan
 * 2. wallet.deauthorize() çağır
 * 3. Session kapan
 * 4. Phantom'da logout
 * 
 * AUTH TOKEN KULLANIM:
 * - connectWallet() sonrası al
 * - Disconnect sırasında kullan
 * - Session'ı invalidate et
 * 
 * ERROR TOLERANCE:
 * - Fail etsede: Catch et, continue
 * - Session zaten closed'se: Ok
 * 
 * KULLANIM:
 * await disconnectWallet(authToken)
 * // State reset (useAuthStore)
 */
export async function disconnectWallet(
    authToken: string
): Promise<void> {
    try {
        await transact(async (wallet: Web3MobileWallet) => {
            console.log('👋 Disconnecting wallet...')
            await wallet.deauthorize({
                auth_token: authToken,
            })
        })
        console.log('✅ Wallet disconnected')

    } catch (error) {
        console.log('ℹ️ Disconnect completed (wallet may already be closed)')
    }
}

// ============================================
// 4. SIGN MESSAGE
// ============================================

/**
 * MESAJ İMZALA
 * 
 * AMAÇ: Authentication için mesaj imzala
 * 
 * AUTH FLOW'DA KULLANIM:
 * 1. Backend: Random nonce string generate et
 * 2. Backend: "Sign this message: {nonce}" oluştur
 * 3. Frontend: signMessage() çağır
 * 4. Frontend: Phantom'dan imza al
 * 5. Backend: İmzayı verify et (pub key ile)
 * 6. Backend: JWT token oluştur (login complete)
 * 
 * İMZA VERİFİKASYON:
 * - İmza: Özel anahtar (private key) ile
 * - Verify: Genel anahtar (public key) ile
 * - Blockchain: Proof of ownership
 * 
 * PARAMETRELER:
 * - message: İmzalanacak string
 *   Örn: "Sign to login: nonce_123"
 * 
 * - authToken: Wallet session token
 *   connectWallet() sonrası
 * 
 * RETURN:
 * {
 *   signature: 'sig_...', // bs58 encoded
 *   publicKey: 'SxXxXxX...'
 * }
 * 
 * AKIŞ:
 * 1. transact() aç
 * 2. wallet.authorize()
 * 3. Message'ı bytes'a encode et
 * 4. wallet.signMessages() çağır
 * 5. İmzayı bs58 encode et
 * 6. Return
 * 
 * GÜVENLIK:
 * - Private key asla app'te saklanmaz
 * - Phantom'da imza yapılır
 * - App'te sadece public key + signature
 * - Backend: signature doğrula public key ile
 * 
 * KULLANIM:
 * const { signature, publicKey } = await signMessage(
 *   'Sign to login: xyz',
 *   authToken
 * )
 * // Backend'e gönder verification için
 */
export async function signMessage(
    message: string,
    authToken: string
): Promise<{ signature: string; publicKey: string }> {
    const result = await transact(
        async (wallet: Web3MobileWallet) => {
            console.log('✍️ Signing message...')

            // 1. Authorize
            const authResult = await wallet.authorize({
                cluster: SOLANA_CLUSTER as Cluster,
                identity: APP_IDENTITY,
            })

            // 2. Get public key
            const account = authResult.accounts[0] as MWAAccount
            const publicKey = getPublicKeyFromAccount(account)

            // 3. Encode message to bytes
            const messageBytes = new TextEncoder().encode(message)

            // 4. Sign message
            console.log('📱 Requesting signature from wallet...')
            const signedPayloads = await wallet.signMessages({
                addresses: [publicKey.toBase58()], // ← STRING array!
                payloads: [messageBytes],
            })

            // 5. Encode signature
            const signature = bs58.encode(signedPayloads[0])

            console.log('✅ Message signed')

            return {
                signature,
                publicKey: publicKey.toBase58(),
            }
        }
    )

    return result
}

// ============================================
// 5. TRANSACTION VERIFICATION
// ============================================

/**
 * TRANSACTION'I DOĞRULA
 * 
 * AMAÇ: Blockchain'de transaction'ın statusını kontrol et
 * 
 * TRANSACTION STATUS'LERİ:
 * - null: Transaction henüz blockchain'de yok
 * - 'processed': Validator tarafından process edildi
 * - 'confirmed': 31+ validators confirm etti
 * - 'finalized': Fully finalized, undo yok
 * - error: Transaction failed
 * 
 * RETURN:
 * - true: Confirmed veya finalized
 * - false: Pending, failed, or not found
 * 
 * TIMING:
 * - ~2-5 saniye (normal)
 * - ~5 dakika max (blockhash expire)
 * 
 * KULLANIM:
 * const confirmed = await verifyTransaction(txSig)
 * if (confirmed) {
 *   // Transfer başarılı
 *   // Backend'e txSig gönder
 * } else {
 *   // Hala pending veya failed
 *   // Tekrar kontrol et
 * }
 */
export async function verifyTransaction(
    txSignature: string
): Promise<boolean> {
    try {
        console.log('🔍 Checking transaction status...')

        const status = await withTimeout(
            connection.getSignatureStatus(txSignature),
            5000
        )

        if (!status.value) {
            console.log('⏳ Transaction pending...')
            return false
        }

        if (status.value.err) {
            console.error(
                '❌ Transaction error:',
                status.value.err
            )
            return false
        }

        const confirmationStatus = status.value.confirmationStatus
        console.log(
            `✅ Confirmation status: ${confirmationStatus}`
        )

        return (
            confirmationStatus === 'confirmed' ||
            confirmationStatus === 'finalized'
        )

    } catch (error: any) {
        console.warn(
            '⚠️ Verification error:',
            error.message
        )
        return false
    }
}

/**
 * TRANSACTION CONFIRMATION'UNU BEKLE
 * 
 * AMAÇ: Transaction confirmed/finalized olana kadar poll et
 * 
 * PARAMETRELER:
 * - txSignature: Transaction signature
 * - maxWaitTime: Max bekleme süresi (default: 45 saniye)
 *   45s = ~11 block (4 min/block average)
 * 
 * AKIŞ:
 * 1. Start time al
 * 2. Loop: While (elapsed < maxWaitTime)
 * 3. verifyTransaction() çağır
 * 4. Confirmed? → Return true
 * 5. Hayır? → 2 saniye wait
 * 6. Loop continue
 * 7. Timeout? → Return false
 * 
 * POLLING INTERVAL:
 * - 2 saniye (aggressive polling)
 * - Çok sık: Network load, rate limit
 * - Çok seyrek: Geç detection
 * - 2s = sweet spot
 * 
 * TIMING ÖRNEĞI:
 * - Tx sent: t=0
 * - Poll: t=0, 2s, 4s, 6s, ...
 * - Confirmed: t=~8-15s
 * - Finalized: t=~30-45s
 * 
 * RETURN:
 * - true: Confirmed/finalized
 * - false: Timeout (may still confirm)
 * 
 * KULLANIM:
 * const confirmed = await waitForTransactionConfirmation(
 *   txSig,
 *   45000  // 45 saniye
 * )
 * if (confirmed) {
 *   // Package unlock
 * } else {
 *   // Timeout - user manual kontrol etsin
 *   // Veya polling continue et backend'de
 * }
 */
export async function waitForTransactionConfirmation(
    txSignature: string,
    maxWaitTime: number = 45000
): Promise<boolean> {
    const startTime = Date.now()
    const pollInterval = 2000 // Poll every 2 seconds

    console.log(
        `⏳ Waiting for confirmation (max ${maxWaitTime / 1000}s)...`
    )

    while (Date.now() - startTime < maxWaitTime) {
        const isConfirmed = await verifyTransaction(txSignature)

        if (isConfirmed) {
            console.log('🎉 Transaction confirmed!')
            return true
        }

        // Wait before next poll
        await new Promise(resolve =>
            setTimeout(resolve, pollInterval)
        )
    }

    console.error(
        `⏱️ Confirmation timeout - transaction may still confirm`
    )
    return false
}

// ============================================
// 6. UTILITIES
// ============================================

/**
 * SOL BAKIYESINI AL
 * 
 * AMAÇ: Cüzdan SOL bakiyesini getir
 * 
 * PARAMETRELER:
 * - publicKey: Cüzdan public key'i
 * 
 * RETURN:
 * - SOL miktarı (number)
 * - Örn: 0.5 (= 500,000,000 lamports)
 * 
 * DÖNÜŞÜM:
 * - Blockchain: Lamports (nano-SOL)
 * - UI: SOL (user-friendly)
 * - Formül: lamports / LAMPORTS_PER_SOL
 *   LAMPORTS_PER_SOL = 1,000,000,000
 * 
 * TIMING:
 * - ~2-5 saniye
 * 
 * KULLANIM:
 * const balance = await getSOLBalance(publicKey)
 * console.log(`Balance: ${balance} SOL`)
 * // Görüntü: "Balance: 0.5 SOL"
 */
export async function getSOLBalance(
    publicKey: PublicKey
): Promise<number> {
    console.log('💰 Fetching SOL balance...')

    const balance = await withTimeout(
        connection.getBalance(publicKey),
        10000
    )

    const balanceInSOL = balance / LAMPORTS_PER_SOL

    console.log(`✅ Balance: ${balanceInSOL} SOL`)

    return balanceInSOL
}