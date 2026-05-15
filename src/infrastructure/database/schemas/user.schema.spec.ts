import { User, UserSchema, UserRole } from './user.schema';

describe('UserSchema', () => {
  it('should be defined', () => {
    expect(UserSchema).toBeDefined();
  });

  it('should have the correct metadata for defaults', () => {
    const rolePath: any = UserSchema.path('role');
    const trustScorePath: any = UserSchema.path('trustScore');
    const isActivePath: any = UserSchema.path('isActive');

    expect(rolePath.options.default).toBe(UserRole.USER);
    expect(trustScorePath.options.default).toBe(10);
    expect(isActivePath.options.default).toBe(true);
  });

  it('should allow setting properties on the class', () => {
    const user = new User();
    user.email = 'test@example.com';
    user.role = UserRole.ADMIN;
    
    expect(user.email).toBe('test@example.com');
    expect(user.role).toBe(UserRole.ADMIN);
  });
});
