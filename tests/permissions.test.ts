import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import yaml from "yaml";

type HasuraPermission = {
  role: string;
  permission: Record<string, unknown>;
};

type TableMetadata = {
  table: { name: string; schema: string };
  object_relationships?: Array<{ name: string }>;
  array_relationships?: Array<{ name: string }>;
  insert_permissions?: HasuraPermission[];
  select_permissions?: HasuraPermission[];
  update_permissions?: HasuraPermission[];
  delete_permissions?: HasuraPermission[];
};

function readTableMetadata(fileName: string): TableMetadata {
  const filePath = path.join(
    __dirname,
    "../nhost/metadata/databases/default/tables",
    fileName
  );
  const file = fs.readFileSync(filePath, "utf8");
  return yaml.parse(file) as TableMetadata;
}

function hasRole(permissions: HasuraPermission[] | undefined, role: string) {
  return Boolean(permissions?.some((p) => p.role === role));
}

describe("Hasura metadata permissions", () => {
  it("posts has relationships and user CRUD permissions scoped by user_id", () => {
    const m = readTableMetadata("public_posts.yaml");
    expect(m.table).toEqual({ name: "posts", schema: "public" });
    const arrayRels = m.array_relationships?.map((r) => r.name) ?? [];
    expect(arrayRels).toEqual(expect.arrayContaining(["post_comments", "post_likes"]));
    expect(hasRole(m.insert_permissions, "user")).toBe(true);
    expect(hasRole(m.select_permissions, "user")).toBe(true);
    expect(hasRole(m.update_permissions, "user")).toBe(true);
    expect(hasRole(m.delete_permissions, "user")).toBe(true);
  });

  it("post_comments has relationships and user CRUD permissions scoped by user_id", () => {
    const m = readTableMetadata("public_post_comments.yaml");
    expect(m.table).toEqual({ name: "post_comments", schema: "public" });
    const objectRels = m.object_relationships?.map((r) => r.name) ?? [];
    const arrayRels = m.array_relationships?.map((r) => r.name) ?? [];
    expect(objectRels).toEqual(expect.arrayContaining(["post"]));
    expect(arrayRels).toEqual(expect.arrayContaining(["comment_likes"]));
    expect(hasRole(m.insert_permissions, "user")).toBe(true);
    expect(hasRole(m.select_permissions, "user")).toBe(true);
    expect(hasRole(m.update_permissions, "user")).toBe(true);
    expect(hasRole(m.delete_permissions, "user")).toBe(true);
  });

  it("post_likes has relationships and user insert/select/delete permissions", () => {
    const m = readTableMetadata("public_post_likes.yaml");
    expect(m.table).toEqual({ name: "post_likes", schema: "public" });
    const objectRels = m.object_relationships?.map((r) => r.name) ?? [];
    expect(objectRels).toEqual(expect.arrayContaining(["post", "user"]));
    expect(hasRole(m.insert_permissions, "user")).toBe(true);
    expect(hasRole(m.select_permissions, "user")).toBe(true);
    expect(m.update_permissions ?? []).toHaveLength(0);
    expect(hasRole(m.delete_permissions, "user")).toBe(true);
  });

  it("comment_likes has relationships and user insert permission", () => {
    const m = readTableMetadata("public_comment_likes.yaml");
    expect(m.table).toEqual({ name: "comment_likes", schema: "public" });
    const objectRels = m.object_relationships?.map((r) => r.name) ?? [];
    expect(objectRels).toEqual(expect.arrayContaining(["post_comment", "user"]));
    expect(hasRole(m.insert_permissions, "user")).toBe(true);
  });
});


