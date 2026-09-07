import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan, looksLikeSqlStart, isSignalMethodName } from '../scanner';

test('looksLikeSqlStart matches a leading SELECT keyword', () => {
  assert.equal(looksLikeSqlStart('SELECT * FROM users'), true);
});

test('looksLikeSqlStart does not match a word that merely starts like a keyword', () => {
  assert.equal(looksLikeSqlStart('selection criteria'), false);
  assert.equal(looksLikeSqlStart('deleted_at column'), false);
});

test('looksLikeSqlStart is case-insensitive', () => {
  assert.equal(looksLikeSqlStart('select id from t'), true);
});

test('isSignalMethodName recognizes JDBC and Python DB-API call names', () => {
  assert.equal(isSignalMethodName('executeQuery'), true);
  assert.equal(isSignalMethodName('execute'), true);
  assert.equal(isSignalMethodName('rawQuery'), true);
  assert.equal(isSignalMethodName('println'), false);
});

test('scan flags Java-style + concatenation into executeQuery', () => {
  const text = 'stmt.executeQuery("SELECT * FROM users WHERE id = " + userId);';
  const hits = scan(text);
  assert.equal(hits.length, 1);
});

test('scan does not flag two constant string literals concatenated', () => {
  const text = 'stmt.executeQuery("SELECT * FROM " + "users");';
  const hits = scan(text);
  assert.equal(hits.length, 0);
});

test('scan does not flag a SQL-shaped string with no nearby execution signal', () => {
  const text = 'log.info("SELECT * FROM users WHERE id = " + userId);';
  const hits = scan(text);
  assert.equal(hits.length, 0);
});

test('scan flags a Kotlin string template interpolation near query()', () => {
  const text = 'val rows = jdbcTemplate.query("SELECT * FROM users WHERE id = $userId")';
  const hits = scan(text);
  assert.equal(hits.length, 1);
});

test('scan does not flag a Kotlin template with no interpolation', () => {
  const text = 'jdbcTemplate.query("SELECT * FROM users")';
  assert.equal(scan(text).length, 0);
});

test('scan flags a Python f-string near cursor.execute', () => {
  const text = 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")';
  const hits = scan(text);
  assert.equal(hits.length, 1);
});

test('scan flags Python %-formatting near execute', () => {
  const text = 'cursor.execute("SELECT * FROM users WHERE id = %s" % user_id)';
  const hits = scan(text);
  assert.equal(hits.length, 1);
});

test('scan flags Python .format() near execute', () => {
  const text = 'cursor.execute("SELECT * FROM users WHERE id = {}".format(user_id))';
  const hits = scan(text);
  assert.equal(hits.length, 1);
});

test('scan does not flag a properly parameterized query', () => {
  const text = 'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))';
  const hits = scan(text);
  assert.equal(hits.length, 0);
});

test('scan finds an execution signal that comes before the expression too', () => {
  const text = 'db.execute("DELETE FROM sessions WHERE id = " + sessionId);';
  const hits = scan(text);
  assert.equal(hits.length, 1);
});
