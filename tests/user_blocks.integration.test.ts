import { describe, it, expect } from "vitest";
import { sessionA, sessionB, rawGraphql } from './auth';

// Assumptions:
// - Table public.user_blocks(blocker_id uuid, blocked_id uuid, created_at timestamptz)
// - PK (blocker_id, blocked_id)
// - Insert/Delete require blocker_id = X-Hasura-User-Id
// - Select allowed if blocker_id = X-Hasura-User-Id OR blocked_id = X-Hasura-User-Id

const INSERT_BLOCK = `mutation($blockedId: uuid!) {
  insert_user_blocks_one(object: { blocked_id: $blockedId }) {
    blocker_id
    blocked_id
  }
}`;

const DELETE_BLOCK = `mutation($blockedId: uuid!) {
  delete_user_blocks_by_pk(blocker_id: $blockerId, blocked_id: $blockedId) {
    blocker_id
    blocked_id
  }
}`.replace('$blockerId', '"REPLACE"');

const LIST_FOR_ME = `query {
  user_blocks(order_by: { created_at: desc }, limit: 10) {
    blocker_id
    blocked_id
  }
}`;

describe('user_blocks RLS', () => {
  it('blocker can insert; both can select; only blocker can delete', async () => {
    const a = await sessionA();
    const b = await sessionB();

    // Cleanup if exists
    const delIfExists = await rawGraphql(
      `mutation($blockerId: uuid!, $blockedId: uuid!) { delete_user_blocks_by_pk(blocker_id: $blockerId, blocked_id: $blockedId) { blocker_id } }`,
      { blockerId: a.userId, blockedId: b.userId },
      a.token
    );
    // ignore result; RLS may return null if not present

    // A blocks B
    const ins = await rawGraphql(INSERT_BLOCK, { blockedId: b.userId }, a.token);
    expect(ins.errors).toBeUndefined();
    expect(ins.data!.insert_user_blocks_one.blocker_id).toBe(a.userId);
    expect(ins.data!.insert_user_blocks_one.blocked_id).toBe(b.userId);

    // A (blocker) can list
    const listA = await rawGraphql(LIST_FOR_ME, undefined, a.token);
    expect(listA.errors).toBeUndefined();
    const hasAB = listA.data!.user_blocks.some((r: any) => r.blocker_id === a.userId && r.blocked_id === b.userId);
    expect(hasAB).toBe(true);

    // B (blocked) can see entry as well per select rule
    const listB = await rawGraphql(LIST_FOR_ME, undefined, b.token);
    expect(listB.errors).toBeUndefined();
    const seenByB = listB.data!.user_blocks.some((r: any) => r.blocker_id === a.userId && r.blocked_id === b.userId);
    expect(seenByB).toBe(true);

    // B cannot delete (RLS returns null)
    const delByB = await rawGraphql(
      `mutation($blockerId: uuid!, $blockedId: uuid!) { delete_user_blocks_by_pk(blocker_id: $blockerId, blocked_id: $blockedId) { blocker_id } }`,
      { blockerId: a.userId, blockedId: b.userId },
      b.token
    );
    expect(delByB.errors).toBeUndefined();
    expect(delByB.data?.delete_user_blocks_by_pk).toBeNull();

    // A can delete
    const delByA = await rawGraphql(
      `mutation($blockerId: uuid!, $blockedId: uuid!) { delete_user_blocks_by_pk(blocker_id: $blockerId, blocked_id: $blockedId) { blocker_id blocked_id } }`,
      { blockerId: a.userId, blockedId: b.userId },
      a.token
    );
    expect(delByA.errors).toBeUndefined();
    expect(delByA.data!.delete_user_blocks_by_pk.blocker_id).toBe(a.userId);
    expect(delByA.data!.delete_user_blocks_by_pk.blocked_id).toBe(b.userId);
  });
});


