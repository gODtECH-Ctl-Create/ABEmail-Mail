# ABE TechLab Design System — Light Green pilot

This branch pilots `@abe-techlab/abe-techlab-design-system@0.1.0` in the existing Waste2Light ABEmail Mail application. It does not change the production branch or mail behavior.

## Scope

- Pin the design-system package to version `0.1.0`.
- Load the published Light Green token palette and set it as the initial root theme.
- Map the existing inbox, navigation, message selection, composer, login, inputs, and focus states onto shared CSS tokens.
- Preserve the existing application layout, routes, authentication, database behavior, and email interactions.
- Defer other palettes, the user-facing theme selector, and the separate Admin/Settings visual pass until the first preview has been reviewed.

## GitHub Packages access

The root `.npmrc` points the `@abe-techlab` scope at GitHub Packages and reads its credential from the environment variable `GITHUB_PACKAGES_TOKEN`. No credential is stored in source control.

Before a Preview or Production build can install the package, provide a GitHub token that has read access to the published package as the sensitive `GITHUB_PACKAGES_TOKEN` environment variable in Vercel. Use the Preview and Production environments as applicable. Do not paste the token into this document, source files, or chat. For local installs, export the same variable in the terminal before running `npm install`.

## Review checklist

- Confirm the package installs from GitHub Packages and the Next.js production build completes.
- Verify inbox, message reading, search, compose, reply, reply-all, forward, attachments, drafts, and navigation.
- Check desktop, tablet, and mobile widths.
- Check login fields, keyboard focus, empty/loading states, and contrast for the lime-green actions.
- Confirm the deployed Waste2Light production branch remains unchanged until this pilot is approved.
