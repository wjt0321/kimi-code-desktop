import type { DesktopThemeSnapshot, ResolvedTheme, ThemePreference } from '../../shared/contracts';
import type { DesktopPreferencesStore } from '../preferences/desktop-preferences';

export interface NativeThemePort {
  themeSource: 'system' | 'light' | 'dark';
  readonly shouldUseDarkColors: boolean;
  on(event: 'updated', listener: () => void): void;
  off(event: 'updated', listener: () => void): void;
}

export class DesktopThemeService {
  #snapshot: DesktopThemeSnapshot;
  #listeners = new Set<(snapshot: DesktopThemeSnapshot) => void>();
  #nativeListener = () => this.#handleNativeUpdate();

  constructor(
    private readonly nativeTheme: NativeThemePort,
    private readonly store: DesktopPreferencesStore,
  ) {
    this.#snapshot = { preference: 'system', resolved: resolveTheme('system', nativeTheme.shouldUseDarkColors) };
    this.nativeTheme.on('updated', this.#nativeListener);
  }

  async initialize(): Promise<DesktopThemeSnapshot> {
    const preferences = await this.store.read();
    this.nativeTheme.themeSource = preferences.theme;
    this.#snapshot = { preference: preferences.theme, resolved: resolveTheme(preferences.theme, this.nativeTheme.shouldUseDarkColors) };
    return this.#snapshot;
  }

  snapshot(): DesktopThemeSnapshot {
    return this.#snapshot;
  }

  async setPreference(preference: ThemePreference): Promise<DesktopThemeSnapshot> {
    await this.store.write({ theme: preference });
    this.nativeTheme.themeSource = preference;
    this.#setSnapshot({ preference, resolved: resolveTheme(preference, this.nativeTheme.shouldUseDarkColors) });
    return this.#snapshot;
  }

  onSnapshot(listener: (snapshot: DesktopThemeSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.nativeTheme.off('updated', this.#nativeListener);
    this.#listeners.clear();
  }

  #handleNativeUpdate(): void {
    if (this.#snapshot.preference !== 'system') return;
    this.#setSnapshot({ preference: 'system', resolved: resolveTheme('system', this.nativeTheme.shouldUseDarkColors) });
  }

  #setSnapshot(snapshot: DesktopThemeSnapshot): void {
    if (snapshot.preference === this.#snapshot.preference && snapshot.resolved === this.#snapshot.resolved) return;
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener(snapshot);
  }
}

function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemDark ? 'dark' : 'light';
}
