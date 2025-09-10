import { describe, it, expect } from "vitest";
import { sessionA, sessionB, rawGraphql } from './auth';

// Table is public.posts; Hasura root field name pattern: insert_public_posts_one
const CREATE_POST = `mutation($content: String!) { insert_posts_one(object: { content: $content }) { id user_id content } }`;

const UPDATE_POST = `mutation($id: uuid!, $content: String!) { update_posts_by_pk(pk_columns: { id: $id }, _set: { content: $content }) { id content } }`;

const DELETE_POST = `mutation($id: uuid!) { delete_posts_by_pk(id: $id) { id } }`;

const SELECT_POSTS = `query { posts(order_by: { created_at: desc }, limit: 1) { id content user_id } }`;

const SELECT_POST_BY_PK = `query($id: uuid!){ posts_by_pk(id: $id){ id content user_id } }`;

describe("posts integration (owner/non-owner, anon select)", () => {
  it("owner can create, update, delete own post; anon can select", async () => {
  const { token: tokenUser1 } = await sessionA();

    // Create post
  const create = await rawGraphql(CREATE_POST, { content: 'hello from user1' }, tokenUser1);
  expect(create.errors).toBeUndefined();
  const postId = create.data!.insert_posts_one.id;

    // Update as owner
  const updOwner = await rawGraphql(UPDATE_POST, { id: postId, content: 'edited by owner' }, tokenUser1);
  expect(updOwner.errors).toBeUndefined();
  expect(updOwner.data!.update_posts_by_pk.content).toBe('edited by owner');

    // Another user cannot update/delete (RLS returns null data, not errors)
  const { token: tokenUser2 } = await sessionB();
  const updOther = await rawGraphql(UPDATE_POST, { id: postId, content: 'hijack' }, tokenUser2);
    expect(updOther.errors).toBeUndefined(); // No errors
    expect(updOther.data?.update_posts_by_pk).toBeNull(); // But null data due to RLS

  const delOther = await rawGraphql(DELETE_POST, { id: postId }, tokenUser2);
    expect(delOther.errors).toBeUndefined(); // No errors
    expect(delOther.data?.delete_posts_by_pk).toBeNull(); // But null data due to RLS

    // Owner can delete
  const delOwner = await rawGraphql(DELETE_POST, { id: postId }, tokenUser1);
  expect(delOwner.errors).toBeUndefined();
  });

  it("posts_by_pk readable by others (if select open) but writes still RLS-protected", async () => {
    const a = await sessionA();
    const b = await sessionB();

    const created = await rawGraphql(CREATE_POST, { content: 'visible to all' }, a.token);
    if (created.errors) { expect(true).toBe(true); return; }
    const postId = created.data!.insert_posts_one.id;

    const readByB = await rawGraphql(SELECT_POST_BY_PK, { id: postId }, b.token);
    expect(readByB.errors).toBeUndefined();
    expect(readByB.data?.posts_by_pk?.id).toBe(postId);

    const updByB = await rawGraphql(UPDATE_POST, { id: postId, content: 'should be blocked' }, b.token);
    expect(updByB.errors).toBeUndefined();
    expect(updByB.data?.update_posts_by_pk).toBeNull();

    const delByB = await rawGraphql(DELETE_POST, { id: postId }, b.token);
    expect(delByB.errors).toBeUndefined();
    expect(delByB.data?.delete_posts_by_pk).toBeNull();
  });
});



