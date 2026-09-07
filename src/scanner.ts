/**
 * Pure text scanner -- no `vscode` dependency. Ported from the
 * IntelliJ-family sql-concatenation-companion (SqlConcatenationScanner
 * + SqlKeywordDetector + SqlSignalNames), already plain-text/regex
 * analysis with zero PSI dependency in the original -- deliberately
 * so, since it targets Java, Kotlin, AND Python source in one pass.
 *
 * Two layers, both required:
 * 1. Shape: a SQL-keyword-shaped string literal combined via `+`
 *    concatenation or string-template/f-string interpolation with a
 *    non-constant operand.
 * 2. Context: the resulting expression sits within CONTEXT_WINDOW_CHARS
 *    of a call that looks like it executes SQL.
 *
 * v0.1 scope, honestly noted (same as the original): plain-text
 * scanning, not a real per-language lexer -- a string literal or
 * comment whose text happens to contain the shape verbatim is
 * indistinguishable from real code (rare in practice). StringBuilder-
 * style accumulation across multiple statements is out of scope --
 * only single-expression concatenation/interpolation is detected.
 */

export interface Hit {
  startOffset: number;
  endOffset: number;
  interpolatedName: string | null;
}

const CONTEXT_WINDOW_CHARS = 200;

const LEADING_KEYWORDS = ['select', 'insert', 'update', 'delete', 'merge', 'with', 'create', 'alter', 'drop', 'truncate'];
const KEYWORD_PATTERN = new RegExp(`^(${LEADING_KEYWORDS.join('|')})\\b`, 'i');

/** Does a string literal's text look like the start of a real SQL
 * statement? Deliberately narrow: only standard DML/DDL leading
 * keywords, matched at the start of the trimmed text -- never "the
 * word SELECT appears anywhere" (which would flag ordinary log
 * messages/prose). */
export function looksLikeSqlStart(literalText: string): boolean {
  return KEYWORD_PATTERN.test(literalText.replace(/^\s+/, ''));
}

// Method/function simple names (case-insensitive) that, when the
// candidate SQL-shaped expression is passed as an argument, are a
// strong "this string is about to run as SQL" signal. Name-based, not
// resolved-symbol-based -- works whether the receiver is
// java.sql.Statement, a Spring JdbcTemplate, a hand-rolled DAO, or
// Python's sqlite3/psycopg2/MySQLdb cursor (DB-API 2.0 / PEP 249).
const SIGNAL_METHOD_NAMES = new Set([
  'executequery', 'executeupdate', 'execute', 'executemany', 'executebatch',
  'executelargeupdate', 'rawquery', 'query', 'createquery', 'createnativequery', 'createsqlquery',
]);

export function isSignalMethodName(simpleName: string): boolean {
  return SIGNAL_METHOD_NAMES.has(simpleName.toLowerCase());
}

const STRING_LITERAL = `"(?:[^"\\\\]|\\\\.)*"`;
const JAVA_PLUS_STRING_THEN_VAR = new RegExp(`(${STRING_LITERAL})\\s*\\+\\s*([A-Za-z_][A-Za-z0-9_.]*(?:\\([^)]*\\))?)`, 'g');
const JAVA_PLUS_VAR_THEN_STRING = new RegExp(`([A-Za-z_][A-Za-z0-9_.]*(?:\\([^)]*\\))?)\\s*\\+\\s*(${STRING_LITERAL})`, 'g');
const KOTLIN_TEMPLATE_STRING = /"((?:[^"\\$]|\\.|\$\{[^}]*}|\$[A-Za-z_][A-Za-z0-9_]*)*)"/g;
const KOTLIN_TEMPLATE_INTERPOLATION = /\$\{\s*([A-Za-z_][A-Za-z0-9_.]*)[^}]*}|\$([A-Za-z_][A-Za-z0-9_]*)/;
const PYTHON_FSTRING = /[fF](['"])((?:(?!\1)[^\\]|\\.)*)\1/g;
const PYTHON_FSTRING_INTERPOLATION = /\{\s*([A-Za-z_][A-Za-z0-9_.]*)[^}]*}/;
const PYTHON_FORMAT_CALL = new RegExp(`(${STRING_LITERAL})\\s*\\.\\s*format\\s*\\(\\s*([^)]*)\\)`, 'g');
const PYTHON_PERCENT_FORMAT = new RegExp(`(${STRING_LITERAL})\\s*%\\s*([A-Za-z_][A-Za-z0-9_.]*|\\([^)]*\\))`, 'g');
const CALL_SHAPE_PATTERN = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
const RESERVED_WORDS = new Set(['return', 'throw', 'new', 'yield']);

function stripQuotes(literalWithQuotes: string): string {
  return literalWithQuotes.replace(/^"|"$/g, '');
}

function isConstantStringLiteral(candidate: string): boolean {
  return candidate.startsWith('"');
}

function simpleNameOf(expr: string): string {
  const withoutCall = expr.split('(')[0];
  const parts = withoutCall.split('.');
  return parts[parts.length - 1];
}

function scanJavaKotlinPlusConcat(text: string): Hit[] {
  const hits: Hit[] = [];

  for (const match of text.matchAll(JAVA_PLUS_STRING_THEN_VAR)) {
    const literal = match[1];
    const varName = match[2];
    if (isConstantStringLiteral(varName)) continue;
    if (!looksLikeSqlStart(stripQuotes(literal))) continue;
    const literalStart = match.index! + match[0].indexOf(literal);
    hits.push({ startOffset: literalStart, endOffset: match.index! + match[0].length, interpolatedName: simpleNameOf(varName) });
  }

  for (const match of text.matchAll(JAVA_PLUS_VAR_THEN_STRING)) {
    const varName = match[1];
    const literal = match[2];
    if (isConstantStringLiteral(varName)) continue;
    if (RESERVED_WORDS.has(varName.toLowerCase())) continue;
    if (!looksLikeSqlStart(stripQuotes(literal))) continue;
    hits.push({ startOffset: match.index!, endOffset: match.index! + match[0].length, interpolatedName: simpleNameOf(varName) });
  }

  return hits;
}

function scanKotlinStringTemplates(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const match of text.matchAll(KOTLIN_TEMPLATE_STRING)) {
    const whole = match[0];
    const inner = match[1];
    const interpolation = KOTLIN_TEMPLATE_INTERPOLATION.exec(inner);
    if (!interpolation) continue;
    if (!looksLikeSqlStart(inner)) continue;
    const name = interpolation[1] ?? interpolation[2] ?? null;
    hits.push({ startOffset: match.index!, endOffset: match.index! + whole.length, interpolatedName: name });
  }
  return hits;
}

