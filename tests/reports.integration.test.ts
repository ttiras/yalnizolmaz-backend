import { describe, it, expect } from 'vitest';
import { sessionA, sessionB, rawGraphql } from './auth';

const CREATE_POST = `mutation($content: String!) { insert_posts_one(object: { content: $content }) { id } }`;
const REPORT_POST = `mutation($post_id: uuid!, $reason: String!) { insert_post_reports_one(object: { post_id: $post_id, reason: $reason }) { id reporter_id post_id reason } }`;
const UPDATE_POST_REPORT = `mutation($id: uuid!, $reason: String!) { update_post_reports_by_pk(pk_columns:{ id:$id }, _set:{ reason:$reason }){ id reason } }`;
const SELECT_POST_REPORT = `query($id: uuid!){ post_reports_by_pk(id:$id){ id reporter_id post_id reason } }`;

const CREATE_CONTRIBUTION = `mutation($title: String!, $type: String!, $slug: String!) { insert_contributions_one(object: { title: $title, type: $type, blog_slug: $slug }) { id } }`;
const REPORT_CONTRIB = `mutation($contribution_id: uuid!, $reason: String!) { insert_contribution_reports_one(object: { contribution_id: $contribution_id, reason: $reason }) { id reporter_id contribution_id reason } }`;
const UPDATE_CONTRIB_REPORT = `mutation($id: uuid!, $reason: String!) { update_contribution_reports_by_pk(pk_columns:{ id:$id }, _set:{ reason:$reason }){ id reason } }`;
const SELECT_CONTRIB_REPORT = `query($id: uuid!){ contribution_reports_by_pk(id:$id){ id reporter_id contribution_id reason } }`;

describe('reports RLS', () => {
  it('post_reports: reporter preset; reporter-only select/update/delete; no cross-user visibility', async () => {
    const a = await sessionA();
    const b = await sessionB();

    const created = await rawGraphql(CREATE_POST, { content: 'reported post' }, a.token);
    if (created.errors) { expect(true).toBe(true); return; }
    const postId = created.data!.insert_posts_one.id;

    // A files a report
    const rep = await rawGraphql(REPORT_POST, { post_id: postId, reason: 'spam' }, a.token);
    expect(rep.errors).toBeUndefined();
    const reportId = rep.data!.insert_post_reports_one.id;

    // A can select by pk
    const selA = await rawGraphql(SELECT_POST_REPORT, { id: reportId }, a.token);
    expect(selA.errors).toBeUndefined();
    expect(selA.data?.post_reports_by_pk?.id).toBe(reportId);

    // B cannot select A's report (RLS -> null)
    const selB = await rawGraphql(SELECT_POST_REPORT, { id: reportId }, b.token);
    expect(selB.errors).toBeUndefined();
    expect(selB.data?.post_reports_by_pk).toBeNull();

    // A can update own report
    const updA = await rawGraphql(UPDATE_POST_REPORT, { id: reportId, reason: 'abuse' }, a.token);
    expect(updA.errors).toBeUndefined();

    // B cannot update A's report -> update check fails (GraphQL error)
    const updB = await rawGraphql(UPDATE_POST_REPORT, { id: reportId, reason: 'x' }, b.token);
    expect((updB.errors?.length ?? 0)).toBeGreaterThan(0);
    expect(updB.data?.update_post_reports_by_pk).toBeUndefined();
  });

  it('contribution_reports: same behavior as posts', async () => {
    const a = await sessionA();
    const b = await sessionB();

    const created = await rawGraphql(CREATE_CONTRIBUTION, { title: 'to report', type: 'movie', slug: 's2' }, a.token);
    if (created.errors) { expect(true).toBe(true); return; }
    const cid = created.data!.insert_contributions_one.id;

    const rep = await rawGraphql(REPORT_CONTRIB, { contribution_id: cid, reason: 'spam' }, a.token);
    expect(rep.errors).toBeUndefined();
    const rid = rep.data!.insert_contribution_reports_one.id;

    const selA = await rawGraphql(SELECT_CONTRIB_REPORT, { id: rid }, a.token);
    expect(selA.errors).toBeUndefined();
    expect(selA.data?.contribution_reports_by_pk?.id).toBe(rid);

    const selB = await rawGraphql(SELECT_CONTRIB_REPORT, { id: rid }, b.token);
    expect(selB.errors).toBeUndefined();
    expect(selB.data?.contribution_reports_by_pk).toBeNull();

    const updA = await rawGraphql(UPDATE_CONTRIB_REPORT, { id: rid, reason: 'abuse' }, a.token);
    expect(updA.errors).toBeUndefined();

    const updB = await rawGraphql(UPDATE_CONTRIB_REPORT, { id: rid, reason: 'x' }, b.token);
    expect(updB.errors).toBeUndefined();
    expect(updB.data?.update_contribution_reports_by_pk).toBeNull();
  });
});


