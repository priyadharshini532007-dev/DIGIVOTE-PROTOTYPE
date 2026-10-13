#!/usr/bin/env node
// Builds oops/data/oops-index.js from the real DigiVote repository.
//
//   node oops/tools/build-index.mjs            regenerate the index
//   node oops/tools/build-index.mjs --check    fail if the repository changed since the index was built
//
// The source repository defaults to ../Digi-Vote next to this project; set DIGIVOTE_SRC to override.
// Only files named in concepts.mjs are copied, only from backend/src/main/java and frontend/src, and
// configuration or secret-looking files are refused. Line numbers are resolved from anchor text, so a
// moved or deleted line fails the build instead of silently pointing at the wrong code.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONCEPTS, GROUPS } from './concepts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(process.env.DIGIVOTE_SRC || resolve(here, '../../../Digi-Vote'));
const OUT = resolve(here, '../data/oops-index.js');
const CHECK = process.argv.includes('--check');

const ALLOWED_ROOTS = ['backend/src/main/java/', 'frontend/src/'];
const REFUSED = /(^|\/)\.env|secret|credential.*\.json|\.pem$|\.key$|application[^/]*\.ya?ml$|firebase[^/]*\.json$/i;
const SCAN_EXT = /\.(java|js|jsx|mjs)$/;

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const errors = [];
const fail = (msg) => errors.push(msg);

function git(...args) {
  try { return execFileSync('git', ['-C', SRC, ...args], { encoding: 'utf8' }).trim(); } catch { return ''; }
}

function readSource(path) {
  if (!ALLOWED_ROOTS.some((r) => path.startsWith(r)) || REFUSED.test(path) || path.includes('..')) {
    throw new Error(`Refusing to publish ${path}: outside the allowed source folders or looks like configuration`);
  }
  const abs = resolve(SRC, path);
  if (!abs.startsWith(SRC + sep)) throw new Error(`Refusing ${path}: escapes the repository`);
  if (!existsSync(abs)) throw new Error(`Missing source file ${path}`);
  return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
}

// Line number (1-based) of the first occurrence of text at or after character offset `from`.
function lineAt(content, text, from = 0) {
  const i = content.indexOf(text, from);
  if (i < 0) return null;
  return { line: content.slice(0, i).split('\n').length, index: i };
}

const lineStart = (content, line) => content.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);

const files = new Map();
function file(path) {
  if (!files.has(path)) {
    const content = readSource(path);
    files.set(path, { content, sha256: sha256(content), lines: content.split('\n') });
  }
  return files.get(path);
}

function resolveRef(concept, ref) {
  const where = `${concept.id} → ${ref.file}`;
  let f;
  try { f = file(ref.file); } catch (e) { fail(`${where}: ${e.message}`); return null; }
  const [a, b] = ref.range;
  const start = lineAt(f.content, a);
  if (!start) { fail(`${where}: range start not found: ${JSON.stringify(a)}`); return null; }
  const endHit = lineAt(f.content, b, start.index);
  if (!endHit) { fail(`${where}: range end not found after line ${start.line}: ${JSON.stringify(b)}`); return null; }
  let end = endHit.line + b.split('\n').length - 1;
  // If the excerpt ends on a line that opens a block (a method or class header), include the whole block.
  const net = (s) => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  let depth = net(f.lines[end - 1]);
  for (let i = end; depth > 0 && i < f.lines.length && i < end + 50; i++) {
    depth += net(f.lines[i]);
    if (depth <= 0) end = i + 1;
  }
  const from = lineStart(f.content, start.line);
  const marks = [];
  for (const m of ref.marks || []) {
    const hit = lineAt(f.content, m.at, from);
    if (!hit || hit.line > end) { fail(`${where}: highlighted text not found in lines ${start.line}-${end}: ${JSON.stringify(m.at)}`); continue; }
    marks.push({ line: hit.line, note: m.note });
  }
  marks.sort((x, y) => x.line - y.line);
  return { file: ref.file, lang: ref.lang, symbol: ref.symbol, role: ref.role, start: start.line, end, marks, sha256: f.sha256 };
}

