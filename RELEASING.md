# Releasing

A release starts when someone pushes a tag. The tag names one package, and
`.github/workflows/release.yml` releases that package only. The extension and
the linter have their own versions, so the extension can release without the
linter. The tag is the version: nobody edits a version or a changelog to
release.

| Tag | Package | Registry | Authentication |
| --- | --- | --- | --- |
| `vscode-v1.2.3` | `textscene-inspector` (`apps/textscene-vscode`) | VS Code Marketplace | Microsoft Entra ID, through a federated managed identity |
| `vscode-v1.2.3` | `textscene-inspector` | Open VSX (optional) | `OVSX_PAT` secret. The job skips when the secret is absent |
| `linter-v1.2.3` | `@textscene/linter` (`apps/textscene-linter`) | npm | npm trusted publishing (OpenID Connect, OIDC) |

No publish step reads a stored Marketplace or npm secret. Each publish job gets a
short-lived OIDC token from GitHub for the `release` environment.

## What the workflow does

1. `validate` reads the package and the version from the tag
   (`scripts/ci/releaseVersion.mjs`). Then it runs `pnpm validate`.
2. For a `vscode-v` tag, `release-vscode` writes the version into
   `apps/textscene-vscode/package.json`, builds the `.vsix` and the web
   previewer archive and attaches them to a GitHub Release. Then
   `vscode-marketplace` and `open-vsx` publish the `.vsix`.
3. For a `linter-v` tag, `release-linter` writes the version into
   `apps/textscene-linter/package.json`, builds the linter tarball and attaches
   it to a GitHub Release. Then `npm` publishes the tarball.

The `version` in each `package.json` in the repository is only a placeholder
for local builds. The published version always comes from the tag.

GitHub writes the release notes from the pull requests merged since the
previous tag of the same package. A package's first release has no previous
tag, so it gets the text "First public release." instead. Edit the notes on the
release page if needed. Each `CHANGELOG.md` points to the releases page. The
extension's release is marked as the repository's latest release. The linter's
release is not.

Each publish job skips a version that its registry already holds. If one
registry fails, fix the cause and use **Re-run failed jobs**. The other
registries are not published twice.

The tag check refuses two kinds of tag:

- A pre-release tag, like `vscode-v1.0.0-rc.1`. The Marketplace refuses a
  semver pre-release version.
- A version below the newest tag of the same package. npm would publish it and
  move its `latest` tag back to it.

## One-time setup

Do these steps once, in this order, before the first release tag.

### 1. GitHub environment

1. Open **Settings → Environments** in the repository.
2. Create an environment named `release`.
3. Under **Deployment branches and tags**, select **Selected branches and tags**.
4. Add the tag rules `vscode-v*` and `linter-v*`.
5. Add the branch rule `main`, for the **Marketplace identity** workflow.

The environment name is part of the OIDC subject. npm and Azure both check it.

### 2. npm

npm configures trusted publishing on a package that already exists. So the
first version goes up by hand.

