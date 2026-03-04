import { Buffer } from 'buffer'
import 'react-native-gesture-handler'
import 'react-native-get-random-values'

// ============================================
// GLOBAL POLİFİLLER KURULUMU
// ============================================

/**
 * Buffer Polyfill
 * React Native'de Node.js Buffer API'sini sağlar
 * Web3 işlemleri (blockchain, wallet) için gerekli
 */
global.Buffer = Buffer

// ============================================
// BAĞIMLILIK İTHALATLARI
// ============================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { COLORS } from './src/constants'
import { AppNavigator } from './src/navigation/AppNavigator'

// ============================================
// REACT QUERY YAPILANDIRMASI
// ============================================

/**
 * React Query Client Kurulumu
 * 
 * AMAÇ:
 * - Server state (remote data) yönetimi
 * - API çağrılarının otomatik deduplication'ı
 * - Smart caching ve automatic refetching
 * 
 * YAPILANDIRMA DETAYLARI:
 * 
 * 1. RETRY POLİTİKASI (retry: 2)
 *    - Başarısız API çağrılarını 2 kez otomatik yeniden dene
 *    - Ağ hatalarında başarısızlık olasılığını azaltır
 *    - 3 denenin sonunda tamamen başarısız olur
 * 
 * 2. STALE TIME (staleTime: 1000 * 60 * 5)
 *    - Cache'teki veri 5 dakika boyunca "fresh" sayılır
 *    - 5 dakika sonra data "stale" (eski) duruma geçer
 *    - Stale verileri gösterir, arka planda yenisi getirilir
 *    - Ağ trafiğini azaltır, UX hızlı kalır
 *    - Örnek kullanım: Leaderboard, profile, stats
 * 
 * TOPLAM ETKİ:
 * - Hızlı UI: Veriler cache'den hemen gösterilir
 * - Doğru veri: Arka planda otomatik güncelleme
 * - Ağ optimizasyon: Gereksiz API çağrıları önlenir
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 dakika
    },
  },
})

// ============================================
// ROOT APP KOMPONENTI
// ============================================

/**
 * APP KOMPONENTİ
 * 
 * Bu, uygulamanın kök (root) bileşenidir.
 * Tüm temel Provider'ları buraya yerleştirilir.
 * 
 * PROVIDER ÇÖZÜMLEMESİ (Alt-> Üst):
 * 
 * 1. QUERY CLIENT PROVIDER (En dış)
 *    └─ Amaç: React Query state'i tüm uygulamaya sağla
 *    └ Kullanım: API veri yönetimi, caching, refetching
 * 
 * 2. GESTURE HANDLER ROOT VIEW
 *    └─ Amaç: React Native Gesture Handler'ı etkinleştir
 *    └ Kullanım: Swipe, pan, pinch gibi gesture'lar (navigation için)
 *    └ Not: Stillendirilmiş (flex: 1, background color)
 * 
 * 3. SAFE AREA PROVIDER
 *    └─ Amaç: Safe Area context'i sağla
 *    └ Kullanım: Notch, status bar, home indicator kaçınması
 *    └ Bileşenler: SafeAreaView otomatik padding alır
 * 
 * 4. STATUS BAR
 *    └─ Amaç: Cihaz status bar'ını yapılandır
 *    └ style="light": Beyaz icon/metin
 *    └ backgroundColor: Siyah arka plan
 * 
 * 5. APP NAVIGATOR (En iç)
 *    └─ Amaç: Navigation structure'ı sağla
 *    └ Kullanım: Welcome → Home → GamePlay flow
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      
      {/* ====================================== */}
      {/* PROVIDER 2: GESTURE HANDLER */}
      {/* ====================================== */}
      <GestureHandlerRootView 
        style={{ 
          flex: 1, 
          backgroundColor: COLORS.background 
        }}
      >
        
        {/* ================================== */}
        {/* PROVIDER 3: SAFE AREA */}
        {/* ================================== */}
        <SafeAreaProvider>
          
          {/* =============================== */}
          {/* STATUS BAR YAPILANDIRMASI */}
          {/* =============================== */}
          <StatusBar 
            style="light" 
            backgroundColor={COLORS.background} 
          />
          
          {/* =============================== */}
          {/* NAVIGATION YAPISI */}
          {/* =============================== */}
          <AppNavigator />
          
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}

// ============================================
// GENEL MIMARI AÇIKLAMA
// ============================================

/**
 * ROOT APP MİMARİ ÖZET
 * 
 * ┌─────────────────────────────────────────┐
 * │      REACT QUERY PROVIDER               │ Server state (API)
 * │  ┌───────────────────────────────────┐  │
 * │  │  GESTURE HANDLER ROOT VIEW        │  │ Navigation gesture'lar
 * │  │  ┌─────────────────────────────┐  │  │
 * │  │  │   SAFE AREA PROVIDER        │  │  │ Notch/Safe area
 * │  │  │  ┌───────────────────────┐  │  │  │
 * │  │  │  │   STATUS BAR CONFIG   │  │  │  │ Device status bar
 * │  │  │  └───────────────────────┘  │  │  │
 * │  │  │  ┌───────────────────────┐  │  │  │
 * │  │  │  │   APP NAVIGATOR       │  │  │  │ Screen management
 * │  │  │  │ - Auth vs App Stack   │  │  │  │
 * │  │  │  │ - Tab navigation      │  │  │  │
 * │  │  │  │ - Game flow           │  │  │  │
 * │  │  │  └───────────────────────┘  │  │  │
 * │  │  └─────────────────────────────┘  │  │
 * │  └───────────────────────────────────┘  │
 * └─────────────────────────────────────────┘
 * 
 * VERİ AKIŞI:
 * 1. Backend API → React Query (caching)
 * 2. React Query → Components (useQuery hook)
 * 3. Components → UI (render)
 * 
 * DURUM YÖNETİMİ KATMANLARı:
 * - Global: Zustand (Auth, Game, User stores)
 * - Server: React Query (API data)
 * - Local: useState (component state)
 * - Navigation: React Navigation (screen stack)
 */