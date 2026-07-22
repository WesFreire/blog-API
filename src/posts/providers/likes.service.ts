import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Like } from '../like.entity';
import { Post } from '../post.entity';
import { postStatus } from '../enums/postStatus.enum';
import { LikeActionResponseDto } from '../dtos/like-action-response.dto';
import { PostWithLikes } from '../interfaces/post-with-likes.interface';

@Injectable()
export class LikesService {
  constructor(
    @InjectRepository(Like)
    private readonly likesRepository: Repository<Like>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  public async like(
    postId: number,
    userId: number,
  ): Promise<LikeActionResponseDto> {
    const post = await this.findPublishedPostOrThrow(postId);

    const existingLike = await this.likesRepository.findOneBy({
      userId,
      postId: post.id,
    });

    if (existingLike) {
      throw new ConflictException('You have already liked this post');
    }

    try {
      await this.likesRepository.save(
        this.likesRepository.create({ userId, postId: post.id }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('You have already liked this post');
      }
      throw error;
    }

    return this.buildLikeActionResponse(post.id, userId);
  }

  public async unlike(
    postId: number,
    userId: number,
  ): Promise<LikeActionResponseDto> {
    const post = await this.postsRepository.findOneBy({ id: postId });

    if (!post) {
      throw new NotFoundException('The post Id does not exist');
    }

    const existingLike = await this.likesRepository.findOneBy({
      userId,
      postId: post.id,
    });

    if (!existingLike) {
      throw new NotFoundException('Like not found for this post');
    }

    await this.likesRepository.remove(existingLike);

    return this.buildLikeActionResponse(post.id, userId);
  }

  public async enrichPostsWithLikes(
    posts: Post[],
    userId?: number,
  ): Promise<PostWithLikes[]> {
    if (posts.length === 0) {
      return [];
    }

    const postIds = posts.map((post) => post.id);
    const likesCountByPostId = await this.getLikesCountByPostIds(postIds);
    const likedPostIds = userId
      ? await this.getLikedPostIds(userId, postIds)
      : new Set<number>();

    return posts.map((post) => ({
      ...post,
      likesCount: likesCountByPostId.get(post.id) ?? 0,
      likedByMe: userId ? likedPostIds.has(post.id) : false,
    }));
  }

  public async enrichPostWithLikes(
    post: Post,
    userId?: number,
  ): Promise<PostWithLikes> {
    const [enrichedPost] = await this.enrichPostsWithLikes([post], userId);
    return enrichedPost;
  }

  private async findPublishedPostOrThrow(postId: number): Promise<Post> {
    const post = await this.postsRepository.findOneBy({ id: postId });

    if (!post) {
      throw new NotFoundException('The post Id does not exist');
    }

    if (post.status !== postStatus.PUBLISHED) {
      throw new ForbiddenException('Only published posts can be liked');
    }

    return post;
  }

  private async buildLikeActionResponse(
    postId: number,
    userId: number,
  ): Promise<LikeActionResponseDto> {
    const likesCount = await this.likesRepository.count({
      where: { postId },
    });

    const likedByMe = await this.likesRepository.existsBy({ postId, userId });

    return {
      postId,
      likesCount,
      likedByMe,
    };
  }

  private async getLikesCountByPostIds(
    postIds: number[],
  ): Promise<Map<number, number>> {
    const rows = await this.likesRepository
      .createQueryBuilder('like')
      .select('like.postId', 'postId')
      .addSelect('COUNT(like.id)', 'count')
      .where('like.postId IN (:...postIds)', { postIds })
      .groupBy('like.postId')
      .getRawMany<{ postId: string; count: string }>();

    return new Map(
      rows.map((row) => [Number(row.postId), Number(row.count)]),
    );
  }

  private async getLikedPostIds(
    userId: number,
    postIds: number[],
  ): Promise<Set<number>> {
    const likes = await this.likesRepository.find({
      where: { userId, postId: In(postIds) },
      select: ['postId'],
    });

    return new Set(likes.map((like) => like.postId));
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
