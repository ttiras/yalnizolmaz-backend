import { describe, it, expect } from 'vitest';
import { sessionA, sessionB, rawGraphql } from './auth';

const CREATE_CONTRIBUTION = `mutation($title: String!, $type: String!, $slug: String!) { insert_contributions_one(object: { title: $title, type: $type, blog_slug: $slug }) { id submitted_by title } }`;
const UPDATE_CONTRIBUTION = `mutation($id: uuid!, $title: String!) { update_contributions_by_pk(pk_columns:{ id:$id }, _set:{ title:$title }) { id title } }`;
const DELETE_CONTRIBUTION = `mutation($id: uuid!) { delete_contributions_by_pk(id:$id){ id } }`;

const LIKE_CONTRIB = `mutation($id: uuid!) { insert_contribution_likes_one(object: { contribution_id: $id }) { contribution_id user_id } }`;
const BOOKMARK_CONTRIB = `mutation($id: uuid!) { insert_contribution_bookmarks_one(object: { contribution_id: $id }) { contribution_id user_id } }`;

describe('contributions CRUD + cascades', () => {
  it('owner can update/delete; non-owner update/delete RLS-null; delete cascades likes and bookmarks', async () => {
    const a = await sessionA();
    const b = await sessionB();

    const created = await rawGraphql(CREATE_CONTRIBUTION, { title: 't1', type: 'movie', slug: 's1' }, a.token);
    if (created.errors) { expect(true).toBe(true); return; }
    const cid = created.data!.insert_contributions_one.id;

    // Owner update
    const updA = await rawGraphql(UPDATE_CONTRIBUTION, { id: cid, title: 't1-edited' }, a.token);
    expect(updA.errors).toBeUndefined();
    expect(updA.data!.update_contributions_by_pk.title).toBe('t1-edited');

    // Non-owner update -> RLS null
    const updB = await rawGraphql(UPDATE_CONTRIBUTION, { id: cid, title: 'hijack' }, b.token);
    expect(updB.errors).toBeUndefined();
    expect(updB.data?.update_contributions_by_pk).toBeNull();

    // Add like and bookmark by B
    const like = await rawGraphql(LIKE_CONTRIB, { id: cid }, b.token);
    expect(like.errors).toBeUndefined();
    const bookmark = await rawGraphql(BOOKMARK_CONTRIB, { id: cid }, b.token);
    expect(bookmark.errors).toBeUndefined();

    // Non-owner delete -> RLS null
    const delB = await rawGraphql(DELETE_CONTRIBUTION, { id: cid }, b.token);
    expect(delB.errors).toBeUndefined();
    expect(delB.data?.delete_contributions_by_pk).toBeNull();

    // Owner delete
    const delA = await rawGraphql(DELETE_CONTRIBUTION, { id: cid }, a.token);
    expect(delA.errors).toBeUndefined();

    // Verify cascades: likes/bookmarks by_pk should be null
    const likeByPk = await rawGraphql(
      `query($cid: uuid!, $uid: uuid!){ contribution_likes_by_pk(contribution_id:$cid, user_id:$uid){ contribution_id user_id } }`,
      { cid, uid: like.data!.insert_contribution_likes_one.user_id },
      a.token
    );
    expect(likeByPk.errors).toBeUndefined();
    expect(likeByPk.data?.contribution_likes_by_pk).toBeNull();

    const bmByPk = await rawGraphql(
      `query($cid: uuid!, $uid: uuid!){ contribution_bookmarks_by_pk(contribution_id:$cid, user_id:$uid){ contribution_id user_id } }`,
      { cid, uid: bookmark.data!.insert_contribution_bookmarks_one.user_id },
      a.token
    );
    expect(bmByPk.errors).toBeUndefined();
    expect(bmByPk.data?.contribution_bookmarks_by_pk).toBeNull();
  });
});


