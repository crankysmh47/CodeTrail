# CodeTrail privacy

CodeTrail analyzes C and header files locally inside VS Code. It has no telemetry, account system, hosted inference, advertising, or source-upload feature. Runtime code does not call OpenAI, Codex, or another AI service.

The extension stores a validated, compressed index in VS Code workspace storage so results can survive a reload. That index contains source-derived symbol names, paths, signatures, ranges, summaries, and relationships. Removing the extension's workspace storage or clearing VS Code data removes the snapshot.

The optional Clang capability check runs only `clang --version` with a three-second timeout. CodeTrail does not compile or execute workspace code.

The optional MCP server is a local stdio process started explicitly by the user or an MCP client. It returns bounded structured search and relationship evidence to that local client. Data handling beyond the stdio boundary depends on the client the user chooses.
