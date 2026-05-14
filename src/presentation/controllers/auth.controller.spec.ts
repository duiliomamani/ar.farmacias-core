import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../../application/services/auth.service';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let configService: ConfigService;

  const mockAuthService = {
    login: jest.fn().mockResolvedValue({ access_token: 'mock-token' }),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://frontend.com'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleAuthRedirect', () => {
    it('should login and redirect to frontend with token', async () => {
      const mockReq = { user: { email: 'test@test.com' } } as any;
      const mockRes = {
        redirect: jest.fn(),
      } as unknown as Response;

      await controller.googleAuthRedirect(mockReq, mockRes);

      expect(authService.login).toHaveBeenCalledWith(mockReq.user);
      expect(mockRes.redirect).toHaveBeenCalledWith('http://frontend.com/auth?token=mock-token');
    });
  });
});