function scanPythonFStrings(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const match of text.matchAll(PYTHON_FSTRING)) {
    const inner = match[2];
    const interpolation = PYTHON_FSTRING_INTERPOLATION.exec(inner);
    if (!interpolation) continue;
    if (!looksLikeSqlStart(inner)) continue;
    hits.push({ startOffset: match.index!, endOffset: match.index! + match[0].length, interpolatedName: interpolation[1] ?? null });
  }
  return hits;
}

function scanPythonFormatCalls(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const match of text.matchAll(PYTHON_FORMAT_CALL)) {
    const literal = match[1];
    const args = match[2].trim();
    if (args === '') continue;
    if (!looksLikeSqlStart(stripQuotes(literal))) continue;
    const firstArg = args.split(',')[0].trim();
    const name = simpleNameOf(firstArg);
    hits.push({ startOffset: match.index!, endOffset: match.index! + match[0].length, interpolatedName: name === '' ? null : name });
  }
  return hits;
}

function scanPythonPercentFormat(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const match of text.matchAll(PYTHON_PERCENT_FORMAT)) {
    const literal = match[1];
    const rhs = match[2];
    if (!looksLikeSqlStart(stripQuotes(literal))) continue;
    const firstArg = rhs.replace(/^\(/, '').replace(/\)$/, '').split(',')[0].trim();
    const name = simpleNameOf(firstArg);
    hits.push({ startOffset: match.index!, endOffset: match.index! + match[0].length, interpolatedName: name === '' ? null : name });
  }
  return hits;
}

function containsSignalCall(window: string): boolean {
  for (const match of window.matchAll(CALL_SHAPE_PATTERN)) {
    if (isSignalMethodName(match[1])) return true;
  }
  return false;
}

/** True when a real SQL-execution signal appears within
 * CONTEXT_WINDOW_CHARS characters after the candidate expression, or
 * immediately before it (covers a call that wraps the expression as
 * its argument, e.g. `stmt.executeQuery("SELECT ..." + id)`). */
function hasNearbySignal(text: string, afterOffset: number): boolean {
  const windowEnd = Math.min(afterOffset + CONTEXT_WINDOW_CHARS, text.length);
  if (containsSignalCall(text.slice(afterOffset, windowEnd))) return true;

  const windowStart = Math.max(afterOffset - CONTEXT_WINDOW_CHARS, 0);
  return containsSignalCall(text.slice(windowStart, afterOffset));
}

export function scan(text: string): Hit[] {
  const all = [
    ...scanJavaKotlinPlusConcat(text),
    ...scanKotlinStringTemplates(text),
    ...scanPythonFStrings(text),
    ...scanPythonFormatCalls(text),
    ...scanPythonPercentFormat(text),
  ];

  const seen = new Set<string>();
  const deduped = all.filter((hit) => {
    const key = `${hit.startOffset}:${hit.endOffset}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort((a, b) => a.startOffset - b.startOffset).filter((hit) => hasNearbySignal(text, hit.endOffset));
}
