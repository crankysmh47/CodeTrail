import Parser from 'web-tree-sitter';

export type CParserPaths = Readonly<{
  parserWasmPath: string;
  languageWasmPath: string;
}>;

let initializationPromise: Promise<void> | undefined;

function initializeParser(parserWasmPath: string): Promise<void> {
  initializationPromise ??= Parser.init({
    locateFile(): string {
      return parserWasmPath;
    },
  });
  return initializationPromise;
}

export async function createCParser(paths: CParserPaths): Promise<Parser> {
  await initializeParser(paths.parserWasmPath);
  const language = await Parser.Language.load(paths.languageWasmPath);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}
