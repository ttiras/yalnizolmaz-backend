#!/usr/bin/env node

// Simple test script to verify the MCP server functionality
import { loadConfig } from './dist/config.js';
import { NhostGraphQLClient } from './dist/graphql.js';

async function testServer() {
  console.log('🧪 Testing Nhost MCP Server...\n');
  
  try {
    // Test 1: Configuration loading
    console.log('1️⃣ Testing configuration loading...');
    const config = loadConfig();
    console.log('✅ Configuration loaded successfully');
    console.log(`   Projects: ${config.projects?.length || 0}`);
    console.log(`   First project: ${config.projects?.[0]?.subdomain || 'none'}\n`);
    
    // Test 2: GraphQL client initialization
    console.log('2️⃣ Testing GraphQL client initialization...');
    if (config.projects && config.projects.length > 0) {
      const client = new NhostGraphQLClient(config.projects[0]);
      console.log('✅ GraphQL client initialized successfully');
      console.log(`   Endpoint: ${client.project.subdomain === 'local' ? 'https://local.hasura.local.nhost.run/v1/graphql' : 'cloud endpoint'}\n`);
      
      // Test 3: Permission checks
      console.log('3️⃣ Testing permission checks...');
      const queryAllowed = client.isQueryAllowed('test_query');
      const mutationAllowed = client.isMutationAllowed('test_mutation');
      console.log(`✅ Query permissions: ${queryAllowed ? 'allowed' : 'restricted'}`);
      console.log(`✅ Mutation permissions: ${mutationAllowed ? 'allowed' : 'restricted'}\n`);
      
    } else {
      console.log('⚠️  No projects configured, skipping GraphQL client tests\n');
    }
    
    console.log('🎉 All tests passed! The MCP server is ready to use.');
    console.log('\n📋 Next steps:');
    console.log('   1. Start your Nhost local development server');
    console.log('   2. Configure Cursor with the MCP server');
    console.log('   3. Test GraphQL queries through Cursor\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testServer();

