#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './config.js';
import { NhostGraphQLClient } from './graphql.js';
class NhostMCPServer {
    server;
    config;
    clients = new Map();
    constructor() {
        this.server = new Server({
            name: 'nhost-mcp-server',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
                resources: {},
            },
        });
        this.setupHandlers();
    }
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'graphql_query',
                        description: 'Execute a GraphQL query against Nhost',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'The GraphQL query to execute',
                                },
                                variables: {
                                    type: 'object',
                                    description: 'Variables for the GraphQL query',
                                },
                                project: {
                                    type: 'string',
                                    description: 'Project subdomain to query (defaults to first project)',
                                },
                            },
                            required: ['query'],
                        },
                    },
                    {
                        name: 'graphql_mutation',
                        description: 'Execute a GraphQL mutation against Nhost',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                mutation: {
                                    type: 'string',
                                    description: 'The GraphQL mutation to execute',
                                },
                                variables: {
                                    type: 'object',
                                    description: 'Variables for the GraphQL mutation',
                                },
                                project: {
                                    type: 'string',
                                    description: 'Project subdomain to query (defaults to first project)',
                                },
                            },
                            required: ['mutation'],
                        },
                    },
                    {
                        name: 'introspect_schema',
                        description: 'Get the GraphQL schema for an Nhost project',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                project: {
                                    type: 'string',
                                    description: 'Project subdomain to introspect (defaults to first project)',
                                },
                            },
                        },
                    },
                ],
            };
        });
        // List available resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            const projects = this.config.projects || [];
            return {
                resources: projects.map((project) => ({
                    uri: `nhost://${project.subdomain}/schema`,
                    name: `${project.subdomain} GraphQL Schema`,
                    description: `GraphQL schema for ${project.subdomain} project`,
                    mimeType: 'application/json',
                })),
            };
        });
        // Read resources
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const uri = new URL(request.params.uri);
            if (uri.protocol !== 'nhost:') {
                throw new Error(`Unsupported protocol: ${uri.protocol}`);
            }
            const subdomain = uri.hostname;
            const client = this.getClient(subdomain);
            if (uri.pathname === '/schema') {
                const schema = await client.introspectSchema();
                return {
                    contents: [
                        {
                            uri: request.params.uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(schema, null, 2),
                        },
                    ],
                };
            }
            throw new Error(`Unknown resource path: ${uri.pathname}`);
        });
        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'graphql_query':
                        return await this.handleGraphQLQuery(args);
                    case 'graphql_mutation':
                        return await this.handleGraphQLMutation(args);
                    case 'introspect_schema':
                        return await this.handleIntrospectSchema(args);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    getClient(subdomain) {
        const projects = this.config.projects || [];
        const targetSubdomain = subdomain || projects[0]?.subdomain;
        if (!targetSubdomain) {
            throw new Error('No projects configured');
        }
        if (!this.clients.has(targetSubdomain)) {
            const project = projects.find((p) => p.subdomain === targetSubdomain);
            if (!project) {
                throw new Error(`Project not found: ${targetSubdomain}`);
            }
            this.clients.set(targetSubdomain, new NhostGraphQLClient(project));
        }
        return this.clients.get(targetSubdomain);
    }
    async handleGraphQLQuery(args) {
        const { query, variables, project } = args;
        const client = this.getClient(project);
        const result = await client.executeQuery(query, variables);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    async handleGraphQLMutation(args) {
        const { mutation, variables, project } = args;
        const client = this.getClient(project);
        const result = await client.executeMutation(mutation, variables);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    async handleIntrospectSchema(args) {
        const { project } = args;
        const client = this.getClient(project);
        const schema = await client.introspectSchema();
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(schema, null, 2),
                },
            ],
        };
    }
    async run() {
        try {
            // Load configuration
            this.config = loadConfig();
            console.error('Loaded configuration with', this.config.projects?.length || 0, 'projects');
            // Start the server
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error('Nhost MCP Server running on stdio');
        }
        catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
}
// Start the server
const server = new NhostMCPServer();
server.run().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map