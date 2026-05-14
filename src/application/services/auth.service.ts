import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../infrastructure/database/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async login(user: UserDocument) {
    const payload = { 
      email: user.email, 
      sub: user._id, 
      role: user.role 
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateGoogleUser(googleUser: any): Promise<UserDocument> {
    const { email, googleId, displayName, avatarUrl } = googleUser;

    // Check if user exists by email or googleId
    let user = await this.userModel.findOne({ 
      $or: [{ googleId }, { email }] 
    });

    if (user) {
      // Update existing user info
      user.displayName = displayName;
      user.avatarUrl = avatarUrl;
      user.lastLoginAt = new Date();
      return await user.save();
    }

    // Create new user if not found
    user = await this.userModel.create({
      email,
      googleId,
      displayName,
      avatarUrl,
      lastLoginAt: new Date(),
    });

    return user;
  }
}
