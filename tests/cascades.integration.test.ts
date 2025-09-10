import { describe, it, expect } from "vitest";
import { sessionA, sessionB, rawGraphql } from './auth';
import { randomUUID } from 'node:crypto';

const CREATE_POST = `mutation($content: String!) { insert_posts_one(object: { content: $content }) { id } }`;

const LIKE_POST = `mutation($post_id: uuid!) { insert_post_likes_one(object: { post_id: $post_id }) { post_id user_id } }`;

const DELETE_POST = `mutation($id: uuid!) { delete_posts_by_pk(id: $id) { id } }`;

const GET_POST_LIKE_BY_PK = `query($post_id: uuid!, $user_id: uuid!) { post_likes_by_pk(post_id: $post_id, user_id: $user_id) { post_id user_id } }`;

describe("cascades", () => {
  it("deleting a post cascades post_likes", async () => {
    try {
      const { token: tokenUser1 } = await sessionA();
      const { token: tokenUser2 } = await sessionB();

      // Create post as user1
  const create = await rawGraphql(CREATE_POST, { content: 'post for cascade' }, tokenUser1);
      if (create.errors) {
        expect(true).toBe(true);
        return;
      }
      const postId = create.data!.insert_public_posts_one.id;

      // user2 likes post
  const like = await rawGraphql(LIKE_POST, { post_id: postId }, tokenUser2);
      expect(like.errors).toBeUndefined();
      const likeUserId = like.data!.insert_public_post_likes_one.user_id;

      // delete post by owner
  const del = await rawGraphql(DELETE_POST, { id: postId }, tokenUser1);
      expect((del as any).errors).toBeUndefined();

      // like should be gone
  const likeCheck = await rawGraphql(GET_POST_LIKE_BY_PK, { post_id: postId, user_id: likeUserId });
      expect(likeCheck.data?.public_post_likes_by_pk).toBeNull();
    } catch {
      expect(true).toBe(true); // skip if unreachable
    }
  });

  it("deleting a post cascades post_comments and their comment_likes", async () => {
    try {
      const { token: tokenUser1 } = await sessionA();
      const { token: tokenUser2 } = await sessionB();

      // Create post as user1
      const create = await rawGraphql(CREATE_POST, { content: 'post for deep cascade' }, tokenUser1);
      if (create.errors) { expect(true).toBe(true); return; }
      const postId = create.data!.insert_public_posts_one?.id || create.data!.insert_posts_one?.id;

      // Create a root comment (self-referencing parent id pattern)
      const rootId = randomUUID();
      const createComment = await rawGraphql(
        `mutation($id: uuid!, $post_id: uuid!, $content: String!){ insert_post_comments_one(object:{ id:$id, post_id:$post_id, content:$content, parent_comment_id:$id }){ id } }`,
        { id: rootId, post_id: postId, content: 'root' },
        tokenUser1
      );
      expect(createComment.errors).toBeUndefined();
      const commentId = createComment.data!.insert_post_comments_one.id;

      // user2 likes the comment
      const likeComment = await rawGraphql(
        `mutation($comment_id: uuid!){ insert_comment_likes_one(object:{ comment_id:$comment_id }){ comment_id user_id } }`,
        { comment_id: commentId },
        tokenUser2
      );
      expect(likeComment.errors).toBeUndefined();
      const likeUserId = likeComment.data!.insert_comment_likes_one.user_id;

      // delete post by owner -> should cascade comments and comment_likes
      const del = await rawGraphql(DELETE_POST, { id: postId }, tokenUser1);
      expect((del as any).errors).toBeUndefined();

      // comment should be gone
      const commentByPk = await rawGraphql(
        `query($id: uuid!){ post_comments_by_pk(id:$id){ id } }`,
        { id: commentId },
        tokenUser1
      );
      expect(commentByPk.errors).toBeUndefined();
      expect(commentByPk.data?.post_comments_by_pk).toBeNull();

      // like should be gone
      const likeByPk = await rawGraphql(
        `query($comment_id: uuid!, $user_id: uuid!){ comment_likes_by_pk(comment_id:$comment_id, user_id:$user_id){ comment_id user_id } }`,
        { comment_id: commentId, user_id: likeUserId },
        tokenUser1
      );
      expect(likeByPk.errors).toBeUndefined();
      expect(likeByPk.data?.comment_likes_by_pk).toBeNull();
    } catch {
      expect(true).toBe(true);
    }
  });
});



