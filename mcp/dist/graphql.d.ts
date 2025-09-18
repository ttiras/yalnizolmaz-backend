import { ProjectConfig } from './config.js';
export declare class NhostGraphQLClient {
    private client;
    private project;
    constructor(project: ProjectConfig);
    executeQuery(query: string, variables?: Record<string, any>): Promise<any>;
    executeMutation(mutation: string, variables?: Record<string, any>): Promise<any>;
    introspectSchema(): Promise<any>;
    isQueryAllowed(queryName: string): boolean;
    isMutationAllowed(mutationName: string): boolean;
}
//# sourceMappingURL=graphql.d.ts.map