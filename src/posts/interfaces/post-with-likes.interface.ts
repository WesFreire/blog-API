import { Post } from '../post.entity';

export interface PostWithLikes extends Post {
  likesCount: number;
  likedByMe: boolean;
}
