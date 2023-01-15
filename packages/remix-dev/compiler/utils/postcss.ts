import loadConfig from "postcss-load-config";

let tailwindPath: string | false | undefined;
export async function getPostCssPlugins({
  rootDirectory,
  vanillaExtract = false,
}: {
  rootDirectory: string;
  vanillaExtract?: boolean;
}): Promise<Array<any>> {
  try {
    return (
      await loadConfig(
        // @ts-expect-error Custom context extensions aren't type safe
        { remix: { vanillaExtract } }
      )
    ).plugins;
  } catch (err) {}

  if (tailwindPath === undefined) {
    try {
      tailwindPath = require.resolve("tailwindcss", {
        paths: [rootDirectory],
      });
    } catch (err) {
      tailwindPath = false;
    }
  }

  if (!tailwindPath) {
    return [];
  }

  return [(await import(tailwindPath)).default()];
}
