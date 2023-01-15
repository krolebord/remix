import * as path from "path";
import * as fse from "fs-extra";
import esbuild from "esbuild";
import postcss from "postcss";

import invariant from "../../invariant";
import type { RemixConfig } from "../../config";
import type { CompileOptions } from "../options";
import { getPostCssPlugins } from "../utils/postcss";

const isExtendedLengthPath = /^\\\\\?\\/;

function normalizePathSlashes(p: string) {
  return isExtendedLengthPath.test(p) ? p : p.replace(/\\/g, "/");
}

/**
 * This plugin loads css files with the "css" loader (bundles and moves assets to assets directory)
 * and exports the url of the css file as its default export.
 */
export function cssFilePlugin(options: {
  config: RemixConfig;
  mode: CompileOptions["mode"];
  rootDirectory: string;
}): esbuild.Plugin {
  return {
    name: "css-file",

    async setup(build) {
      let buildOps = build.initialOptions;

      build.onLoad({ filter: /\.css$/ }, async (args) => {
        let { outfile, outdir, assetNames } = buildOps;
        let { metafile, outputFiles, warnings, errors } = await esbuild.build({
          ...buildOps,
          minify: options.mode === "production",
          minifySyntax: true,
          metafile: true,
          write: false,
          sourcemap: false,
          incremental: false,
          splitting: false,
          stdin: undefined,
          outfile: undefined,
          outdir: outfile ? path.dirname(outfile) : outdir,
          entryNames: assetNames,
          entryPoints: [args.path],
          loader: {
            ...buildOps.loader,
            ".css": "css",
          },
          // this plugin treats absolute paths in 'url()' css rules as external to prevent breaking changes
          plugins: [
            {
              name: "resolve-absolute",
              async setup(build) {
                build.onResolve({ filter: /.*/ }, async (args) => {
                  let { kind, path: resolvePath } = args;
                  if (kind === "url-token" && path.isAbsolute(resolvePath)) {
                    return {
                      path: resolvePath,
                      external: true,
                    };
                  }
                });
              },
            },
            {
              name: "postcss-plugin",
              async setup(build) {
                let postcssPlugins = await getPostCssPlugins({
                  rootDirectory: options.rootDirectory,
                });
                let p = postcss(postcssPlugins);

                build.onLoad(
                  { filter: /\.css$/, namespace: "file" },
                  async (args) => {
                    let source = await fse.readFile(args.path, "utf-8");

                    let contents = (
                      await p.process(source, {
                        from: args.path,
                        to: args.path,
                        map: {
                          inline: true,
                        },
                      })
                    ).css;

                    return {
                      contents,
                      loader: "css",
                    };
                  }
                );
              },
            },
          ],
        });

        if (errors && errors.length) {
          return { errors };
        }

        invariant(metafile, "metafile is missing");
        let { outputs } = metafile;
        let entry = Object.keys(outputs).find((out) => outputs[out].entryPoint);
        invariant(entry, "entry point not found");

        let normalizedEntry = path.resolve(
          options.rootDirectory,
          normalizePathSlashes(entry)
        );
        let entryFile = outputFiles.find((file) => {
          return (
            path.resolve(
              options.rootDirectory,
              normalizePathSlashes(file.path)
            ) === normalizedEntry
          );
        });

        invariant(entryFile, "entry file not found");

        let outputFilesWithoutEntry = outputFiles.filter(
          (file) => file !== entryFile
        );

        // write all assets
        await Promise.all(
          outputFilesWithoutEntry.map(({ path: filepath, contents }) =>
            fse.outputFile(filepath, contents)
          )
        );

        return {
          contents: entryFile.contents,
          loader: "file",
          // add all css assets to watchFiles
          watchFiles: Object.values(outputs).reduce<string[]>(
            (arr, { inputs }) => {
              let resolvedInputs = Object.keys(inputs).map((input) => {
                return path.resolve(input);
              });
              arr.push(...resolvedInputs);
              return arr;
            },
            []
          ),
          warnings,
        };
      });
    },
  };
}
