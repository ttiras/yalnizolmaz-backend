import { describe, it, expect } from "vitest";
import { sessionA, sessionB, rawGraphql } from './auth';
import { randomUUID } from 'node:crypto';

const CREATE_POST = `mutation($content: String!) { insert_posts_one(object: { content: $content }) { id } }`;
// Create top-level comment: omit parent_comment_id entirely
const CREATE_COMMENT_TOP = `mutation($id: uuid!, $post_id: uuid!, $content: String!) { insert_post_comments_one(object: { id: $id, post_id: $post_id, content: $content, parent_comment_id: $id }) { id user_id content parent_comment_id } }`;
// Create with explicit parent (used for invalid FK test)
const CREATE_COMMENT_WITH_PARENT = `mutation($post_id: uuid!, $content: String!, $parent_comment_id: uuid!) { insert_post_comments_one(object: { post_id: $post_id, content: $content, parent_comment_id: $parent_comment_id }) { id user_id content parent_comment_id } }`;
const UPDATE_COMMENT = `mutation($id: uuid!, $content: String!) { update_post_comments_by_pk(pk_columns: { id: $id }, _set: { content: $content }) { id content } }`;
const DELETE_COMMENT = `mutation($id: uuid!) { delete_post_comments_by_pk(id: $id) { id } }`;

// Query helpers
const SELECT_COMMENT_BY_PK = `query($id: uuid!) { post_comments_by_pk(id: $id) { id user_id content parent_comment_id } }`;

describe("post_comments integration", () => {
  it("invalid parent_comment_id FK should error", async () => {
    const { token } = await sessionA();
    // Create a post first
    const created = await rawGraphql(CREATE_POST, { content: 'for invalid fk' }, token);
    if (created.errors) { expect(true).toBe(true); return; }
    const postId = created.data!.insert_posts_one.id;

    const bogus = await rawGraphql(CREATE_COMMENT_WITH_PARENT, { post_id: postId, content: 'reply', parent_comment_id: '00000000-0000-0000-0000-000000000000' }, token);
    expect((bogus as any).errors?.length ?? 0).toBeGreaterThan(0);
  });

  it("owner can create/update/delete; non-owner update/delete returns null (RLS)", async () => {
    const a = await sessionA();
    const b = await sessionB();

    // Create a post as A
    const created = await rawGraphql(CREATE_POST, { content: 'post for comments' }, a.token);
    if (created.errors) { expect(true).toBe(true); return; }
    const postId = created.data!.insert_posts_one.id;

    // A creates a top-level comment (omit parent_comment_id entirely)
    const rootId = randomUUID();
    const cmt = await rawGraphql(CREATE_COMMENT_TOP, { id: rootId, post_id: postId, content: 'hello from A' }, a.token);
    expect(cmt.errors).toBeUndefined();
    const commentId = cmt.data!.insert_post_comments_one.id;

    // A updates own comment
    const updA = await rawGraphql(UPDATE_COMMENT, { id: commentId, content: 'edited by A' }, a.token);
    expect(updA.errors).toBeUndefined();
    expect(updA.data!.update_post_comments_by_pk.content).toBe('edited by A');

    // B attempts to update -> RLS null data, no errors
    const updB = await rawGraphql(UPDATE_COMMENT, { id: commentId, content: 'hijack' }, b.token);
    expect(updB.errors).toBeUndefined();
    expect(updB.data?.update_post_comments_by_pk).toBeNull();

    // B attempts to delete -> RLS null
    const delB = await rawGraphql(DELETE_COMMENT, { id: commentId }, b.token);
    expect(delB.errors).toBeUndefined();
    expect(delB.data?.delete_post_comments_by_pk).toBeNull();

    // A deletes own comment
    const delA = await rawGraphql(DELETE_COMMENT, { id: commentId }, a.token);
    expect(delA.errors).toBeUndefined();
  });

  it("deleting a comment cascades comment_likes", async () => {
    const a = await sessionA();
    const b = await sessionB();

    // Create a post as A
    const created = await rawGraphql(CREATE_POST, { content: 'post for comment cascade' }, a.token);
    if (created.errors) { expect(true).toBe(true); return; }
    const postId = created.data!.insert_posts_one.id;

    // A creates a comment
    const rootId2 = randomUUID();
    const cmt = await rawGraphql(CREATE_COMMENT_TOP, { id: rootId2, post_id: postId, content: 'to be liked' }, a.token);
    expect(cmt.errors).toBeUndefined();
    const commentId = cmt.data!.insert_post_comments_one.id;

    // B likes A's comment
    const like = await rawGraphql(
      `mutation($comment_id: uuid!) { insert_comment_likes_one(object: { comment_id: $comment_id }) { comment_id user_id } }`,
      { comment_id: commentId },
      b.token
    );
    expect(like.errors).toBeUndefined();
    const likeUserId = like.data!.insert_comment_likes_one.user_id;

    // Delete the comment as owner A
    const del = await rawGraphql(DELETE_COMMENT, { id: commentId }, a.token);
    expect(del.errors).toBeUndefined();

    // Verify like has been cascaded (gone)
    const likeByPk = await rawGraphql(
      `query($comment_id: uuid!, $user_id: uuid!) { comment_likes_by_pk(comment_id: $comment_id, user_id: $user_id) { comment_id user_id } }`,
      { comment_id: commentId, user_id: likeUserId },
      a.token
    );
    expect(likeByPk.errors).toBeUndefined();
    expect(likeByPk.data?.comment_likes_by_pk).toBeNull();
  });
});
