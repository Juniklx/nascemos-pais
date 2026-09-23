import { normalizeInviteReturnUrl } from './invite-return-url';

describe('normalizeInviteReturnUrl', () => {
  it('aceita rota interna de convite', () => {
    const token = 'a'.repeat(64);

    expect(normalizeInviteReturnUrl(`/invite/${token}`)).toBe(`/invite/${token}`);
  });

  it('aceita token com limite máximo', () => {
    const token = 'a'.repeat(128);

    expect(normalizeInviteReturnUrl(`/invite/${token}`)).toBe(`/invite/${token}`);
  });

  it('recusa valor ausente', () => {
    expect(normalizeInviteReturnUrl(null)).toBeNull();
  });

  it('recusa endereço externo', () => {
    expect(normalizeInviteReturnUrl('https://exemplo.com')).toBeNull();
  });

  it('recusa token inválido', () => {
    expect(normalizeInviteReturnUrl('/invite/curto')).toBeNull();

    expect(normalizeInviteReturnUrl(`/invite/${'a'.repeat(32)}/outro`)).toBeNull();
  });
});
