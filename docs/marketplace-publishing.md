# Publishing CodeTrail to the VS Code Marketplace

The release package is ready for Marketplace upload. Publication itself needs the repository owner to create or join the Microsoft publisher and authenticate; no credential belongs in this repository.

## Prepared identity

| Field | Value |
|---|---|
| Publisher ID | `crankysmh47` |
| Extension name | `codetrail-c-evidence-paths` |
| Display name | `CodeTrail: C Evidence Paths` |
| Marketplace identity | `crankysmh47.codetrail-c-evidence-paths` |

The generic `codetrail` name and `CodeTrail` display name are already used by another Marketplace extension. The prepared identity was checked with `vsce show` on 2026-07-15 and did not resolve to an existing extension. Marketplace availability can still change before the first upload, so run the check again immediately before publishing:

```powershell
npx vsce show crankysmh47.codetrail-c-evidence-paths --json
```

An `undefined` result means the exact publisher/extension identity has not been published.

## One-time owner setup

1. Sign in to the [Visual Studio Marketplace publisher portal](https://marketplace.visualstudio.com/manage).
2. Create the publisher ID `crankysmh47`, or change `package.json` to the exact durable publisher ID you own.
3. Accept the Marketplace Publisher Agreement.
4. Make the GitHub repository public before a public listing, or move the README images to another public HTTPS host. The Marketplace requires README images to resolve over HTTPS.
5. Choose authentication:
   - for a manual first release, create a narrowly scoped Marketplace publishing credential and run `npx vsce login crankysmh47`;
   - for automation, prefer Microsoft Entra ID with `vsce publish --azure-credential`.

Microsoft's current guidance says global Azure DevOps personal access tokens retire on 2026-12-01. Do not build a new long-lived release process around a global PAT.

## Publish the verified artifact

Run the complete release gate first:

```powershell
npm ci
npm run verify:release
```

Publish the exact verified VSIX rather than repackaging during upload:

```powershell
npx vsce publish --packagePath .\codetrail.vsix
```

Or upload `codetrail.vsix` manually from the publisher management page. The publisher ID inside the VSIX must match the publisher account.

After upload, wait for Marketplace validation and malware scanning, install the public listing into a clean VS Code profile, and repeat the three-minute runbook. Record the Marketplace URL and published version in the release notes.

## Official references

- [VS Code: Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Visual Studio Marketplace publisher portal](https://marketplace.visualstudio.com/manage)
