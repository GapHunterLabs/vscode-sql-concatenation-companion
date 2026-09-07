# SQL Concatenation Companion (VS Code)

Finds SQL built by unparameterized string concatenation or
interpolation, then executed — in Java, Kotlin, and Python source. No
data leaves your editor.

**v0.1, pilot.** Part of the Gap Hunter Labs VS Code workstream,
ported from the IntelliJ-family `sql-concatenation-companion`.

## What it does

Two layers, both required, live as you edit `.java`/`.kt`/`.py` files:

1. **Shape**: a string literal that looks like the start of a real SQL
   statement (`SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/
   `DROP`/... at the start, not just anywhere in the text) combined via
   `+` concatenation (Java/Kotlin), string-template interpolation
   (Kotlin `"...${x}..."`), an f-string (Python), `.format(...)`, or
   `%`-formatting with a non-constant operand.
2. **Context**: the resulting expression sits within 200 characters of
   a call that looks like it executes SQL — JDBC's
   `executeQuery`/`executeUpdate`/`execute`, Android's `rawQuery`,
   Spring's `.query`, Hibernate's `createQuery`/`createNativeQuery`, or
   Python DB-API 2.0's `execute`/`executemany` (shared by sqlite3,
   psycopg2, MySQLdb, and most other Python DB drivers).

**What does NOT trigger** (same worked list as the IntelliJ-family
original): two constant literals concatenated, a SQL-shaped string
nowhere near an execution call (a log message, a comment), or a value
already parameterized correctly (`?` placeholders, Python's
`cursor.execute(query, (param,))` tuple form).

**v0.1 scope, honestly noted:** plain-text scanning, not a real
per-language lexer — a string literal or comment whose text happens to
contain the shape verbatim is rare but possible. `StringBuilder`-style
accumulation across multiple statements/lines is out of scope; only
single-expression concatenation/interpolation is detected.

## Privacy

See [PRIVACY.md](PRIVACY.md) — zero network calls, everything runs
against files already open in your editor.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
