import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { User, UserRole } from '../../infrastructure/database/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let model: any;
  let jwtService: JwtService;

  const mockUser = {
    _id: 'user-id',
    email: 'test@test.com',
    role: UserRole.USER,
    displayName: 'Test User',
    save: jest.fn().mockResolvedValue(this),
  };

  const mockUserModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    model = module.get(getModelToken(User.name));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return an access token', async () => {
      const result = await service.login(mockUser as any);
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toEqual({ access_token: 'mock-token' });
    });
  });

  describe('validateGoogleUser', () => {
    const googleUser = {
      email: 'test@test.com',
      googleId: 'google-id',
      displayName: 'Test User',
      avatarUrl: 'photo-url',
    };

    it('should update and return existing user if found', async () => {
      const existingUser = {
        ...mockUser,
        save: jest.fn().mockResolvedValue({ ...mockUser, lastLoginAt: expect.any(Date) }),
      };
      model.findOne.mockResolvedValue(existingUser);

      const result = await service.validateGoogleUser(googleUser);

      expect(model.findOne).toHaveBeenCalledWith({
        $or: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
      });
      expect(existingUser.save).toHaveBeenCalled();
      expect(result.displayName).toBe(googleUser.displayName);
    });

    it('should create and return new user if not found', async () => {
      model.findOne.mockResolvedValue(null);
      model.create.mockResolvedValue(mockUser);

      const result = await service.validateGoogleUser(googleUser);

      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
        email: googleUser.email,
        googleId: googleUser.googleId,
      }));
      expect(result).toEqual(mockUser);
    });
  });
});
