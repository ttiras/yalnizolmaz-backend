import { describe, it, expect } from "vitest";
import { sessionA, sessionB, rawGraphql } from './auth';

// Assumptions:
// - public.messages(id, created_at, updated_at, sender_id, recipient_id, body)
// - Insert RLS: sender_id = X-Hasura-User-Id, recipient_id != sender, receiver.metadata NOT CONTAINS { dms_off: true }
// - Select RLS: sender_id = X-Hasura-User-Id OR recipient_id = X-Hasura-User-Id
// - user_blocks controls blocking: if B blocks A, A cannot send to B

const SEND_MESSAGE = `mutation($recipientId: uuid!, $body: String!) {
  insert_messages_one(object: { recipient_id: $recipientId, body: $body }) {
    id sender_id recipient_id body
  }
}`;

const THREAD_WITH = `query($otherId: uuid!) {
  messages(
    where: { _or: [ { sender_id: { _eq: $otherId } }, { recipient_id: { _eq: $otherId } } ] },
    order_by: { created_at: asc },
    limit: 20
  ) {
    id sender_id recipient_id body
  }
}`;

const INSERT_BLOCK = `mutation($blockedId: uuid!) {
  insert_user_blocks_one(object: { blocked_id: $blockedId }) { blocker_id blocked_id }
}`;

const DELETE_BLOCK = `mutation($blockerId: uuid!, $blockedId: uuid!) {
  delete_user_blocks_by_pk(blocker_id: $blockerId, blocked_id: $blockedId) { blocker_id blocked_id }
}`;

describe('messages integration', () => {
  it('allows A to DM B (when not blocked), both can read; when B blocks A, A cannot DM', async () => {
    const a = await sessionA();
    const b = await sessionB();

    // Ensure unblocked state: try to delete any existing block B->A (ignore outcome)
    await rawGraphql(DELETE_BLOCK, { blockerId: b.userId, blockedId: a.userId }, b.token);

    // A sends DM to B
    const sent = await rawGraphql(SEND_MESSAGE, { recipientId: b.userId, body: 'hello B' }, a.token);
    expect(sent.errors).toBeUndefined();
    const msgId = sent.data!.insert_messages_one.id;

    // A can see thread with B
    const aView = await rawGraphql(THREAD_WITH, { otherId: b.userId }, a.token);
    expect(aView.errors).toBeUndefined();
    const aHas = aView.data!.messages.some((m: any) => m.id === msgId);
    expect(aHas).toBe(true);

    // B can see thread with A
    const bView = await rawGraphql(THREAD_WITH, { otherId: a.userId }, b.token);
    expect(bView.errors).toBeUndefined();
    const bHas = bView.data!.messages.some((m: any) => m.id === msgId);
    expect(bHas).toBe(true);

    // B blocks A
    const blk = await rawGraphql(INSERT_BLOCK, { blockedId: a.userId }, b.token);
    expect(blk.errors).toBeUndefined();

    // Now A cannot send to B: insert permission check fails -> GraphQL error, not RLS null
    const blockedAttempt = await rawGraphql(SEND_MESSAGE, { recipientId: b.userId, body: 'should be blocked' }, a.token);
    expect(blockedAttempt.errors && blockedAttempt.errors.length).toBeGreaterThan(0);
    // Defensive: ensure no data was returned
    expect(blockedAttempt.data?.insert_messages_one).toBeUndefined();

    // Cleanup block so future tests unaffected
    const unblk = await rawGraphql(DELETE_BLOCK, { blockerId: b.userId, blockedId: a.userId }, b.token);
    expect(unblk.errors).toBeUndefined();
  });
});


ost 