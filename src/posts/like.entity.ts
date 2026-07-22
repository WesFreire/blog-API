import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Post } from './post.entity';
import { User } from 'src/users/user.entity';

@Entity()
@Unique(['userId', 'postId'])
export class Like {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  postId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Post, (post) => post.likes, { onDelete: 'CASCADE' })
  post: Post;

  @CreateDateColumn()
  createdAt: Date;
}
