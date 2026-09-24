type ColorToken = '--color-sage' | '--color-sage-hover' | '--color-muted' | '--color-on-sage' | '--color-surface' | '--color-canvas' | '--color-sage-soft' | '--color-border';

function tokenColor(token: ColorToken): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Token CSS ${token} precisa ser uma cor hexadecimal de seis dígitos: "${value}"`);
  }

  return value;
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: ColorToken, background: ColorToken): number {
  const first = luminance(tokenColor(foreground));
  const second = luminance(tokenColor(background));

  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe('Acessibilidade: contraste dos tokens globais', () => {
  const root = document.documentElement;
  let previousTheme: string | null;

  beforeEach(() => {
    previousTheme = root.getAttribute('data-theme');
    root.removeAttribute('data-theme');
  });

  afterEach(() => {
    if (previousTheme === null) {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', previousTheme);
    }
  });

  it('garante pelo menos 4,5:1 nas combinações comuns do tema claro', () => {
    const pairs: Array<[ColorToken, ColorToken]> = [
      ['--color-sage', '--color-surface'],
      ['--color-sage', '--color-canvas'],
      ['--color-sage', '--color-sage-soft'],
      ['--color-muted', '--color-surface'],
      ['--color-muted', '--color-canvas'],
      ['--color-muted', '--color-border'],
      ['--color-on-sage', '--color-sage'],
      ['--color-on-sage', '--color-sage-hover'],
    ];

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background))
        .withContext(`${foreground} sobre ${background}`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it('garante pelo menos 4,5:1 nas combinações comuns do tema escuro', () => {
    root.setAttribute('data-theme', 'dark');

    const pairs: Array<[ColorToken, ColorToken]> = [
      ['--color-sage', '--color-surface'],
      ['--color-sage', '--color-canvas'],
      ['--color-muted', '--color-surface'],
      ['--color-muted', '--color-canvas'],
      ['--color-muted', '--color-border'],
      ['--color-on-sage', '--color-sage'],
      ['--color-on-sage', '--color-sage-hover'],
    ];

    for (const [foreground, background] of pairs) {
      expect(contrastRatio(foreground, background))
        .withContext(`Tema escuro: ${foreground} sobre ${background}`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });
});
