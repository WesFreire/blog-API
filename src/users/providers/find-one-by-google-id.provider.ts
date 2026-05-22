import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class FindOneByGoogleIdProvider {
    constructor(
        /**
         * Inject usersRepository
         */
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>
    ) { }

    public async findOneByGoogleId(googleId: string) {
        return await this.usersRepository.findOneBy({ googleId })
    }
}
