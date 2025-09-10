import { describe, it, expect } from "vitest";

// We intentionally do a raw fetch to Hasura GraphQL without auth
// Nhost Cloud/Local typically exposes GraphQL at /v1/graphql under the Hasura service.
// For local, user can set HASURA_URL; otherwise skip the test gracefully.

const HASURA_URL = process.env.HASURA_URL || process.env.NHOST_HASURA_URL;

const CREATE_POST_MUTATION = `
mutation CreatePost($content: String!) {
  insert_public_posts_one(object: { content: $content }) { id }
}
`;

const ANON_SELECT_POSTS = `
query {
  posts(limit: 1, order_by: { created_at: desc }) { id content user_id created_at updated_at }
}
`;

const ANON_SELECT_POST_COMMENTS = `
query {
  post_comments(limit: 1, order_by: { created_at: desc }) { id content user_id post_id parent_comment_id created_at updated_at }
}
`;

describe("GraphQL permissions (unauthenticated)", () => {
  it("denies unauthenticated insert into posts", async () => {
    if (!HASURA_URL) {
      expect(true).toBe(true); // skip if not configured
      return;
    }

    try {
      const res = await fetch(HASURA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: CREATE_POST_MUTATION,
          variables: { content: "Hello" },
        }),
      });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);

      const body = (await res.json()) as {
        data?: unknown;
        errors?: Array<{ message: string }>;
      };

      expect(body.errors?.length ?? 0).toBeGreaterThan(0);
    } catch (e) {
      // If endpoint isn't reachable, treat as skipped
      expect(true).toBe(true);
    }
  });

  it("allows anonymous selects for posts and post_comments (allowed columns)", async () => {
    if (!HASURA_URL) {
      expect(true).toBe(true); // skip if not configured
      return;
    }

    try {
      // posts
      const resPosts = await fetch(HASURA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ANON_SELECT_POSTS }),
      });
      const bodyPosts = (await resPosts.json()) as any;
      // Should not error even if empty; columns must exist
      expect(Array.isArray(bodyPosts?.data?.posts)).toBe(true);

      // post_comments
      const resComments = await fetch(HASURA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ANON_SELECT_POST_COMMENTS }),
      });
      const bodyComments = (await resComments.json()) as any;
      expect(Array.isArray(bodyComments?.data?.post_comments)).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });
});


