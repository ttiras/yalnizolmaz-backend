import { GraphQLClient } from 'graphql-request';
import { ProjectConfig, getGraphQLEndpoint, getAdminHeaders } from './config.js';

export class NhostGraphQLClient {
  private client: GraphQLClient;
  private project: ProjectConfig;

  constructor(project: ProjectConfig) {
    this.project = project;
    const endpoint = getGraphQLEndpoint(project);
    const headers = getAdminHeaders(project);
    
    this.client = new GraphQLClient(endpoint, {
      headers,
    });
  }

  async executeQuery(query: string, variables?: Record<string, any>): Promise<any> {
    try {
      const result = await this.client.request(query, variables);
      return result;
    } catch (error) {
      console.error('GraphQL query error:', error);
      throw error;
    }
  }

  async executeMutation(mutation: string, variables?: Record<string, any>): Promise<any> {
    try {
      const result = await this.client.request(mutation, variables);
      return result;
    } catch (error) {
      console.error('GraphQL mutation error:', error);
      throw error;
    }
  }

  async introspectSchema(): Promise<any> {
    const introspectionQuery = `
      query IntrospectionQuery {
        __schema {
          queryType { name }
          mutationType { name }
          subscriptionType { name }
          types {
            ...FullType
          }
          directives {
            name
            description
            locations
            args {
              ...InputValue
            }
          }
        }
      }

      fragment FullType on __Type {
        kind
        name
        description
        fields(includeDeprecated: true) {
          name
          description
          args {
            ...InputValue
          }
          type {
            ...TypeRef
          }
          isDeprecated
          deprecationReason
        }
        inputFields {
          ...InputValue
        }
        interfaces {
          ...TypeRef
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
        possibleTypes {
          ...TypeRef
        }
      }

      fragment InputValue on __InputValue {
        name
        description
        type { ...TypeRef }
        defaultValue
      }

      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    return this.executeQuery(introspectionQuery);
  }

  isQueryAllowed(queryName: string): boolean {
    return this.project.allow_queries.includes('*') || 
           this.project.allow_queries.includes(queryName);
  }

  isMutationAllowed(mutationName: string): boolean {
    return this.project.allow_mutations.includes('*') || 
           this.project.allow_mutations.includes(mutationName);
  }
}

