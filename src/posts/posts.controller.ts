import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PostsService } from './providers/posts.service';
import { LikesService } from './providers/likes.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatePostDto } from './dtos/create-post.dto';
import { PatchPostDto } from './dtos/patch-post.dto';
import { GetPostsDto } from './dtos/get-posts.dto';
import { ActiveUser } from 'src/auth/decorators/active-user.decorator';
import { ActiveUserData } from 'src/auth/interfaces/active-user-data.interface';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { AuthType } from 'src/auth/enum/auth-type.enum';

@Controller('posts')
@ApiTags('Posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly likesService: LikesService,
  ) {}

  @Get()
  @Auth(AuthType.Optional)
  @ApiOperation({ summary: 'List posts with likes metadata' })
  public getPosts(
    @Query() postQuery: GetPostsDto,
    @ActiveUser() user?: ActiveUserData,
  ) {
    return this.postsService.findAll(postQuery, user?.sub);
  }

  @Get(':postId')
  @Auth(AuthType.Optional)
  @ApiOperation({ summary: 'Get a post by id with likes metadata' })
  public getPost(
    @Param('postId', ParseIntPipe) postId: number,
    @ActiveUser() user?: ActiveUserData,
  ) {
    return this.postsService.findOne(postId, user?.sub);
  }

  @Post(':postId/likes')
  @ApiOperation({ summary: 'Like a published post' })
  @ApiResponse({
    status: 201,
    description: 'Like registered successfully',
  })
  public likePost(
    @Param('postId', ParseIntPipe) postId: number,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.likesService.like(postId, user.sub);
  }

  @Delete(':postId/likes')
  @ApiOperation({ summary: 'Remove like from a post' })
  @ApiResponse({
    status: 200,
    description: 'Like removed successfully',
  })
  public unlikePost(
    @Param('postId', ParseIntPipe) postId: number,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.likesService.unlike(postId, user.sub);
  }

  @ApiOperation({
    summary: 'Creates a new blog post',
  })
  @ApiResponse({
    status: 201,
    description: 'You get a 201 response if your post is created successfully',
  })
  @Post()
  public createPost(
    @Body() createPostDto: CreatePostDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.postsService.create(createPostDto, user);
  }

  @ApiOperation({
    summary: 'Updates an existing blog post',
  })
  @ApiResponse({
    status: 200,
    description: 'A 200 response if the post is updated successfully',
  })
  @Patch()
  public updatePost(@Body() patchPostDto: PatchPostDto) {
    return this.postsService.update(patchPostDto);
  }

  @Delete()
  public deletePost(@Query('id', ParseIntPipe) id: number) {
    return this.postsService.delete(id);
  }
}
