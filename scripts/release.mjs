#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const pkgPath = resolve(rootDir, 'package.json');

function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) throw new Error(`Invalid semver: "${version}"`);
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] ?? null,
  };
}

function formatVersion({ major, minor, patch, prerelease }) {
  const base = `${major}.${minor}.${patch}`;
  return prerelease ? `${base}-${prerelease}` : base;
}

function bumpBase(parts, type) {
  switch (type) {
    case 'major': return { major: parts.major + 1, minor: 0, patch: 0, prerelease: null };
    case 'minor': return { major: parts.major, minor: parts.minor + 1, patch: 0, prerelease: null };
    default:      return { major: parts.major, minor: parts.minor, patch: parts.patch + 1, prerelease: null };
  }
}

// Escape a string for use in a RegExp
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function branchToSuffix(branch) {
  return branch.replace(/\//g, '-').toLowerCase();
}

function exec(cmd) {
  return execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

// --- Validate release type ---
const releaseType = process.argv[2] ?? 'patch';
if (!['patch', 'minor', 'major'].includes(releaseType)) {
  console.error(`Error: invalid release type "${releaseType}". Use patch, minor, or major.`);
  process.exit(1);
}

// --- Ensure working tree is clean ---
const status = execSync('git status --porcelain', { cwd: rootDir }).toString().trim();
if (status) {
  console.error('Error: working tree is not clean. Commit or stash your changes before releasing.');
  process.exit(1);
}

// --- Determine current branch ---
const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: rootDir }).toString().trim();
const isMaster = branch === 'master' || branch === 'main';

// --- Read current version ---
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const current = parseSemver(pkg.version);

// --- Compute new version ---
let newVersion;

if (isMaster) {
  newVersion = formatVersion(bumpBase(current, releaseType));
} else {
  const suffix = branchToSuffix(branch);
  const preReleasePattern = new RegExp(`^${escapeRegExp(suffix)}\\.(\\d+)$`);
  const match = current.prerelease && preReleasePattern.exec(current.prerelease);

  if (match && releaseType === 'patch') {
    // Same branch pre-release + patch: just increment the pre-release counter
    const next = parseInt(match[1], 10) + 1;
    newVersion = formatVersion({ ...current, prerelease: `${suffix}.${next}` });
  } else {
    // Bump base version and start a fresh pre-release at .1
    newVersion = formatVersion({ ...bumpBase(current, releaseType), prerelease: `${suffix}.1` });
  }
}

console.log(`Bumping version: ${pkg.version} → ${newVersion}`);

// --- Update package.json ---
pkg.version = newVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// --- Update package-lock.json ---
exec('npm install --package-lock-only');

// --- Commit, tag, and push ---
exec('git add package.json package-lock.json');
exec(`git commit -m "VERSION: v${newVersion}"`);
exec(`git tag v${newVersion}`);
exec('git push');
exec('git push --tags');

console.log(`\nReleased v${newVersion}`);
