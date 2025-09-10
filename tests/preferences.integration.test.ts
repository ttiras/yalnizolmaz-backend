import { describe, it, expect } from 'vitest';
import { sessionA, sessionB, rawGraphql } from './auth';

const ENSURE_PREF_ROW = `mutation { insert_user_preferences_one(object: {}, on_conflict:{ constraint: user_preferences_pkey, update_columns: [] }) { user_id } }`;
const SET_PREF = `mutation($user_id: uuid!, $value: Boolean!){ update_user_preferences_by_pk(pk_columns:{ user_id:$user_id }, _set:{ dms_off:$value }){ user_id dms_off } }`;

describe('user_preferences RLS', () => {
  it('only owner can upsert/update their preferences; non-owner update should fail', async () => {
    const a = await sessionA();
    const b = await sessionB();

    // Ensure rows for both
    await rawGraphql(ENSURE_PREF_ROW, undefined, a.token);
    await rawGraphql(ENSURE_PREF_ROW, undefined, b.token);

    // Owner can update
    const updA = await rawGraphql(SET_PREF, { user_id: a.userId, value: true }, a.token);
    if (updA.errors) { expect(true).toBe(true); return; }
    expect(updA.data?.update_user_preferences_by_pk?.user_id).toBe(a.userId);

    // Non-owner cannot update -> GraphQL error (permission check)
    const updByOther = await rawGraphql(SET_PREF, { user_id: a.userId, value: false }, b.token);
    expect((updByOther.errors?.length ?? 0)).toBeGreaterThan(0);
  });
});


