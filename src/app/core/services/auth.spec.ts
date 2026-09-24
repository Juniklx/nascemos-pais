import {
  TestBed,
} from '@angular/core/testing';

import {
  User,
  UserCredential,
} from 'firebase/auth';

import {
  FirebaseAuthGateway,
} from '../firebase/firebase-auth.gateway';

import {
  AuthService,
} from './auth';

describe('AuthService', () => {
  let service: AuthService;

  let authListener:
    (user: User | null) => void;

  let currentUser:
    User | null;

  let gateway: {
    readonly currentUser:
      User | null;

    observe:
      jasmine.Spy;

    waitUntilReady:
      jasmine.Spy;

    register:
      jasmine.Spy;

    login:
      jasmine.Spy;

    loginWithGoogle:
      jasmine.Spy;

    logout:
      jasmine.Spy;
  };

  beforeEach(() => {
    currentUser = null;

    gateway = {
      get currentUser() {
        return currentUser;
      },

      observe:
        jasmine
          .createSpy('observe')
          .and.callFake(
            (
              next:
                (user: User | null) =>
                  void,
            ) => {
              authListener = next;

              return () => {};
            },
          ),

      waitUntilReady:
        jasmine
          .createSpy('waitUntilReady')
          .and.resolveTo(),

      register:
        jasmine.createSpy(
          'register',
        ),

      login:
        jasmine.createSpy(
          'login',
        ),

      loginWithGoogle:
        jasmine.createSpy(
          'loginWithGoogle',
        ),

      logout:
        jasmine.createSpy(
          'logout',
        ),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        {
          provide:
            FirebaseAuthGateway,

          useValue:
            gateway,
        },
      ],
    });

    service =
      TestBed.inject(AuthService);
  });

  it(
    'atualiza o usuário ao receber mudança de sessão',
    () => {
      const user = {
        email:
          'teste@nascemospais.com',

        displayName:
          'Teste',
      } as User;

      authListener(user);

      expect(
        service.isAuthenticated(),
      ).toBeTrue();

      expect(
        service.email(),
      ).toBe(
        'teste@nascemospais.com',
      );

      expect(
        service.displayName(),
      ).toBe('Teste');
    },
  );

  it(
    'restaura a sessão antes de verificar autenticação',
    async () => {
      currentUser = {
        email:
          'usuario@nascemospais.com',
      } as User;

      await service.waitUntilReady();

      expect(
        gateway.waitUntilReady,
      ).toHaveBeenCalled();

      expect(
        service.isAuthenticated(),
      ).toBeTrue();
    },
  );

  it(
    'cadastra com e-mail normalizado',
    async () => {
      gateway.register.and.returnValue(
        Promise.resolve(
          {} as UserCredential,
        ),
      );

      const result =
        await service.register(
          '  teste@email.com  ',
          '123456',
        );

      expect(result).toBeTrue();

      expect(
        gateway.register,
      ).toHaveBeenCalledOnceWith(
        'teste@email.com',
        '123456',
      );

      expect(
        service.error(),
      ).toBeNull();
    },
  );

  it(
    'apresenta mensagem clara quando o login falha',
    async () => {
      gateway.login.and.returnValue(
        Promise.reject({
          code:
            'auth/invalid-credential',
        }),
      );

      const result =
        await service.login(
          'teste@email.com',
          'senha-incorreta',
        );

      expect(result).toBeFalse();

      expect(
        service.error(),
      ).toBe(
        'E-mail ou senha incorretos. ' +
          'Confira os dados e tente novamente.',
      );
    },
  );

  it('identifica quando o domínio do login com Google não está autorizado', async () => {
    gateway.loginWithGoogle.and.rejectWith({ code: 'auth/unauthorized-domain' });

    const result = await service.loginWithGoogle();

    expect(result).toBeFalse();
    expect(service.error()).toContain('não está autorizado para entrar com Google');
  });

  it(
    'encerra a sessão pelo gateway',
    async () => {
      gateway.logout.and.returnValue(
        Promise.resolve(),
      );

      const result =
        await service.logout();

      expect(result).toBeTrue();

      expect(
        gateway.logout,
      ).toHaveBeenCalled();
    },
  );
});
