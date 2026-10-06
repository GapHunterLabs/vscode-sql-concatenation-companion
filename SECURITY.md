# Security Policy

## Supported versions

Security fixes are released for the latest version of SQL Concatenation Companion published
on the Visual Studio Marketplace. Update from VS Code: the **Extensions** view.

Earlier versions are not removed from the Visual Studio Marketplace, but they do not receive
fixes: update to the latest version.

## Reporting a vulnerability

Report suspected vulnerabilities privately, not in a public issue,
discussion, or pull request.

- **Preferred:** GitHub private vulnerability reporting, the
  **Report a vulnerability** button under this repository's **Security** tab.
- **Alternative:** email **gaphunterlabs@gmail.com** with the subject
  `SECURITY: SQL Concatenation Companion`.

Include the extension version, the VS Code version, the operating
system, steps to reproduce (or a minimal sample project), and the impact as
you understand it.

If there is evidence that the issue is being exploited in the wild, say so in
the first message. Those reports are handled first.

## What to expect

- Acknowledgement within **5 business days**.
- An assessment (confirmed or not, severity, and plan) within **10 business
  days**.
- Fix targets by severity (CVSS): critical within 7 days, high within
  30 days, medium within 90 days, low in a later release.
- Coordinated disclosure: details stay private until a fix is released, for
  up to 90 days unless another date is agreed with the reporter.
- Fixes ship as a dedicated security release on the Visual Studio Marketplace, separate from
  new features where possible. Each fix is published as a GitHub Security
  Advisory, with a CVE when applicable, and listed under a **Security** heading
  in [CHANGELOG.md](CHANGELOG.md).
- Reporters are credited unless they ask to stay anonymous.

## Third-party components

If the issue is in a bundled third-party component, report it to that
project as well. Fixes for bundled components ship in a new release of
SQL Concatenation Companion.

## Scope

In scope: the code in this repository and the extension as published on
the Visual Studio Marketplace, for example code execution triggered by opening workspace
files, network access not described in [PRIVACY.md](PRIVACY.md), or exposure
of file contents or credentials.

Out of scope:

- vulnerabilities in VS Code: report those to Microsoft;
- issues the extension *detects* in a user's own code (that is its purpose);
- false positives or false negatives of diagnostics: use a regular
  [GitHub issue](https://github.com/GapHunterLabs/vscode-sql-concatenation-companion/issues).

## Good-faith research

Research that follows this policy, avoids privacy violations and service
disruption, and gives a reasonable time to fix before disclosure is
welcome, and will not be the subject of legal action by the maintainer.

## Release integrity

Releases are published to the Visual Studio Marketplace from the publisher
account shown on the extension's Marketplace page.
