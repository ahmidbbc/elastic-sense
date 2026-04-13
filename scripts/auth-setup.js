#!/usr/bin/env node

const { URL } = require('url');

function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim();

  if (!trimmed) {
    throw new Error('URL is required');
  }

  return trimmed.replace(/\/+$/, '');
}

function buildMcpUrl(kibanaUrl, space) {
  const baseUrl = normalizeBaseUrl(kibanaUrl);
  const normalizedSpace = String(space || '').trim();

  if (baseUrl.includes('/api/agent_builder/mcp')) {
    return baseUrl;
  }

  if (normalizedSpace) {
    return `${baseUrl}/s/${normalizedSpace}/api/agent_builder/mcp`;
  }

  return `${baseUrl}/api/agent_builder/mcp`;
}

function buildRoleDescriptor(space, indexPattern) {
  const normalizedSpace = String(space || 'default').trim() || 'default';
  const normalizedIndexPattern = String(indexPattern || '*').trim() || '*';

  return {
    name: 'elastic-sense-mcp-key',
    expiration: '30d',
    role_descriptors: {
      'elastic-sense-mcp-access': {
        cluster: ['monitor_inference'],
        indices: [
          {
            names: [normalizedIndexPattern],
            privileges: ['read', 'view_index_metadata']
          }
        ],
        applications: [
          {
            application: 'kibana-.kibana',
            privileges: ['feature_agentBuilder.read'],
            resources: [`space:${normalizedSpace}`]
          }
        ]
      }
    }
  };
}

function buildLegacyRoleDescriptor(indexPattern) {
  const normalizedIndexPattern = String(indexPattern || '*').trim() || '*';

  return {
    name: 'elastic-sense-legacy-direct-key',
    expiration: '30d',
    role_descriptors: {
      'elastic-sense-legacy-direct-access': {
        cluster: ['monitor'],
        indices: [
          {
            names: [normalizedIndexPattern],
            privileges: ['read', 'view_index_metadata']
          }
        ]
      }
    }
  };
}

function runAgentBuilderDoctor(mcpUrl) {
  const parsedUrl = new URL(mcpUrl);
  const hasEndpoint = parsedUrl.pathname.includes('/api/agent_builder/mcp');
  const usesHttps = parsedUrl.protocol === 'https:';

  console.log(`MCP URL: ${mcpUrl}`);
  console.log(`Protocol: ${parsedUrl.protocol}`);
  console.log(`Agent Builder endpoint detected: ${hasEndpoint ? 'yes' : 'no'}`);
  console.log(`HTTPS: ${usesHttps ? 'yes' : 'no'}`);

  if (!hasEndpoint) {
    process.exitCode = 1;
    console.log('Expected a URL ending with /api/agent_builder/mcp or /s/<space>/api/agent_builder/mcp.');
  }
}

function runLegacyDoctor(esUrl) {
  const parsedUrl = new URL(esUrl);
  const hasAgentBuilderPath = parsedUrl.pathname.includes('/api/agent_builder/mcp');
  const usesHttp = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';

  console.log(`Elasticsearch URL: ${esUrl}`);
  console.log(`Protocol: ${parsedUrl.protocol}`);
  console.log(`Looks like direct Elasticsearch URL: ${usesHttp && !hasAgentBuilderPath ? 'yes' : 'no'}`);

  if (hasAgentBuilderPath || !usesHttp) {
    process.exitCode = 1;
    console.log('Legacy direct mode expects a direct Elasticsearch URL, not a Kibana Agent Builder MCP endpoint.');
  }
}

function printUsage() {
  console.log(`
Usage: node scripts/auth-setup.js <command> [options]

Commands:
  build-url <kibana_url> [space]        Print the Elastic Agent Builder MCP URL
  print-role [space] [index_pattern]    Print an Elastic Agent Builder API key payload
  print-legacy-role [index_pattern]     Print a legacy direct Elasticsearch API key payload
  doctor <mcp_url>                      Validate a copied Agent Builder MCP URL
  doctor-legacy <es_url>                Validate a direct Elasticsearch URL for legacy mode

Examples:
  node scripts/auth-setup.js build-url https://kibana.example.com
  node scripts/auth-setup.js build-url https://kibana.example.com observability
  node scripts/auth-setup.js print-role default "logs-*,metrics-*"
  node scripts/auth-setup.js print-legacy-role "logs-*,metrics-*"
  node scripts/auth-setup.js doctor https://kibana.example.com/api/agent_builder/mcp
  node scripts/auth-setup.js doctor-legacy https://elasticsearch.example.com:9200
  `);
}

function main() {
  const [command, arg1, arg2] = process.argv.slice(2);

  try {
    switch (command) {
      case 'build-url':
        console.log(buildMcpUrl(arg1, arg2));
        break;
      case 'print-role':
        console.log(JSON.stringify(buildRoleDescriptor(arg1, arg2), null, 2));
        break;
      case 'print-legacy-role':
        console.log(JSON.stringify(buildLegacyRoleDescriptor(arg1), null, 2));
        break;
      case 'doctor':
        runAgentBuilderDoctor(arg1);
        break;
      case 'doctor-legacy':
        runLegacyDoctor(arg1);
        break;
      default:
        printUsage();
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildMcpUrl,
  buildRoleDescriptor,
  buildLegacyRoleDescriptor
};
