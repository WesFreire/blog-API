import { forwardRef, Inject, Injectable, RequestTimeoutException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/providers/users.service';
import { SignInDto } from '../dtos/signin.dto';
import { HashingProvider } from './hashing.provider';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import jwtConfig from '../config/jwt.config';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { GenerateTokensProvider } from './generate-tokens.provider';

@Injectable()
export class SignInProvider {

  constructor(
    /**
     * Injecting usersService
     */
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    /**
     * Injecting hashingProvider
     */
    private readonly hashingProvider: HashingProvider,
    /**
     * Inject generateTokensProvider
     */
    private readonly generateTokensProvider: GenerateTokensProvider
  ) { }

  public async signIn(signInDto: SignInDto) {
    // Find User using email id
    // Throw an expection if user not found
    let user = await this.usersService.findOneByEmail(signInDto.email)

    // Compare password to the hash
    let isEqual: boolean = false

    try {
      isEqual = await this.hashingProvider.comparePassword(
        signInDto.password,
        user.password,
      )
    } catch (error) {
      throw new RequestTimeoutException(error, {
        description: 'Could not compare password'
      })
    }

    if (!isEqual) {
      throw new UnauthorizedException('Incorrect Password')
    }

    // Generate JWT Token

    return await this.generateTokensProvider.generateTokens(user)
  }
}
