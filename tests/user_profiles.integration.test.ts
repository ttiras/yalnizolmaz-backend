import { describe, it, expect } from "vitest";
import { rawGraphql, sessionA, sessionB } from "./auth";

const CREATE_PROFILE = `mutation($bio: String, $location: String, $website: String) {
  insert_user_profiles_one(object: { bio: $bio, location: $location, website: $website }) {
    user_id
    bio
    location
    website
    created_at
    updated_at
  }
}`;

const UPDATE_PROFILE = `mutation($user_id: uuid!, $bio: String, $location: String, $website: String) {
  update_user_profiles_by_pk(pk_columns: { user_id: $user_id }, _set: { bio: $bio, location: $location, website: $website }) {
    user_id
    bio
    location
    website
    updated_at
  }
}`;

const GET_PROFILE = `query($user_id: uuid!) {
  user_profiles_by_pk(user_id: $user_id) {
    user_id
    bio
    location
    website
    created_at
    updated_at
  }
}`;

const GET_USER_PROFILES = `query {
  user_profiles(limit: 10) {
    user_id
    bio
    location
    website
    created_at
    updated_at
  }
}`;

const DELETE_PROFILE = `mutation($user_id: uuid!) {
  delete_user_profiles_by_pk(user_id: $user_id) {
    user_id
  }
}`;

