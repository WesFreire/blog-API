import { ConflictException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { GoogleUser } from '../interfaces/google-user.interface';

@Injectable()
export class CreateGoogleUserProvider {

    constructor(
        /**
         * Inject usersRepository
         */
        @InjectRepository(User)
        private readonly usersRepositoty: Repository<User>
    ) { }

    public async createGoogleUser(googleUser: GoogleUser) {
        try {
            const user = this.usersRepositoty.create(googleUser)
            return await this.usersRepositoty.save(user)

        } catch (error) {
            throw new ConflictException(error, {
                description: ' Could not create a new user'
            })
        }
    }
}