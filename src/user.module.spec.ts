import { Test, TestingModule } from '@nestjs/testing';
import { UserModule } from './user.module';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './infrastructure/database/schemas/user.schema';

describe('UserModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [UserModule],
    })
      .overrideProvider(getModelToken(User.name))
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });
});
