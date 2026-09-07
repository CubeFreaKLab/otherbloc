export const themeOptions = ['light', 'dark', 'system']
export const themeStorageKey = 'otherbloc-theme'

export function resolveTheme(preference, systemDark) {
  return preference === 'dark' || (preference === 'system' && systemDark) ? 'dark' : 'light'
}

export function readThemePreference(storage) {
  try {
    const value = (storage ?? window.localStorage).getItem(themeStorageKey)
    return themeOptions.includes(value) ? value : 'system'
  } catch {
    return 'system'
  }
}
