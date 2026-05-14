import { Module } from '@nestjs/common';
import { UserModule } from './user.module';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './application/services/auth.service';
import { GoogleStrategy } from './infrastructure/auth/google.strategy';
import { JwtStrategy } from './infrastructure/auth/jwt.strategy';
import { AuthController } from './presentation/controllers/auth.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'super-secret-key',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, GoogleStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
