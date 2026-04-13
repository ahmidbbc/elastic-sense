#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8'
  });
}

function ensureSuccess(result, label) {
  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : '';
    const stdout = result.stdout ? `\n${result.stdout}` : '';
    throw new Error(`${label} failed with exit code ${result.status}.${stdout}${stderr}`);
  }
}

function writeRemoteShim(pluginData, outputFile) {
  const binDir = path.join(pluginData, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });

  if (process.platform === 'win32') {
    const cmdPath = path.join(binDir, 'mcp-remote.cmd');
    const jsPath = path.join(binDir, 'mcp-remote.js');

    fs.writeFileSync(
      jsPath,
      `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync(process.env.SMOKE_OUTPUT_FILE, JSON.stringify({ argv: process.argv.slice(2) }, null, 2));
`
    );

    fs.writeFileSync(cmdPath, `@echo off\r\nnode "%~dp0\\mcp-remote.js" %*\r\n`);
    return;
  }

  const shimPath = path.join(binDir, 'mcp-remote');
  fs.writeFileSync(
    shimPath,
    `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync(process.env.SMOKE_OUTPUT_FILE, JSON.stringify({ argv: process.argv.slice(2) }, null, 2));
`
  );
  fs.chmodSync(shimPath, 0o755);
}

function writeDockerShim(binDir) {
  fs.mkdirSync(binDir, { recursive: true });

  if (process.platform === 'win32') {
    const cmdPath = path.join(binDir, 'docker.cmd');
    const jsPath = path.join(binDir, 'docker.js');

    fs.writeFileSync(
      jsPath,
      `#!/usr/bin/env node
const fs = require('fs');
const payload = {
  argv: process.argv.slice(2),
  env: {
    ES_URL: process.env.ES_URL,
    ES_API_KEY: process.env.ES_API_KEY,
    ES_SSL_SKIP_VERIFY: process.env.ES_SSL_SKIP_VERIFY
  }
};
if (process.argv[2] === '--version') {
  process.stdout.write('Docker version smoke-test');
  process.exit(0);
}
fs.writeFileSync(process.env.SMOKE_DOCKER_OUTPUT_FILE, JSON.stringify(payload, null, 2));
`
    );

    fs.writeFileSync(cmdPath, `@echo off\r\nnode "%~dp0\\docker.js" %*\r\n`);
    return;
  }

  const shimPath = path.join(binDir, 'docker');
  fs.writeFileSync(
    shimPath,
    `#!/usr/bin/env node
const fs = require('fs');
const payload = {
  argv: process.argv.slice(2),
  env: {
    ES_URL: process.env.ES_URL,
    ES_API_KEY: process.env.ES_API_KEY,
    ES_SSL_SKIP_VERIFY: process.env.ES_SSL_SKIP_VERIFY
  }
};
if (process.argv[2] === '--version') {
  process.stdout.write('Docker version smoke-test');
  process.exit(0);
}
fs.writeFileSync(process.env.SMOKE_DOCKER_OUTPUT_FILE, JSON.stringify(payload, null, 2));
`
  );
  fs.chmodSync(shimPath, 0o755);
}

function runAgentBuilderSmoke(repoRoot, pluginData, outputFile) {
  const mcpUrl = 'https://kibana.example.com/api/agent_builder/mcp';
  const apiKey = 'smoke-test-api-key';

  const startup = run(process.execPath, ['scripts/start-mcp.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: repoRoot,
      CLAUDE_PLUGIN_DATA: pluginData,
      ELASTIC_MCP_URL: mcpUrl,
      ELASTIC_API_KEY: apiKey,
      USE_LEGACY_DIRECT_MODE: 'false',
      SMOKE_OUTPUT_FILE: outputFile
    }
  });
  ensureSuccess(startup, 'Agent Builder smoke startup');

  assert.ok(fs.existsSync(outputFile), 'Expected the fake mcp-remote binary to be invoked');

  const remoteCall = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  assert.deepStrictEqual(remoteCall.argv, [
    mcpUrl,
    '--header',
    `Authorization: ApiKey ${apiKey}`
  ]);
}

function runLegacySmoke(repoRoot, pluginData, binDir, outputFile) {
  const legacyEsUrl = 'http://host.docker.internal:9200';

  writeDockerShim(binDir);

  const startup = run(process.execPath, ['scripts/start-mcp.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: repoRoot,
      CLAUDE_PLUGIN_DATA: pluginData,
      USE_LEGACY_DIRECT_MODE: 'true',
      LEGACY_ES_URL: legacyEsUrl,
      LEGACY_ES_SSL_SKIP_VERIFY: 'true',
      SMOKE_DOCKER_OUTPUT_FILE: outputFile,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`
    }
  });
  ensureSuccess(startup, 'Legacy direct smoke startup');

  assert.ok(fs.existsSync(outputFile), 'Expected the fake docker binary to be invoked');

  const dockerCall = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  assert.deepStrictEqual(dockerCall.argv, [
    'run',
    '-i',
    '--rm',
    '-e',
    'ES_URL',
    '-e',
    'ES_SSL_SKIP_VERIFY',
    'docker.elastic.co/mcp/elasticsearch',
    'stdio'
  ]);
  assert.strictEqual(dockerCall.env.ES_URL, legacyEsUrl);
  assert.ok(!dockerCall.env.ES_API_KEY, 'Legacy smoke test should allow running without API key');
  assert.strictEqual(dockerCall.env.ES_SSL_SKIP_VERIFY, 'true');
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const sourcePackageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elastic-sense-smoke-'));
  const pluginData = path.join(tempRoot, 'plugin-data');
  const binDir = path.join(tempRoot, 'bin');
  const agentBuilderOutput = path.join(tempRoot, 'remote-call.json');
  const legacyOutput = path.join(tempRoot, 'docker-call.json');

  try {
    fs.mkdirSync(pluginData, { recursive: true });
    fs.writeFileSync(path.join(pluginData, 'package.json'), sourcePackageJson);
    writeRemoteShim(pluginData, agentBuilderOutput);

    const validation = run(process.execPath, ['scripts/validate-plugin.js'], { cwd: repoRoot, env: process.env });
    ensureSuccess(validation, 'Manifest validation');

    runAgentBuilderSmoke(repoRoot, pluginData, agentBuilderOutput);
    runLegacySmoke(repoRoot, pluginData, binDir, legacyOutput);

    console.log('ElasticSense smoke test passed.');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
