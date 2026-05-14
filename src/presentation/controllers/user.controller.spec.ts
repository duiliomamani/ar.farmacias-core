import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { getModelToken } from '@nestjs/mongoose';
import { User } from '../../infrastructure/database/schemas/user.schema';

describe('UserController', () => {
  let controller: UserController;
  let model: any;

  const mockUserModel = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    model = module.get(getModelToken(User.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return default profile if user not found', async () => {
    mockUserModel.findById.mockResolvedValue(null);
    const req = { user: { userId: '123', email: 'test@test.com' } };

    const result = await controller.getProfile(req);
    
    expect(result.data).toEqual({
      trustScore: 0,
      role: 'USER',
      email: 'test@test.com',
    });
  });

  it('should return user profile if user is found', async () => {
    mockUserModel.findById.mockResolvedValue({
      _id: '123',
      email: 'test@test.com',
      displayName: 'Test User',
      avatarUrl: 'http://test.com/img.jpg',
      role: 'ADMIN',
      trustScore: 50,
    });
    const req = { user: { userId: '123' } };

    const result = await controller.getProfile(req);

    expect(result.data).toEqual({
      id: '123',
      email: 'test@test.com',
      displayName: 'Test User',
      avatarUrl: 'http://test.com/img.jpg',
      role: 'ADMIN',
      trustScore: 50,
    });
  });
});
