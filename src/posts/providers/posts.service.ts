import {
  BadRequestException,
  Body,
  Injectable,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import { UsersService } from 'src/users/providers/users.service';
import { CreatePostDto } from '../dtos/create-post.dto';
import { Repository } from 'typeorm';
import { Post } from '../post.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MetaOption } from 'src/meta-options/meta-option.entity';
import { TagsService } from 'src/tags/providers/tags.service';
import { PatchPostDto } from '../dtos/patch-post.dto';
import { GetPostsDto } from '../dtos/get-posts.dto';
import { PaginationProvider } from 'src/common/pagination/providers/pagination.provider';
import { Paginated } from 'src/common/pagination/interfaces/paginated.interface';
import { CreatePostProvider } from './create-post.provider';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { LikesService } from './likes.service';
import { PostWithLikes } from '../interfaces/post-with-likes.interface';

@Injectable()
export class PostsService {
  constructor(
    /*
     * Injecting Users Service
     */
    private readonly usersService: UsersService,
    /**
     * Inject postsRepository
     */
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    /**
     * inject metaOptionsRepository
     */
    @InjectRepository(MetaOption)
    private readonly metaOptionsRepository: Repository<MetaOption>,
    /**
     * Inject TagsService
     */
    private readonly tagsService: TagsService,

    /**
     * Injects PaginationProvider
     */
    private readonly paginationProvider: PaginationProvider,

    /**
     * Inject createPostProvider
     */
    private readonly createPostProvider: CreatePostProvider,

    /**
     * Inject LikesService
     */
    private readonly likesService: LikesService,
  ) { }

  /**
   * Creating new posts
   */
  public async create(@Body() createPostDto: CreatePostDto, user: ActiveUserData) {
    // return the post
    return this.createPostProvider.create(createPostDto, user)
  }

  public async findAll(
    postQuery: GetPostsDto,
    userId?: number,
  ): Promise<Paginated<PostWithLikes>> {
    const paginatedPosts = await this.paginationProvider.paginateQuery(
      {
        limit: postQuery.limit,
        page: postQuery.page,
      },
      this.postsRepository,
    );

    paginatedPosts.data = await this.likesService.enrichPostsWithLikes(
      paginatedPosts.data,
      userId,
    );

    return paginatedPosts as Paginated<PostWithLikes>;
  }

  public async findOne(
    postId: number,
    userId?: number,
  ): Promise<PostWithLikes> {
    let post: Post | null;

    try {
      post = await this.postsRepository.findOneBy({ id: postId });
    } catch (error) {
      throw new RequestTimeoutException(
        'Unable to process your request at the moment please try later',
        {
          description: 'Error connecting to the database',
        },
      );
    }

    if (!post) {
      throw new NotFoundException('The post Id does not exist');
    }

    return this.likesService.enrichPostWithLikes(post, userId);
  }

  public async update(patchPostDto: PatchPostDto) {
    let tags = undefined;
    let post = undefined;

    // Find the Tags
    try {
      tags = await this.tagsService.findMultipleTags(patchPostDto.tags);
    } catch (error) {
      throw new RequestTimeoutException(
        'Unable to process your request at the moment please try later',
        {
          description: 'Error connecting to the database',
        },
      );
    }

    /**
     * If tags were not found
     * Need to be equal number of tags
     */
    if (!tags || tags.length !== patchPostDto.tags.length) {
      throw new BadRequestException(
        'Please check your tag Ids and ensure they are correct',
      );
    }

    // Find the Post
    try {
      // Returns null if the post does not exist
      post = await this.postsRepository.findOneBy({
        id: patchPostDto.id,
      });
    } catch (error) {
      throw new RequestTimeoutException(
        'Unable to process your request at the moment please try later',
        {
          description: 'Error connecting to the database',
        },
      );
    }

    if (!post) {
      throw new BadRequestException('The post Id does not exist');
    }

    // Update the properties
    post.title = patchPostDto.title ?? post.title;
    post.content = patchPostDto.content ?? post.content;
    post.status = patchPostDto.status ?? post.status;
    post.postType = patchPostDto.postType ?? post.postType;
    post.slug = patchPostDto.slug ?? post.slug;
    post.featuredImageUrl =
      patchPostDto.featuredImageUrl ?? post.featuredImageUrl;
    post.publishOn = patchPostDto.publishOn ?? post.publishOn;

    // Assign the new tags
    post.tags = tags;

    // Save the post and return
    try {
      await this.postsRepository.save(post);
    } catch (error) {
      throw new RequestTimeoutException(
        'Unable to process your request at the moment please try later',
        {
          description: 'Error connecting to the database',
        },
      );
    }
    return post;
  }

  public async delete(id: number) {
    // Deleting the post
    await this.postsRepository.delete(id);
    // confirmation
    return { deleted: true, id };
  }
}
