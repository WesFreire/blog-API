import { MetaOption } from 'src/meta-options/meta-option.entity';
import { Module } from '@nestjs/common';
import { Post } from './post.entity';
import { Like } from './like.entity';
import { PostsController } from './posts.controller';
import { PostsService } from './providers/posts.service';
import { LikesService } from './providers/likes.service';
import { TagsModule } from 'src/tags/tags.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { PaginationModule } from 'src/common/pagination/pagination.module';
import { CreatePostProvider } from './providers/create-post.provider';

@Module({
  controllers: [PostsController],
  providers: [PostsService, CreatePostProvider, LikesService],
  imports: [
    UsersModule,
    TagsModule,
    PaginationModule,
    TypeOrmModule.forFeature([Post, MetaOption, Like]),
  ],
})
export class PostsModule {}
