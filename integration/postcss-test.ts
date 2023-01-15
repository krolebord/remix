import { test, expect } from "@playwright/test";

import { PlaywrightFixture } from "./helpers/playwright-fixture";
import type { Fixture, AppFixture } from "./helpers/create-fixture";
import {
  createAppFixture,
  createFixture,
  css,
  js,
} from "./helpers/create-fixture";

const TEST_PADDING_VALUE = "20px";

test.describe("PostCSS", () => {
  let fixture: Fixture;
  let appFixture: AppFixture;

  test.beforeAll(async () => {
    fixture = await createFixture({
      files: {
        "remix.config.js": js`
          module.exports = {
            future: {
              // Enable all CSS future flags to
              // ensure features don't clash
              unstable_cssModules: true,
              unstable_cssSideEffectImports: true,
              unstable_vanillaExtract: true,
            },
          };
        `,
        "postcss.config.js": js`
          let replace = require('./postcss-replace-plugin');

          module.exports = (ctx) => ({
            plugins: [
              replace("TEST_PADDING_VALUE", ${JSON.stringify(
                TEST_PADDING_VALUE
              )}),
              replace("TEST_POSTCSS_CONTEXT", JSON.stringify(ctx).replaceAll('"', "'")),
            ],
          });
        `,
        "postcss-replace-plugin.js": js`
          module.exports = (value, replacement) => ({
            postcssPlugin: 'replace',
            Declaration (decl) {
              decl.value = decl.value.replaceAll(value, replacement);
            },
          });
        `,
        "app/root.jsx": js`
          import { Links, Outlet } from "@remix-run/react";
          import { cssBundleHref } from "@remix-run/css-bundle";
          export function links() {
            return [
              { rel: "stylesheet", href: cssBundleHref }
            ];
          }
          export default function Root() {
            return (
              <html>
                <head>
                  <Links />
                </head>
                <body>
                  <Outlet />
                </body>
              </html>
            )
          }
        `,
        ...regularStylesSheetsFixture(),
        ...cssModulesFixture(),
        ...vanillaExtractFixture(),
        ...cssSideEffectImportsFixture(),
      },
    });
    appFixture = await createAppFixture(fixture);
  });

  test.afterAll(async () => {
    await appFixture.close();
  });

  let regularStylesSheetsFixture = () => ({
    "app/routes/regular-style-sheets-test.jsx": js`
      import { Test, links as testLinks } from "~/test-components/regular-style-sheets";
    
      export function links() {
        return [...testLinks()];
      }

      export default function() {
        return <Test />;
      }
    `,
    "app/test-components/regular-style-sheets/index.jsx": js`
      import stylesHref from "./styles.css";

      export function links() {
        return [{ rel: 'stylesheet', href: stylesHref }];
      }

      export function Test() {
        return (
          <div data-testid="regular-style-sheets" className="regular-style-sheets-test">
            Regular style sheets test.
            <br />
            PostCSS context: {' '}
          </div>
        );
      }
    `,
    "app/test-components/regular-style-sheets/styles.css": css`
      .regular-style-sheets-test {
        padding: TEST_PADDING_VALUE;
      }

      .regular-style-sheets-test:after {
        content: "TEST_POSTCSS_CONTEXT";
      }
    `,
  });
  test("regular style sheets", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/regular-style-sheets-test");
    let locator = await page.locator("[data-testid='regular-style-sheets']");
    let { padding, postcssContext } = await locator.evaluate((element) => ({
      padding: window.getComputedStyle(element).padding,
      postcssContext: JSON.parse(
        JSON.parse(getComputedStyle(element, ":after").content).replaceAll(
          "'",
          '"'
        )
      ),
    }));
    expect(padding).toBe(TEST_PADDING_VALUE);
    expect(postcssContext.remix.vanillaExtract).toBe(false);
  });

  let cssModulesFixture = () => ({
    "app/routes/css-modules-test.jsx": js`
      import { Test } from "~/test-components/css-modules";

      export default function() {
        return <Test />;
      }
    `,
    "app/test-components/css-modules/index.jsx": js`
      import styles from "./styles.module.css";

      export function Test() {
        return (
          <div data-testid="css-modules" className={styles.root}>
            CSS Modules test.
            <br />
            PostCSS context: {' '}
          </div>
        );
      }
    `,
    "app/test-components/css-modules/styles.module.css": css`
      .root {
        padding: TEST_PADDING_VALUE;
      }

      .root:after {
        content: "TEST_POSTCSS_CONTEXT";
      }
    `,
  });
  test("CSS Modules", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/css-modules-test");
    let locator = await page.locator("[data-testid='css-modules']");
    let { padding, postcssContext } = await locator.evaluate((element) => ({
      padding: window.getComputedStyle(element).padding,
      postcssContext: JSON.parse(
        JSON.parse(getComputedStyle(element, ":after").content).replaceAll(
          "'",
          '"'
        )
      ),
    }));
    expect(padding).toBe(TEST_PADDING_VALUE);
    expect(postcssContext.remix.vanillaExtract).toBe(false);
  });

  let vanillaExtractFixture = () => ({
    "app/routes/vanilla-extract-test.jsx": js`
      import { Test } from "~/test-components/vanilla-extract";

      export default function() {
        return <Test />;
      }
    `,
    "app/test-components/vanilla-extract/index.jsx": js`
      import * as styles from "./styles.css";

      export function Test() {
        return (
          <div data-testid="vanilla-extract" className={styles.root}>
            Vanilla Extract test.
            <br />
            PostCSS context: {' '}
          </div>
        );
      }
    `,
    "app/test-components/vanilla-extract/styles.css.ts": css`
      import { style } from "@vanilla-extract/css";
    
      export const root = style({
        padding: "TEST_PADDING_VALUE",
        ":after": {
          content: "TEST_POSTCSS_CONTEXT",
        }
      });
    `,
  });
  test("Vanilla Extract", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/vanilla-extract-test");
    let locator = await page.locator("[data-testid='vanilla-extract']");
    let { padding, postcssContext } = await locator.evaluate((element) => ({
      padding: window.getComputedStyle(element).padding,
      postcssContext: JSON.parse(
        JSON.parse(getComputedStyle(element, ":after").content).replaceAll(
          "'",
          '"'
        )
      ),
    }));
    expect(padding).toBe(TEST_PADDING_VALUE);
    expect(postcssContext.remix.vanillaExtract).toBe(true);
  });

  let cssSideEffectImportsFixture = () => ({
    "app/routes/css-side-effect-imports-test.jsx": js`
      import { Test } from "~/test-components/css-side-effect-imports";

      export default function() {
        return <Test />;
      }
    `,
    "app/test-components/css-side-effect-imports/index.jsx": js`
      import "./styles.css";

      export function Test() {
        return (
          <div data-testid="css-side-effect-imports" className="css-side-effect-imports-test">
            CSS side-effect imports test.
            <br />
            PostCSS context: {' '}
          </div>
        );
      }
    `,
    "app/test-components/css-side-effect-imports/styles.css": css`
      .css-side-effect-imports-test {
        padding: TEST_PADDING_VALUE;
      }

      .css-side-effect-imports-test:after {
        content: "TEST_POSTCSS_CONTEXT";
      }
    `,
  });
  test("CSS side-effect imports", async ({ page }) => {
    let app = new PlaywrightFixture(appFixture, page);
    await app.goto("/css-side-effect-imports-test");
    let locator = await page.locator("[data-testid='css-side-effect-imports']");
    let { padding, postcssContext } = await locator.evaluate((element) => ({
      padding: window.getComputedStyle(element).padding,
      postcssContext: JSON.parse(
        JSON.parse(getComputedStyle(element, ":after").content).replaceAll(
          "'",
          '"'
        )
      ),
    }));
    expect(padding).toBe(TEST_PADDING_VALUE);
    expect(postcssContext.remix.vanillaExtract).toBe(false);
  });
});
