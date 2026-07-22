import * as request from 'supertest';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { postStatus } from '../src/posts/enums/postStatus.enum';
import { postType } from '../src/posts/enums/postType.enum';

describe('Likes (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let publishedPostId: number;
  let draftPostId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    const uniqueEmail = `likes-e2e-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/users')
      .send({
        firstName: 'Like',
        lastName: 'Tester',
        email: uniqueEmail,
        password: 'Password1!',
      })
      .expect(201);

    const signInResponse = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({
        email: uniqueEmail,
        password: 'Password1!',
      })
      .expect(200);

    accessToken = signInResponse.body.data.accessToken;

    const publishedPostResponse = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Published post for likes',
        postType: postType.POST,
        slug: `published-likes-${Date.now()}`,
        status: postStatus.PUBLISHED,
        content: 'Published content',
        tags: [],
      })
      .expect(201);

    publishedPostId = publishedPostResponse.body.data.id;

    const draftPostResponse = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Draft post for likes',
        postType: postType.POST,
        slug: `draft-likes-${Date.now()}`,
        status: postStatus.DRAFT,
        content: 'Draft content',
        tags: [],
      })
      .expect(201);

    draftPostId = draftPostResponse.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('CA-05: rejects like without authentication', () => {
    return request(app.getHttpServer())
      .post(`/posts/${publishedPostId}/likes`)
      .expect(401);
  });

  it('CA-01: likes a published post successfully', async () => {
    const response = await request(app.getHttpServer())
      .post(`/posts/${publishedPostId}/likes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        postId: publishedPostId,
        likedByMe: true,
        likesCount: 1,
      }),
    );
  });

  it('CA-02: rejects duplicate like', () => {
    return request(app.getHttpServer())
      .post(`/posts/${publishedPostId}/likes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });

  it('CA-08: list includes likedByMe for authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .get('/posts?page=1&limit=50')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const likedPost = response.body.data.data.find(
      (post: { id: number }) => post.id === publishedPostId,
    );

    expect(likedPost).toEqual(
      expect.objectContaining({
        likesCount: 1,
        likedByMe: true,
      }),
    );
  });

  it('CA-07: list includes likesCount for visitor', async () => {
    const response = await request(app.getHttpServer())
      .get('/posts?page=1&limit=50')
      .expect(200);

    const likedPost = response.body.data.data.find(
      (post: { id: number }) => post.id === publishedPostId,
    );

    expect(likedPost).toEqual(
      expect.objectContaining({
        likesCount: 1,
        likedByMe: false,
      }),
    );
  });

  it('CA-03: unlikes a post successfully', async () => {
    const response = await request(app.getHttpServer())
      .delete(`/posts/${publishedPostId}/likes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        postId: publishedPostId,
        likedByMe: false,
        likesCount: 0,
      }),
    );
  });

  it('CA-04: rejects unlike when like does not exist', () => {
    return request(app.getHttpServer())
      .delete(`/posts/${publishedPostId}/likes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('CA-06: rejects like on non-existent post', () => {
    return request(app.getHttpServer())
      .post('/posts/999999/likes')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  it('CA-09: rejects like on non-published post', () => {
    return request(app.getHttpServer())
      .post(`/posts/${draftPostId}/likes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('returns post detail with likes metadata', async () => {
    await request(app.getHttpServer())
      .post(`/posts/${publishedPostId}/likes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/posts/${publishedPostId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.objectContaining({
        id: publishedPostId,
        likesCount: 1,
        likedByMe: true,
      }),
    );
  });

  it('CA-10: removes likes when post is deleted', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Post to delete with likes',
        postType: postType.POST,
        slug: `delete-likes-${Date.now()}`,
        status: postStatus.PUBLISHED,
        content: 'To be deleted',
        tags: [],
      })
      .expect(201);

    const postId = createResponse.body.data.id;

    await request(app.getHttpServer())
      .post(`/posts/${postId}/likes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/posts?id=${postId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/posts/${postId}/likes`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
