import { describe, it, expect } from 'vitest';
import { sessionA, sessionB, rawGraphql } from './auth';

const CREATE_POST = `mutation($content: String!) { insert_posts_one(object: { content: $content }) { id } }`;
const BOOKMARK_POST = `mutation($post_id: uuid!) { insert_post_bookmarks_one(object: { post_id: $post_id }) { post_id user_id } }`;
const UNBOOKMARK_POST = `mutation($post_id: uuid!, $user_id: uuid!) { delete_post_bookmarks_by_pk(post_id: $post_id, user_id: $user_id) { post_id user_id } }`;

const CREATE_CONTRIBUTION = `mutation($title: String!, $type: String!, $slug: String!) { insert_contributions_one(object: { title: $title, type: $type, blog_slug: $slug }) { id } }`;
const BOOKMARK_CONTRIB = `mutation($contribution_id: uuid!) { insert_contribution_bookmarks_one(object: { contribution_id: $contribution_id }) { contribution_id user_id } }`;
const UNBOOKMARK_CONTRIB = `mutation($contribution_id: uuid!, $user_id: uuid!) { delete_contribution_bookmarks_by_pk(contribution_id: $contribution_id, user_id: $user_id) { contribution_id user_id } }`;

describe('bookmarks RLS and uniqueness', () => {
  it('post_bookmarks: user can bookmark once; duplicate fails; only owner can delete own bookmark; non-owner RLS-null', async () => {
    const a = await sessionA();
    const b = await sessionB();

    const create = await rawGraphql(CREATE_POST, { content: 'bookmarkable' }, a.token);
    if (create.errors) { expect(true).toBe(true); return; }
    const postId = create.data!.insert_posts_one.id;

    // B bookmarks
    const b1 = await rawGraphql(BOOKMARK_POST, { post_id: postId }, b.token);
    expect(b1.errors).toBeUndefined();

    // Duplicate fails
    const dup = await rawGraphql(BOOKMARK_POST, { post_id: postId }, b.token);
    expect((dup.errors?.length ?? 0)).toBeGreaterThan(0);

    // Non-owner (A) cannot delete B's bookmark -> RLS null
    const delOther = await rawGraphql(UNBOOKMARK_POST, { post_id: postId, user_id: '00000000-0000-0000-0000-000000000000' }, a.token);
    expect(delOther.errors).toBeUndefined();
    expect(delOther.data?.delete_post_bookmarks_by_pk).toBeNull();

    // Owner (B) can delete
    const delSelf = await rawGraphql(UNBOOKMARK_POST, { post_id: postId, user_id: b1.data!.insert_post_bookmarks_one.user_id }, b.token);
    expect(delSelf.errors).toBeUndefined();
  });

  it('contribution_bookmarks: same behavior as posts', async () => {
    const a = await sessionA();
    const b = await sessionB();

    const create = await rawGraphql(CREATE_CONTRIBUTION, { title: 'c1', type: 'movie', slug: 's1' }, a.token);
    if (create.errors) { expect(true).toBe(true); return; }
    const cid = create.data!.insert_contributions_one.id;

    // B bookmarks
    const b1 = await rawGraphql(BOOKMARK_CONTRIB, { contribution_id: cid }, b.token);
    expect(b1.errors).toBeUndefined();

    // Duplicate fails
    const dup = await rawGraphql(BOOKMARK_CONTRIB, { contribution_id: cid }, b.token);
    expect((dup.errors?.length ?? 0)).toBeGreaterThan(0);

    // Non-owner delete -> RLS null
    const delOther = await rawGraphql(UNBOOKMARK_CONTRIB, { contribution_id: cid, user_id: '00000000-0000-0000-0000-000000000000' }, a.token);
    expect(delOther.errors).toBeUndefined();
    expect(delOther.data?.delete_contribution_bookmarks_by_pk).toBeNull();

    // Owner delete
    const delSelf = await rawGraphql(UNBOOKMARK_CONTRIB, { contribution_id: cid, user_id: b1.data!.insert_contribution_bookmarks_one.user_id }, b.token);
    expect(delSelf.errors).toBeUndefined();
  });
});


