import { forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { GenerateTokensProvider } from './generate-tokens.provider';
import { UsersService } from 'src/users/providers/users.service';
import { ActiveUserData } from '../interfaces/active-user-data.interface';

@Injectable()
export class RefreshTokensProvider {


    constructor(
        /**
         * InjectService
         */
        private readonly jwtService: JwtService,
        /**
         * Inject jwtConfiguration
         */
        @Inject(jwtConfig.KEY)
        private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,
        /**
         * Inject generateTokensProvider
         */
        private readonly generateTokensProvider: GenerateTokensProvider,
        /**
            * Injecting usersService
            */
        @Inject(forwardRef(() => UsersService))
        private readonly usersService: UsersService,
    ) { }

    public async refreshTokens(refreshTokenDto: RefreshTokenDto) {
        try {
            // verify the refresh token using jwtServide
            const { sub } = await this.jwtService.verifyAsync<
                Pick<ActiveUserData, 'sub'>
            >(refreshTokenDto.refreshToken, {
                secret: this.jwtConfiguration.secret,
                audience: this.jwtConfiguration.audience,
                issuer: this.jwtConfiguration.issuer
            })

            // fetch user from the 
            const user = await this.usersService.findOneById(sub)

            // generate the tokens
            return await this.generateTokensProvider.generateTokens(user)
        } catch (error) {
            throw new UnauthorizedException(error)
        }
    }
}
