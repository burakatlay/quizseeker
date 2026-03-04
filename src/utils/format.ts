import { LEVEL_THRESHOLDS } from '../constants';

// Wallet adresini kısalt
export function shortenAddress(address: string, chars = 4): string {
    if (!address) return '';
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Seviye bilgisini hesapla
 * 
 * XP'den seviye, progress bar yüzdesini hesapla
 */
export function getLevelInfo(totalXP: number) {
    const levelThreshold = LEVEL_THRESHOLDS.find(
        (level) => totalXP >= level.minXP && totalXP <= level.maxXP
    ) || LEVEL_THRESHOLDS[0]

    // Mevcut seviye aralığındaki progress hesapla
    const currentLevelMinXP = levelThreshold.minXP
    const currentLevelMaxXP = levelThreshold.maxXP
    const currentXPInLevel = totalXP - currentLevelMinXP
    const xpNeededForNextLevel = currentLevelMaxXP - currentLevelMinXP

    // Progress yüzdesini hesapla (0-100)
    const progressPercentage = (currentXPInLevel / xpNeededForNextLevel) * 100

    return {
        level: levelThreshold.level,
        name: levelThreshold.name,
        color: levelThreshold.color,
        minXP: levelThreshold.minXP,
        maxXP: levelThreshold.maxXP,
        currentXP: currentXPInLevel,
        nextLevelXP: xpNeededForNextLevel,
        progressPercentage: Math.min(progressPercentage, 100),
        progress: Math.min(progressPercentage, 100),
    }
}

// Sayıyı formatla (1000 -> 1K)
export function formatNumber(num?: number | null): string {
    if (num == null || Number.isNaN(num)) return '0';

    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
}

// Süreyi formatla
export function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

// Tarihi formatla
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
}

// Yüzde formatla
export function formatPercent(value: number): string {
    return `${Math.round(value)}%`;
}

// SOL miktarını formatla
export function formatSOL(amount: number): string {
    return amount.toFixed(4) + ' SOL';
}
