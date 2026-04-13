#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const requiredPaths = [
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  'config/mcp.json',
  'README.md',
  'setup/installation-guide.md',
  'scripts/start-mcp.js',
  'config/legacy-direct-api-key-role.template.json',
  'skills/log-analysis/SKILL.md',
  'skills/error-investigation/SKILL.md',
  'skills/performance-monitoring/SKILL.md',
  'skills/cluster-health/SKILL.md'
];

function run(command, args) {
  return spawnSync(command, args, { stdio: 'inherit' });
}

function readJson(relativePath) {
  const absolutePath = path.resolve(relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertRequiredPaths() {
  const missing = requiredPaths.filter((relativePath) => !fs.existsSync(path.resolve(relativePath)));

  if (missing.length > 0) {
    console.error('Missing required files:');
    missing.forEach((relativePath) => console.error(`- ${relativePath}`));
    process.exit(1);
  }
}

function warnLegacyFiles() {
  ['marketplace.json', 'mcp.json', '.mcp.json', '.claude-plugin/mcp.json'].forEach((legacyFile) => {
    if (fs.existsSync(path.resolve(legacyFile))) {
      console.warn(`Legacy file still present and should stay deleted: ${legacyFile}`);
    }
  });
}

function hasClaudeCli() {
  const result = spawnSync('claude', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function validateUserConfig(userConfig) {
  assert(userConfig && typeof userConfig === 'object' && !Array.isArray(userConfig), 'plugin.json userConfig must be an object.');

  for (const [key, field] of Object.entries(userConfig)) {
    assert(typeof key === 'string' && key.length > 0, 'userConfig keys must be non-empty strings.');
    assert(field && typeof field === 'object' && !Array.isArray(field), `userConfig.${key} must be an object.`);
    assert(typeof field.title === 'string' && field.title.length > 0, `userConfig.${key}.title is required.`);
    assert(typeof field.description === 'string' && field.description.length > 0, `userConfig.${key}.description is required.`);
    assert(['string', 'boolean', 'number', 'directory'].includes(field.type), `userConfig.${key}.type must be supported.`);

    if (Object.prototype.hasOwnProperty.call(field, 'sensitive')) {
      assert(typeof field.sensitive === 'boolean', `userConfig.${key}.sensitive must be a boolean when present.`);
    }
  }
}

function validateMcpConfig(relativePath) {
  const mcpConfig = readJson(relativePath);

  assert(mcpConfig.mcpServers && typeof mcpConfig.mcpServers === 'object' && !Array.isArray(mcpConfig.mcpServers), 'MCP config must define an mcpServers object.');

  const serverEntries = Object.entries(mcpConfig.mcpServers);
  assert(serverEntries.length > 0, 'MCP config must declare at least one server.');

  for (const [serverName, server] of serverEntries) {
    assert(typeof serverName === 'string' && serverName.length > 0, 'MCP server names must be non-empty strings.');
    assert(server && typeof server === 'object' && !Array.isArray(server), `MCP server ${serverName} must be an object.`);
    assert(typeof server.command === 'string' && server.command.length > 0, `MCP server ${serverName} must define a command.`);
    assert(Array.isArray(server.args), `MCP server ${serverName}.args must be an array.`);

    if (Object.prototype.hasOwnProperty.call(server, 'env')) {
      assert(server.env && typeof server.env === 'object' && !Array.isArray(server.env), `MCP server ${serverName}.env must be an object.`);
    }
  }
}

function validatePluginManifest() {
  const pluginManifest = readJson('.claude-plugin/plugin.json');

  assert(typeof pluginManifest.name === 'string' && pluginManifest.name.length > 0, 'plugin.json name is required.');
  assert(typeof pluginManifest.version === 'string' && pluginManifest.version.length > 0, 'plugin.json version is required.');
  assert(typeof pluginManifest.description === 'string' && pluginManifest.description.length > 0, 'plugin.json description is required.');
  assert(typeof pluginManifest.mcpServers === 'string' && pluginManifest.mcpServers.length > 0, 'plugin.json mcpServers must point to a relative JSON file.');

  const candidateMcpPaths = [
    path.resolve(pluginManifest.mcpServers),
    path.resolve('.claude-plugin', pluginManifest.mcpServers)
  ];
  const referencedMcpPath = candidateMcpPaths.find((candidatePath) => fs.existsSync(candidatePath));
  assert(referencedMcpPath, `Referenced MCP config does not exist: ${pluginManifest.mcpServers}`);
  validateMcpConfig(referencedMcpPath);

  validateUserConfig(pluginManifest.userConfig);
}

function validateMarketplaceManifest() {
  const marketplaceManifest = readJson('.claude-plugin/marketplace.json');

  assert(typeof marketplaceManifest.name === 'string' && marketplaceManifest.name.length > 0, 'marketplace.json name is required.');
  assert(marketplaceManifest.owner && typeof marketplaceManifest.owner === 'object', 'marketplace.json owner is required.');
  assert(typeof marketplaceManifest.owner.name === 'string' && marketplaceManifest.owner.name.length > 0, 'marketplace.json owner.name is required.');
  assert(typeof marketplaceManifest.owner.email === 'string' && marketplaceManifest.owner.email.length > 0, 'marketplace.json owner.email is required.');
  assert(marketplaceManifest.metadata && typeof marketplaceManifest.metadata === 'object', 'marketplace.json metadata is required.');
  assert(Array.isArray(marketplaceManifest.plugins) && marketplaceManifest.plugins.length > 0, 'marketplace.json must define at least one plugin.');

  for (const plugin of marketplaceManifest.plugins) {
    assert(typeof plugin.name === 'string' && plugin.name.length > 0, 'marketplace plugin name is required.');
    assert(typeof plugin.source === 'string' && plugin.source.length > 0, `marketplace plugin ${plugin.name} source is required.`);
    assert(typeof plugin.description === 'string' && plugin.description.length > 0, `marketplace plugin ${plugin.name} description is required.`);
  }
}

function runOfficialValidation() {
  const pluginValidation = run('claude', ['plugin', 'validate', '.claude-plugin/plugin.json']);
  if (pluginValidation.status !== 0) {
    process.exit(pluginValidation.status ?? 1);
  }

  const marketplaceValidation = run('claude', ['plugin', 'validate', '.claude-plugin/marketplace.json']);
  if (marketplaceValidation.status !== 0) {
    process.exit(marketplaceValidation.status ?? 1);
  }
}

function runFallbackValidation() {
  validatePluginManifest();
  validateMarketplaceManifest();
  console.log('Claude CLI not found. Ran structural manifest validation fallback.');
}

function main() {
  assertRequiredPaths();
  warnLegacyFiles();

  if (hasClaudeCli()) {
    runOfficialValidation();
  } else {
    runFallbackValidation();
  }

  console.log('ElasticSense validation passed.');
}

main();
