export const themeOptions = ['light', 'dark']
export const themeStorageKey = 'otherbloc-theme'

export function resolveTheme(preference) {
  return preference === 'dark' ? 'dark' : 'light'
}

export function readThemePreference(storage) {
  try {
    const value = (storage ?? window.localStorage).getItem(themeStorageKey)
    return value === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}
