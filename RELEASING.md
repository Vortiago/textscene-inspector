# Releasing

A release starts when someone pushes a tag. The tag names one package, and
`.github/workflows/release.yml` releases that package only. The extension and
the linter have their own versions, so the extension can release without the
linter.

| Tag | Package | Registry | Authentication |
| --- | --- | --- | --- |
| `vscode-v1.2.3` | `textscene-inspector` (`apps/textscene-vscode`) | VS Code Marketplace | Microsoft Entra ID, through a federated managed identity |
| `vscode-v1.2.3` | `textscene-inspector` | Open VSX (optional) | `OVSX_PAT` secret. The job skips when the secret is absent |
| `linter-v1.2.3` | `@textscene/linter` (`apps/textscene-linter`) | npm | npm trusted publishing (OpenID Connect, OIDC) |

No publish step reads a stored Marketplace or npm secret. Each publish job gets a
short-lived OIDC token from GitHub for the `release` environment.

## What the workflow does

1. `validate` reads the package from the tag prefix and checks the tag against
   that package's `version` (`scripts/ci/releaseVersion.mjs`). Then it runs
   `pnpm validate`.
2. For a `vscode-v` tag, `release-vscode` builds the `.vsix` and the web
   previewer archive and attaches them to a GitHub Release. Then
   `vscode-marketplace` and `open-vsx` publish the `.vsix`.
3. For a `linter-v` tag, `release-linter` builds the linter tarball and attaches
   it to a GitHub Release. Then `npm` publishes the tarball.

The release notes compare against the previous tag of the same package. The
extension's release is marked as the repository's latest release. The linter's
release is not.

Each publish job skips a version that its registry already holds. If one
registry fails, fix the cause and use **Re-run failed jobs**. The other
registries are not published twice.

The Marketplace refuses a semver pre-release version, so the tag check refuses
a tag like `vscode-v1.0.0-rc.1`.

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
3. Check out the commit you will tag `linter-v<version>`, with that version in
   `apps/textscene-linter/package.json`.
4. Run `pnpm install`.
5. Run `pnpm build:linter`.
6. In `apps/textscene-linter`, run `pnpm pack`. Use pnpm, not npm: it rewrites
   the `catalog:` and `workspace:` specifiers.
7. Run `npm login`.
8. Run `npm publish textscene-linter-<version>.tgz`. `publishConfig` makes the
   scoped package public.
9. Open the package's **Settings** page on npmjs.com.
10. Under **Trusted Publisher**, select **GitHub Actions**.
11. Enter the organisation or user `Vortiago`, the repository
    `textscene-inspector`, the workflow filename `release.yml` and the
    environment `release`. The fields are case-sensitive, and npm does not
    check them when you save.
12. Under **Allowed actions**, allow `npm publish`. A configuration made after
    2026-09-03 allows only `npm stage publish` by default, and the workflow runs
    `npm publish`.
13. Optional: under **Publishing access**, select **Require two-factor
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
7. Record the identity's **Client ID**, and the **Tenant ID** and
   **Subscription ID**.
8. On the identity, open **Federated credentials** and add a credential.
9. Select the scenario **GitHub Actions deploying Azure resources**.
10. Enter the organisation `Vortiago`, the repository `textscene-inspector`,
    the entity type **Environment** and the environment `release`. The subject
    becomes `repo:Vortiago/textscene-inspector:environment:release`.
11. In GitHub, open **Settings → Secrets and variables → Actions →
    Variables**.
12. Add the repository variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and
    `AZURE_SUBSCRIPTION_ID`. They are identifiers, not secrets.
13. Run the **Marketplace identity** workflow from **Actions**, on `main`.
14. Copy the member ID from the run summary. The last step fails at this point,
    because the identity is not a publisher member yet.
15. On the Marketplace management page, open the `vortiago` publisher and
    select **Members**.
16. Add the member ID with the **Contributor** role.
17. Run **Marketplace identity** again. The last step now passes.

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

1. Set `<version>` in the package's `package.json`: `apps/textscene-vscode` or
   `apps/textscene-linter`.
2. Move the `[Unreleased]` entries in that package's `CHANGELOG.md` under
   `<version>` and the date.
3. Merge that change to `main` through a pull request.
4. Tag the merge commit: `git tag <package>-v<version> <commit>`.
5. Push the tag: `git push origin <package>-v<version>`.
6. Watch the **Release** run under **Actions**.

For example, `git tag vscode-v1.3.0` releases extension 1.3.0 and publishes
nothing to npm.

If the tag does not match the package's `version`, `validate` fails in its
first step and nothing is published. Delete the tag, fix the version, and tag
again.
