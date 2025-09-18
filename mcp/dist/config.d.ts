import { z } from 'zod';
declare const ProjectConfigSchema: z.ZodObject<{
    subdomain: z.ZodString;
    region: z.ZodString;
    admin_secret: z.ZodOptional<z.ZodString>;
    allow_queries: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    allow_mutations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    subdomain: string;
    region: string;
    allow_queries: string[];
    allow_mutations: string[];
    admin_secret?: string | undefined;
}, {
    subdomain: string;
    region: string;
    admin_secret?: string | undefined;
    allow_queries?: string[] | undefined;
    allow_mutations?: string[] | undefined;
}>;
declare const CloudConfigSchema: z.ZodObject<{
    pat: z.ZodOptional<z.ZodString>;
    enable_mutations: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    enable_mutations: boolean;
    pat?: string | undefined;
}, {
    pat?: string | undefined;
    enable_mutations?: boolean | undefined;
}>;
declare const ConfigSchema: z.ZodObject<{
    cloud: z.ZodOptional<z.ZodObject<{
        pat: z.ZodOptional<z.ZodString>;
        enable_mutations: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enable_mutations: boolean;
        pat?: string | undefined;
    }, {
        pat?: string | undefined;
        enable_mutations?: boolean | undefined;
    }>>;
    projects: z.ZodDefault<z.ZodArray<z.ZodObject<{
        subdomain: z.ZodString;
        region: z.ZodString;
        admin_secret: z.ZodOptional<z.ZodString>;
        allow_queries: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        allow_mutations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        subdomain: string;
        region: string;
        allow_queries: string[];
        allow_mutations: string[];
        admin_secret?: string | undefined;
    }, {
        subdomain: string;
        region: string;
        admin_secret?: string | undefined;
        allow_queries?: string[] | undefined;
        allow_mutations?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    projects: {
        subdomain: string;
        region: string;
        allow_queries: string[];
        allow_mutations: string[];
        admin_secret?: string | undefined;
    }[];
    cloud?: {
        enable_mutations: boolean;
        pat?: string | undefined;
    } | undefined;
}, {
    cloud?: {
        pat?: string | undefined;
        enable_mutations?: boolean | undefined;
    } | undefined;
    projects?: {
        subdomain: string;
        region: string;
        admin_secret?: string | undefined;
        allow_queries?: string[] | undefined;
        allow_mutations?: string[] | undefined;
    }[] | undefined;
}>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type CloudConfig = z.infer<typeof CloudConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export declare function loadConfig(configPath?: string): Config;
export declare function getGraphQLEndpoint(project: ProjectConfig): string;
export declare function getAdminHeaders(project: ProjectConfig): Record<string, string>;
export {};
//# sourceMappingURL=config.d.ts.map