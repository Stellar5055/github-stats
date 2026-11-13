export type Theme = 'light' | 'dark';

/** Keep the key and colors in sync with the inline bootstrap in the HTML. */
export const THEME_STORAGE_KEY = 'ghs:theme';

export const THEME_COLORS: Record<Theme, string> = {
  light: '#fafaf7',
  dark: '#181816',
};

let explicitTheme: Theme | null = null;
let initialized = false;

export function parseTheme(value: string | null | undefined): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function resolveTheme(
  stored: string | null | undefined,
  systemDark: boolean,
): Theme {
  return parseTheme(stored) ?? (systemDark ? 'dark' : 'light');
}

export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light';
}

function readStoredTheme(): Theme | null {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function updateThemeColor(theme: Theme): void {
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme]);
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  updateThemeColor(theme);
  syncThemeButtons();
}

function persistTheme(theme: Theme): void {
  explicitTheme = theme;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or quota exceeded. The choice still lasts for this page.
  }
}

export function syncThemeButtons(): void {
  const theme = currentTheme();
  const next = otherTheme(theme);
  const label = next === 'dark' ? 'Dark' : 'Light';
  const description = `Switch to ${next} theme`;

  document
    .querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')
    .forEach((button) => {
      button.textContent = label;
      button.setAttribute('aria-label', description);
      button.title = description;
      button.dataset.themeState = theme;
    });
}

export function initTheme(): void {
  if (initialized) return;
  initialized = true;

  explicitTheme = readStoredTheme();
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  applyTheme(resolveTheme(explicitTheme, media.matches));

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>('[data-theme-toggle]');
    if (!button) return;

    const theme = otherTheme(currentTheme());
    applyTheme(theme);
    persistTheme(theme);
  });

  media.addEventListener('change', (event) => {
    if (explicitTheme) return;
    applyTheme(event.matches ? 'dark' : 'light');
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;

    explicitTheme = parseTheme(event.newValue);
    applyTheme(resolveTheme(explicitTheme, media.matches));
  });
}
