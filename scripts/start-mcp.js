#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

function fail(message) {
  console.error(`[elastic-sense] ${message}`);
  process.exit(1);
}

function readFileIfPresent(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function normalizeBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function getRemoteBinaryPath(pluginData) {
  const executable = process.platform === 'win32' ? 'mcp-remote.cmd' : 'mcp-remote';
  return path.join(pluginData, 'node_modules', '.bin', executable);
}

function ensureRemoteDependency(pluginRoot, pluginData) {
  const sourcePackageJson = path.join(pluginRoot, 'package.json');
  const cachedPackageJson = path.join(pluginData, 'package.json');
  const sourcePackage = readFileIfPresent(sourcePackageJson);

  if (!sourcePackage) {
    fail(`Missing package manifest at ${sourcePackageJson}`);
  }

  fs.mkdirSync(pluginData, { recursive: true });

  const installNeeded =
    readFileIfPresent(cachedPackageJson) !== sourcePackage ||
    !fs.existsSync(getRemoteBinaryPath(pluginData));

  if (!installNeeded) {
    return;
  }

  fs.writeFileSync(cachedPackageJson, sourcePackage);

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(
    npmCommand,
    ['install', '--omit=dev', '--ignore-scripts'],
    {
      cwd: pluginData,
      stdio: 'inherit'
    }
  );

  if (result.status !== 0 || !fs.existsSync(getRemoteBinaryPath(pluginData))) {
    fail('Unable to install the plugin-managed MCP bridge dependency (mcp-remote).');
  }
}

function spawnProcess(command, args, options) {
  const child = spawn(command, args, options);

  child.on('error', (error) => {
    fail(`Failed to start ${command}: ${error.message}`);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

function startAgentBuilderMode(pluginRoot, pluginData, mcpUrl, apiKey) {
  if (!mcpUrl) {
    fail('Missing ELASTIC_MCP_URL. Disable legacy direct mode or provide the Elastic Agent Builder MCP URL.');
  }

  if (!apiKey) {
    fail('Missing ELASTIC_API_KEY. Provide an Elastic API key.');
  }

  ensureRemoteDependency(pluginRoot, pluginData);

  const remoteBinary = getRemoteBinaryPath(pluginData);
  const binDir = path.dirname(remoteBinary);

  spawnProcess(
    remoteBinary,
    [
      mcpUrl,
      '--header',
      `Authorization: ApiKey ${apiKey}`
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_PATH: path.join(pluginData, 'node_modules'),
        PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`
      }
    }
  );
}

function startLegacyDirectMode(legacyEsUrl, apiKey, skipVerify) {
  if (!legacyEsUrl) {
    fail('Missing LEGACY_ES_URL. Provide a direct Elasticsearch URL when legacy direct mode is enabled.');
  }

  const dockerCheck = spawnSync('docker', ['--version'], { stdio: 'ignore' });
  if (dockerCheck.status !== 0) {
    fail('Legacy direct mode requires Docker because the deprecated elastic/mcp-server-elasticsearch server is distributed as a container image.');
  }

  const args = [
    'run',
    '-i',
    '--rm',
    '-e',
    'ES_URL'
  ];

  if (apiKey) {
    args.push('-e', 'ES_API_KEY');
  }

  if (skipVerify) {
    args.push('-e', 'ES_SSL_SKIP_VERIFY');
  }

  args.push(
    'docker.elastic.co/mcp/elasticsearch',
    'stdio'
  );

  spawnProcess(
    'docker',
    args,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        ES_URL: legacyEsUrl,
        ES_SSL_SKIP_VERIFY: skipVerify ? 'true' : 'false'
      }
    }
  );
}

function main() {
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
  const pluginData = process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.claude', 'plugins', 'data', 'elastic-sense-dev');
  const useLegacyDirectMode = normalizeBoolean(process.env.USE_LEGACY_DIRECT_MODE);
  const mcpUrl = process.env.ELASTIC_MCP_URL;
  const apiKey = process.env.ELASTIC_API_KEY;
  const legacyEsUrl = process.env.LEGACY_ES_URL;
  const legacySkipVerify = normalizeBoolean(process.env.LEGACY_ES_SSL_SKIP_VERIFY);

  if (useLegacyDirectMode) {
    startLegacyDirectMode(legacyEsUrl, apiKey, legacySkipVerify);
    return;
  }

  startAgentBuilderMode(pluginRoot, pluginData, mcpUrl, apiKey);
}

main();
