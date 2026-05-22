import { forwardRef, Inject, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import jwtConfig from 'src/auth/config/jwt.config';
import { GoogleTokenDto } from '../dtos/google-token.dto';
import { UsersService } from 'src/users/providers/users.service';
import { GenerateTokensProvider } from 'src/auth/providers/generate-tokens.provider';

@Injectable()
export class GoogleAuthenticationService implements OnModuleInit {
    private oauthClient: OAuth2Client

    constructor(
        /**
         * Inject jwtConfiguration
         */
        @Inject(jwtConfig.KEY)
        private readonly jwtConfiguration: ConfigType<typeof jwtConfig>,

        /** 
         * Inject usersService
         */
        @Inject(forwardRef(() => UsersService))
        private readonly usersService: UsersService,

        /**
         * Unject generateTokensProvider
         */
        private readonly generateTokensProvider: GenerateTokensProvider
    ) { }

    onModuleInit() {
        const clientId = this.jwtConfiguration.googleClientId
        const clientSecret = this.jwtConfiguration.googleClientSecret
        this.oauthClient = new OAuth2Client(clientId, clientSecret)
    }

    public async authenticate(googleTokenDto: GoogleTokenDto) {


        try {// verify the google token sent by User
            const loginTicket = await this.oauthClient.verifyIdToken({
                idToken: googleTokenDto.token
            })
            // extract the payload from google JWT
            const {
                email,
                sub: googleId,
                given_name: firstName,
                family_name: lastName,
            } = loginTicket.getPayload()
            // find the user in the database using the GoogleId
            const user = await this.usersService.findOneByGoogleId(googleId)
            // I googleId exist generate 
            if (user) {
                return this.generateTokensProvider.generateTokens(user)
            }
            // if not create a new User and then generate tokens
            const newUser = await this.usersService.createGoogleUser({
                email: email,
                firstName: firstName,
                lastName: lastName,
                googleId: googleId
            })

            return this.generateTokensProvider.generateTokens(newUser)
        } catch (error) {
            // throw unauthorised exception
            throw new UnauthorizedException(error)
        }
    }
}
