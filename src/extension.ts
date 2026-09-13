import * as vscode from 'vscode';
import { scan } from './scanner';
import { recordHit } from './reviewPrompt';

let diagnostics: vscode.DiagnosticCollection;

const APPLICABLE_LANGUAGE_IDS = new Set(['java', 'kotlin', 'python']);
const APPLICABLE_EXTENSIONS = ['.java', '.kt', '.kts', '.py'];

function isApplicable(document: vscode.TextDocument): boolean {
  if (APPLICABLE_LANGUAGE_IDS.has(document.languageId)) return true;
  return APPLICABLE_EXTENSIONS.some((ext) => document.uri.path.endsWith(ext));
}

function refresh(context: vscode.ExtensionContext, document: vscode.TextDocument): void {
  if (!isApplicable(document)) return;

  const hits = scan(document.getText());
  const result = hits.map((hit) => {
    const range = new vscode.Range(document.positionAt(hit.startOffset), document.positionAt(hit.endOffset));
    const nameHint = hit.interpolatedName ? ` ('${hit.interpolatedName}')` : '';
    const diagnostic = new vscode.Diagnostic(
      range,
      `Potential SQL injection: query text built with concatenation/interpolation${nameHint} instead of a parameterized query, near a call that looks like it executes SQL.`,
      vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = 'SQL Concatenation Companion';
    recordHit(context, `${document.uri.toString()}:${hit.startOffset}`);
    return diagnostic;
  });
  diagnostics.set(document.uri, result);
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('sqlConcatenationCompanion');
  context.subscriptions.push(diagnostics);

  vscode.workspace.textDocuments.forEach((document) => refresh(context, document));

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => refresh(context, document)),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(context, event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
  );
}

export function deactivate(): void {
  diagnostics?.dispose();
}
