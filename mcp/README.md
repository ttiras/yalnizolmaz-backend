# Nhost MCP Server

A Model Context Protocol (MCP) server for integrating with Nhost GraphQL endpoints.

## Setup

### 1. Install Dependencies

```bash
cd nhost/mcp
pnpm install
```

### 2. Build the Project

```bash
pnpm run build
```

### 3. Configuration

The server reads configuration from `../mcp-nhost.toml` (relative to the mcp directory). The configuration file should look like:

```toml
[cloud]
pat = "your-personal-access-token"
enable_mutations = false

[[projects]]
subdomain = "local"
region = "local"
admin_secret = "nhost-admin-secret"
allow_queries = ["*"]
allow_mutations = ["*"]
```

### 4. Running the Server

#### Development Mode
```bash
pnpm run dev
```

#### Production Mode
```bash
pnpm start
```

#### Using the Start Script
```bash
./start.sh
```

## Cursor Integration

To integrate with Cursor, add the following to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "nhost": {
      "command": "/Users/tacettintiras/Documents/yalnizolmaz/nhost/mcp/start.sh"
    }
  }
}
```

## Available Tools

### `graphql_query`
Execute GraphQL queries against your Nhost project.

**Parameters:**
- `query` (required): The GraphQL query string
- `variables` (optional): Query variables
- `project` (optional): Project subdomain (defaults to first configured project)

### `graphql_mutation`
Execute GraphQL mutations against your Nhost project.

**Parameters:**
- `mutation` (required): The GraphQL mutation string
- `variables` (optional): Mutation variables
- `project` (optional): Project subdomain (defaults to first configured project)

### `introspect_schema`
Get the GraphQL schema for a project.

**Parameters:**
- `project` (optional): Project subdomain (defaults to first configured project)

## Resources

The server exposes GraphQL schemas as resources:
- `nhost://{subdomain}/schema` - GraphQL schema for the specified project

## Security

- The server respects the `allow_queries` and `allow_mutations` configuration
- Uses admin secrets for authentication with Nhost
- All requests are validated against the configured permissions

## Troubleshooting

1. **Configuration not found**: Ensure `mcp-nhost.toml` exists in the parent directory
2. **Connection errors**: Check that your Nhost instance is running (for local projects)
3. **Permission errors**: Verify your admin secret and allowed operations in the config