describe("user_profiles RLS", () => {
  it("user can create/read/update/delete own profile; cannot access others' profiles", async () => {
    const { token: tokenA, userId: userIdA } = await sessionA();
    const { token: tokenB, userId: userIdB } = await sessionB();

    // Clean up any existing profiles first
    await rawGraphql(DELETE_PROFILE, { user_id: userIdA }, tokenA);
    await rawGraphql(DELETE_PROFILE, { user_id: userIdB }, tokenB);

    // User A creates profile
    const createA = await rawGraphql(
      CREATE_PROFILE,
      { bio: "Bio A", location: "Location A", website: "https://example-a.com" },
      tokenA
    );
    expect(createA.errors).toBeUndefined();
    expect(createA.data?.insert_user_profiles_one?.user_id).toBe(userIdA);
    expect(createA.data?.insert_user_profiles_one?.bio).toBe("Bio A");

    // User B creates profile
    const createB = await rawGraphql(
      CREATE_PROFILE,
      { bio: "Bio B", location: "Location B", website: "https://example-b.com" },
      tokenB
    );
    expect(createB.errors).toBeUndefined();
    expect(createB.data?.insert_user_profiles_one?.user_id).toBe(userIdB);

    // User A can read own profile
    const readOwnA = await rawGraphql(GET_PROFILE, { user_id: userIdA }, tokenA);
    expect(readOwnA.errors).toBeUndefined();
    expect(readOwnA.data?.user_profiles_by_pk?.user_id).toBe(userIdA);
    expect(readOwnA.data?.user_profiles_by_pk?.bio).toBe("Bio A");

    // User A can read all profiles (public read access)
    const readAllA = await rawGraphql(GET_USER_PROFILES, {}, tokenA);
    expect(readAllA.errors).toBeUndefined();
    expect(readAllA.data?.user_profiles).toHaveLength(2);

    // User A can update own profile
    const updateA = await rawGraphql(
      UPDATE_PROFILE,
      { user_id: userIdA, bio: "Updated Bio A", location: "Updated Location A" },
      tokenA
    );
    expect(updateA.errors).toBeUndefined();
    expect(updateA.data?.update_user_profiles_by_pk?.bio).toBe("Updated Bio A");

    // User A cannot update User B's profile (RLS should prevent this)
    const updateOther = await rawGraphql(
      UPDATE_PROFILE,
      { user_id: userIdB, bio: "Hacked Bio" },
      tokenA
    );
    expect(updateOther.data?.update_user_profiles_by_pk).toBeNull();

    // User A can delete own profile
    const deleteA = await rawGraphql(DELETE_PROFILE, { user_id: userIdA }, tokenA);
    expect(deleteA.errors).toBeUndefined();
    expect(deleteA.data?.delete_user_profiles_by_pk?.user_id).toBe(userIdA);

    // Verify profile was deleted
    const verifyDelete = await rawGraphql(GET_PROFILE, { user_id: userIdA }, tokenA);
    expect(verifyDelete.data?.user_profiles_by_pk).toBeNull();

    // User A cannot delete User B's profile
    const deleteOther = await rawGraphql(DELETE_PROFILE, { user_id: userIdB }, tokenA);
    expect(deleteOther.data?.delete_user_profiles_by_pk).toBeNull();
  });

  it("public users cannot access user_profiles (encourages signup)", async () => {
    const { token: tokenA, userId: userIdA } = await sessionA();

    // Clean up any existing profile first
    await rawGraphql(DELETE_PROFILE, { user_id: userIdA }, tokenA);

    // Create a profile as authenticated user
    const create = await rawGraphql(
      CREATE_PROFILE,
      { bio: "Public Bio", location: "Public Location" },
      tokenA
    );
    expect(create.errors).toBeUndefined();

    // Public users (no auth token) cannot read user_profiles
    const readPublic = await rawGraphql(GET_USER_PROFILES, {}, undefined);
    expect(readPublic.errors).toBeDefined();
    expect(readPublic.errors?.[0]?.message).toContain("field 'user_profiles' not found");

    // Public users cannot create profile
    const createPublic = await rawGraphql(
      CREATE_PROFILE,
      { bio: "Public Bio" },
      undefined
    );
    expect(createPublic.errors).toBeDefined();

    // Public users cannot update profile
    const updatePublic = await rawGraphql(
      UPDATE_PROFILE,
      { user_id: userIdA, bio: "Updated by public" },
      undefined
    );
    expect(updatePublic.errors).toBeDefined();

    // Public users cannot delete profile
    const deletePublic = await rawGraphql(DELETE_PROFILE, { user_id: userIdA }, undefined);
    expect(deletePublic.errors).toBeDefined();
  });

  it("profile fields are properly validated and nullable", async () => {
    const { token, userId } = await sessionA();

    // Clean up any existing profile first
    await rawGraphql(DELETE_PROFILE, { user_id: userId }, token);

    // Create profile with all fields
    const createFull = await rawGraphql(
      CREATE_PROFILE,
      {
        bio: "Full bio with all fields",
        location: "Full location",
        website: "https://full.example.com",
      },
      token
    );
    expect(createFull.errors).toBeUndefined();
    expect(createFull.data?.insert_user_profiles_one?.bio).toBe("Full bio with all fields");
    expect(createFull.data?.insert_user_profiles_one?.location).toBe("Full location");
    expect(createFull.data?.insert_user_profiles_one?.website).toBe("https://full.example.com");

    // Clean up the full profile and create partial profile
    await rawGraphql(DELETE_PROFILE, { user_id: userId }, token);
    const createPartial = await rawGraphql(
      CREATE_PROFILE,
      { bio: "Only bio field" },
      token
    );
    expect(createPartial.errors).toBeUndefined();
    expect(createPartial.data?.insert_user_profiles_one?.bio).toBe("Only bio field");
    expect(createPartial.data?.insert_user_profiles_one?.location).toBeNull();
    expect(createPartial.data?.insert_user_profiles_one?.website).toBeNull();

    // Clean up and create empty profile
    await rawGraphql(DELETE_PROFILE, { user_id: userId }, token);
    const createEmpty = await rawGraphql(CREATE_PROFILE, {}, token);
    expect(createEmpty.errors).toBeUndefined();
    expect(createEmpty.data?.insert_user_profiles_one?.bio).toBeNull();
    expect(createEmpty.data?.insert_user_profiles_one?.location).toBeNull();
    expect(createEmpty.data?.insert_user_profiles_one?.website).toBeNull();
  });
});
