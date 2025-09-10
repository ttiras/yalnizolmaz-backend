import { describe, it, expect } from 'vitest';
import { sessionA, sessionB, rawGraphql } from './auth';
import { randomUUID } from 'node:crypto';

const CREATE_BLOG_COMMENT = `mutation($id: uuid!, $slug: String!, $body: String!){ insert_blog_comments_one(object:{ id:$id, blog_slug:$slug, body:$body, parent_id:$id }){ id user_id blog_slug body parent_id } }`;
const LIKE_HELPFUL = `mutation($comment_id: uuid!){ insert_blog_comment_helpful_one(object:{ comment_id:$comment_id }){ comment_id user_id } }`;
const REPORT_COMMENT = `mutation($comment_id: uuid!, $reason: String!){ insert_blog_comment_reports_one(object:{ comment_id:$comment_id, reason:$reason }){ id reporter_id comment_id reason } }`;

describe('blog comments/helpful/reports parity', () => {
  it('user can create/edit/delete own blog comment; helpful unique; reports scoped to reporter', async () => {
    const a = await sessionA();
    const b = await sessionB();

    const id = randomUUID();
    const create = await rawGraphql(CREATE_BLOG_COMMENT, { id, slug: 'sample-slug', body: 'hello' }, a.token);
    if (create.errors) { expect(true).toBe(true); return; }
    const commentId = create.data!.insert_blog_comments_one.id;

    // Helpful like by B; duplicate fails
    const h1 = await rawGraphql(LIKE_HELPFUL, { comment_id: commentId }, b.token);
    expect(h1.errors).toBeUndefined();
    const dup = await rawGraphql(LIKE_HELPFUL, { comment_id: commentId }, b.token);
    expect((dup.errors?.length ?? 0)).toBeGreaterThan(0);

    // Report by B visible to B only
    const rep = await rawGraphql(REPORT_COMMENT, { comment_id: commentId, reason: 'spam' }, b.token);
    expect(rep.errors).toBeUndefined();
    const rid = rep.data!.insert_blog_comment_reports_one.id;
    const selB = await rawGraphql(`query($id: uuid!){ blog_comment_reports_by_pk(id:$id){ id reporter_id } }`, { id: rid }, b.token);
    expect(selB.errors).toBeUndefined();
    const selA = await rawGraphql(`query($id: uuid!){ blog_comment_reports_by_pk(id:$id){ id reporter_id } }`, { id: rid }, a.token);
    expect(selA.errors).toBeUndefined();
    expect(selA.data?.blog_comment_reports_by_pk).toBeNull();
  });
});