1. Sign in to [npmjs.com](https://www.npmjs.com) and turn on two-factor
   authentication.
2. Create the organisation `textscene` (**Add Organization**, free plan). The
   `@textscene` scope does not exist yet.
3. Check out the commit you will tag `linter-v<version>`.
4. Set the version locally, without committing it:
   `npm pkg set version=<version> --prefix apps/textscene-linter`.
5. Run `pnpm install`.
6. Run `pnpm build:linter`.
7. In `apps/textscene-linter`, run `pnpm pack`. Use pnpm, not npm: it rewrites
   the `catalog:` and `workspace:` specifiers.
8. Run `npm login`.
9. Run `npm publish textscene-linter-<version>.tgz`. `publishConfig` makes the
   scoped package public.
10. Open the package's **Settings** page on npmjs.com.
11. Under **Trusted Publisher**, select **GitHub Actions**.
12. Enter the organisation or user `Vortiago`, the repository
    `textscene-inspector`, the workflow filename `release.yml` and the
    environment `release`. The fields are case-sensitive, and npm does not
    check them when you save.
13. Under **Allowed actions**, allow `npm publish`. A configuration made after
    2026-09-03 allows only `npm stage publish` by default, and the workflow runs
    `npm publish`.
14. Optional: under **Publishing access**, select **Require two-factor
    authentication and disallow tokens**. Trusted publishing still works.

When the `linter-v<version>` tag runs, the `npm` job finds the version on npm and
skips it. Versions from CI carry a provenance attestation. The hand-published
first version does not.

### 3. VS Code Marketplace

The Marketplace runs on Azure DevOps, so every Marketplace sign-in is an Azure
sign-in. A publish token must cover all Azure DevOps organisations, which makes
it a global personal access token. Azure DevOps retires those on 2026-12-01.
So the workflow signs in as a managed identity instead. The identity only
proves that this workflow may publish as `vortiago`. Nothing is hosted on Azure.

1. Sign in to the
   [Marketplace publisher management page](https://marketplace.visualstudio.com/manage)
   with a Microsoft account.
2. Create the publisher with the ID `vortiago`. It must match `publisher` in
   `apps/textscene-vscode/package.json`.
3. In the [Azure portal](https://portal.azure.com), use an Azure subscription.
   A free subscription is enough, and a managed identity costs nothing.
4. Create a resource group, for example `textscene-release`.
5. In it, create a **user-assigned managed identity**, for example
   `textscene-marketplace`.
6. Give the identity the **Reader** role on the subscription (**Access control
   (IAM)**).
7. Record the **Client ID** and the **Subscription ID** from the identity's
   **Overview** page. Do not use its **Object (principal) ID**.
8. Record the **Tenant ID** from **Microsoft Entra ID → Overview**.
9. On the identity, open **Federated credentials** and add a credential.
10. Select the scenario **GitHub Actions deploying Azure resources**.
11. Enter the organisation `Vortiago` with the organisation ID `1761895`, the
    repository `textscene-inspector` with the repository ID `1083105066`, the
    entity type **Environment** and the environment `release`. The subject
    becomes `repo:Vortiago@1761895/textscene-inspector@1083105066:environment:release`.
12. Opt the repository in to immutable subject claims. GitHub sends the
    subject with the IDs only to repositories created after 2026-07-15, and
    this one is older:

    ```bash
    gh api -X PUT repos/Vortiago/textscene-inspector/actions/oidc/customization/sub \
      -F use_default=true -F use_immutable_subject=true
    ```
13. In GitHub, open **Settings → Secrets and variables → Actions →
    Variables**.
14. Add the repository variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and
    `AZURE_SUBSCRIPTION_ID`. They are identifiers, not secrets.
15. Run the **Marketplace identity** workflow from **Actions**, on `main`.
16. Copy the member ID from the run summary. The last step fails at this point,
    because the identity is not a publisher member yet.
17. On the Marketplace management page, open the `vortiago` publisher and
    select **Members**.
18. Add the member ID with the **Contributor** role.
19. Run **Marketplace identity** again. The last step now passes.

The first `vscode-v` release creates the extension listing. No step before it
is needed.

### 4. Open VSX (optional)

1. Sign in to [open-vsx.org](https://open-vsx.org) with GitHub.
2. Sign the Eclipse Foundation publisher agreement in your profile.
3. Create an access token in **Settings → Access Tokens**.
4. Run `npx ovsx create-namespace vortiago -p <token>`.
5. Add the token as the secret `OVSX_PAT` in the `release` environment.

## Each release

Release the extension with the prefix `vscode`, and the linter with the prefix
`linter`. `<package>` below is one of those two, and `<version>` is the new
version.

1. Merge the changes to `main`.
2. Tag the commit on `main`: `git tag <package>-v<version> origin/main`.
3. Push the tag: `git push origin <package>-v<version>`.
4. Watch the **Release** run under **Actions**.

For example, `git tag vscode-v1.3.0 origin/main` releases extension 1.3.0 and
publishes nothing to npm.

If `validate` refuses the tag, nothing is published. Delete the tag, and push a
correct one.
