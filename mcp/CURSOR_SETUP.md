# Cursor MCP Server Setup

## Quick Setup

Your Nhost MCP server is ready! Follow these steps to integrate it with Cursor:

### 1. Add to Cursor Settings

Open Cursor Settings → Features → Model Context Protocol, and add this configuration:

```json
{
  "mcpServers": {
    "nhost": {
      "command": "/Users/tacettintiras/Documents/yalnizolmaz/nhost/mcp/start.sh"
    }
  }
}
```

### 2. Start Your Nhost Development Server

Make sure your Nhost local development server is running:

```bash
# In your nhost directory
cd /Users/tacettintiras/Documents/yalnizolmaz/nhost
nhost dev
```

### 3. Test the Integration

Once configured, you can use these commands in Cursor:

- **Query your database**: Ask Cursor to "show me all users from the database"
- **Inspect schema**: "What tables are available in my Nhost database?"
- **Run mutations**: "Create a new user with email test@example.com"

## Available Tools

The MCP server provides these tools to Cursor:

1. **graphql_query** - Execute GraphQL queries
2. **graphql_mutation** - Execute GraphQL mutations  
3. **introspect_schema** - Get the complete GraphQL schema

## Configuration File

Your configuration is in `/Users/tacettintiras/Documents/yalnizolmaz/nhost/mcp-nhost.toml`:

```toml
[cloud]
pat = "f1bb0d56-e1d2-4bb5-8a41-06179edea165"
enable_mutations = false

[[projects]]
subdomain = "local"
region = "local"
admin_secret = "nhost-admin-secret"
allow_queries = ["*"]
allow_mutations = ["*"]
```

## Troubleshooting

- **Server won't start**: Run `./test-server.js` to check for issues
- **Cursor can't connect**: Verify the path in your Cursor settings is correct
- **Permission errors**: Check your `admin_secret` matches your Nhost configuration
- **No data returned**: Ensure your Nhost development server is running on localhost:8080

## Security Notes

- The server uses your Nhost admin secret for authentication
- Queries and mutations are filtered based on your configuration
- All requests go through your local Nhost instance (no cloud access by default)