// Source files to scan for cross-references (names only; their content is not published).
function listSources() {
  const out = git('ls-files', ...ALLOWED_ROOTS).split('\n').filter((p) => SCAN_EXT.test(p) && !REFUSED.test(p) && !/\.test\.|\/test\//.test(p));
  return out;
}

function typeName(path) {
  const m = path.match(/([A-Za-z0-9_]+)\.(java|jsx?|mjs)$/);
  return m && /\.java$/.test(path) ? m[1] : null;
}

function referencesTo(name, selfPath, sources) {
  const re = new RegExp(`\\b${name}\\b`);
  const hits = [];
  for (const p of sources) {
    if (p === selfPath) continue;
    const lines = readFileSync(resolve(SRC, p), 'utf8').split('\n');
    lines.forEach((text, i) => {
      if (re.test(text) && !/^\s*(import|package|\*|\/\/)/.test(text)) {
        hits.push({ file: p, line: i + 1, text: text.trim().slice(0, 160), kind: classify(text, name) });
      }
    });
  }
  return hits;
}

function classify(text, name) {
  if (new RegExp(`extends\\s+${name}\\b`).test(text)) return 'extends';
  if (new RegExp(`implements[^{]*\\b${name}\\b`).test(text)) return 'implements';
  if (new RegExp(`new\\s+${name}\\b`).test(text)) return 'instantiates';
  if (/^\s*(private|protected|public)?\s*(final\s+)?[\w<>, .]+\s+\w+;\s*$/.test(text)) return 'field / injected';
  if (/\(\s*$|,\s*$|\)\s*\{\s*$/.test(text) && new RegExp(`${name}\\s+\\w+`).test(text)) return 'parameter / injected';
  return 'referenced';
}

// ------------------------------------------------------------------------------------------------- build
if (!existsSync(SRC)) {
  console.error(`DigiVote source repository not found at ${SRC}. Set DIGIVOTE_SRC.`);
  process.exit(2);
}

const sources = listSources();
const concepts = CONCEPTS.map((c) => {
  const refs = (c.refs || []).map((r) => resolveRef(c, r)).filter(Boolean);
  return { id: c.id, name: c.name, group: c.group, status: c.status, definition: c.definition, why: c.why || '',
    workflow: c.workflow || '', viva: c.viva || null, absent: c.absent || '', refs,
    languages: [...new Set(refs.map((r) => r.lang))] };
});

const xref = {};
for (const path of files.keys()) {
  const name = typeName(path);
  if (name) xref[path] = { name, hits: referencesTo(name, path, sources).slice(0, 40) };
}

if (errors.length) {
  console.error(`Index not written. ${errors.length} anchor problem(s):\n- ` + errors.join('\n- '));
  process.exit(1);
}

const meta = {
  sourceRepository: git('remote', 'get-url', 'origin').replace(/\/\/[^@/]+@/, '//') || 'DigiVote repository',
  commit: git('rev-parse', 'HEAD'),
  commitShort: git('rev-parse', '--short', 'HEAD'),
  commitDate: git('log', '-1', '--format=%cI'),
  uncommittedFiles: git('status', '--porcelain', '--', ...files.keys()).split('\n').filter(Boolean).map((l) => l.slice(3)),
  generatedAt: new Date().toISOString(),
  scannedFiles: sources.length,
};

const index = {
  version: 1, meta, groups: GROUPS, concepts, xref,
  files: Object.fromEntries([...files].map(([p, f]) => [p, { sha256: f.sha256, lines: f.lines }])),
};

if (CHECK) {
  if (!existsSync(OUT)) { console.error('No index yet; run without --check.'); process.exit(1); }
  const old = JSON.parse(readFileSync(OUT, 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, ''));
  const drift = Object.keys(index.files).filter((p) => old.files?.[p]?.sha256 !== index.files[p].sha256);
  if (drift.length) {
    console.error(`Index is stale: ${drift.length} source file(s) changed since it was built:\n- ${drift.join('\n- ')}\nRun node oops/tools/build-index.mjs`);
    process.exit(1);
  }
  console.log(`Index is current: ${Object.keys(index.files).length} files match commit ${old.meta.commitShort}.`);
  process.exit(0);
}

writeFileSync(OUT, `// Generated by oops/tools/build-index.mjs from ${meta.commitShort}. Do not edit by hand.\nwindow.DIGIVOTE_OOPS_INDEX = ${JSON.stringify(index)};\n`);
const found = concepts.filter((c) => c.status !== 'absent');
console.log(`Wrote ${relative(process.cwd(), OUT)}: ${found.length} concepts with code, ${concepts.length - found.length} not found, ` +
  `${concepts.reduce((n, c) => n + c.refs.length, 0)} excerpts from ${files.size} files at ${meta.commitShort}` +
  (meta.uncommittedFiles.length ? ` (uncommitted changes in: ${meta.uncommittedFiles.join(', ')})` : '') + '.');
