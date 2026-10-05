import { readFile } from 'node:fs/promises';
import ts from 'typescript';

export async function loadTypeScript(path, importer) {
  const source = await readFile(new URL(path, importer), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
