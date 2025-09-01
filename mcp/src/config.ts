import * as fs from 'fs';
import * as path from 'path';
import * as toml from 'toml';
import { z } from 'zod';

// Configuration schema
const ProjectConfigSchema = z.object({
  subdomain: z.string(),
  region: z.string(),
  admin_secret: z.string().optional(),
  allow_queries: z.array(z.string()).default(['*']),
  allow_mutations: z.array(z.string()).default([]),
});

const CloudConfigSchema = z.object({
  pat: z.string().optional(),
  enable_mutations: z.boolean().default(false),
});

const ConfigSchema = z.object({
  cloud: CloudConfigSchema.optional(),
  projects: z.array(ProjectConfigSchema).default([]),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type CloudConfig = z.infer<typeof CloudConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath?: string): Config {
  const defaultPath = path.join(process.cwd(), '..', 'mcp-nhost.toml');
  const filePath = configPath || defaultPath;
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Configuration file not found: ${filePath}`);
  }
  
  const configContent = fs.readFileSync(filePath, 'utf-8');
  const parsedToml = toml.parse(configContent);
  
  return ConfigSchema.parse(parsedToml);
}

export function getGraphQLEndpoint(project: ProjectConfig): string {
  if (project.region === 'local') {
    return 'https://local.hasura.local.nhost.run/v1/graphql';
  }
  
  return `https://${project.subdomain}.hasura.${project.region}.nhost.run/v1/graphql`;
}

export function getAdminHeaders(project: ProjectConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (project.admin_secret) {
    headers['x-hasura-admin-secret'] = project.admin_secret;
  }
  
  return headers;
}

