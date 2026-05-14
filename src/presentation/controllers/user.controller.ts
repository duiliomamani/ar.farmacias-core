import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../infrastructure/database/schemas/user.schema';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('users')
@Controller('api/users')
export class UserController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile and points' })
  @ApiResponse({ status: 200, description: 'User profile data' })
  async getProfile(@Req() req: any) {
    const user = await this.userModel.findById(req.user.userId);
    if (!user) {
      return {
        trustScore: 0,
        role: 'USER',
        email: req.user.email,
      };
    }

    return {
      id: user._id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      trustScore: user.trustScore || 0,
    };
  }
}
