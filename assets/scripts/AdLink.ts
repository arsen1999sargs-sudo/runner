/**
 * Открытие внешней ссылки (CTA) по правилам рекламных сетей.
 *
 * Универсальный обработчик клика для playable-ad:
 *   1. MRAID (Unity Ads, IronSource/LevelPlay, AppLovin, Vungle, Mintegral, ...)
 *      -> mraid.open(url) — стандарт IAB для playable.
 *   2. Facebook / Meta Audience Network -> FbPlayableAd.onCTAClick().
 *   3. Google Ads (AdMob/AdX) -> ExitApi.exit().
 *   4. Фолбэк (обычный web/предпросмотр) -> window.open(url).
 *
 * Важно по правилам сетей: переход открывается ТОЛЬКО по явному клику
 * пользователя (никаких авто-редиректов) и один раз за клик.
 */
export function openStoreLink(url: string): void {
    const w: any = (typeof window !== 'undefined') ? window : (globalThis as any);
    try {
        // 1. MRAID — самый распространённый стандарт для playable.
        if (w.mraid && typeof w.mraid.open === 'function') {
            const state = (typeof w.mraid.getState === 'function') ? w.mraid.getState() : 'default';
            // открываем только когда контейнер готов (не в состоянии loading)
            if (state !== 'loading') { w.mraid.open(url); return; }
        }
        // 2. Facebook / Meta playable.
        if (w.FbPlayableAd && typeof w.FbPlayableAd.onCTAClick === 'function') {
            w.FbPlayableAd.onCTAClick();
            return;
        }
        // 3. Google Ads playable (AdMob/AdX).
        if (w.ExitApi && typeof w.ExitApi.exit === 'function') {
            w.ExitApi.exit();
            return;
        }
        // 4. Обычный браузер / предпросмотр.
        if (typeof w.open === 'function') { w.open(url, '_blank'); return; }
        if (w.location) { w.location.href = url; }
    } catch (e) {
        try { w.open(url, '_blank'); } catch (e2) { /* no-op */ }
    }
}
