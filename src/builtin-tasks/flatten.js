const path = require("path");

const { BuidlerError, ERRORS } = require("../core/errors");

function getSortedFiles(dependenciesGraph) {
  const tsort = require("tsort");
  const graph = tsort();

  const filesMap = {};
  const resolvedFiles = Array.from(dependenciesGraph.getResolvedFiles());
  resolvedFiles.forEach(f => (filesMap[f.globalName] = f));

  for (const [from, deps] of dependenciesGraph.dependenciesPerFile.entries()) {
    for (const to of deps) {
      graph.add(to.globalName, from.globalName);
    }
  }

  let topologicalSortedNames;
  try {
    topologicalSortedNames = graph.sort();
  } catch (error) {
    if (e.toString().includes("Error: There is a cycle in the graph.")) {
      throw new BuidlerError(ERRORS.TASK_FLATTEN_CYCLE, error);
    }
  }

  // If an entry has no dependency it won't be included in the graph, so we
  // add them and then dedup the array
  const withEntries = topologicalSortedNames.concat(
    resolvedFiles.map(f => f.globalName)
  );

  const sortedNames = [...new Set(withEntries)];
  return sortedNames.map(n => filesMap[n]);
}

function getFileWithoutPragmaNorImports(resolvedFile) {
  const PRAGAMA_SOLIDITY_VERSION_REGEX = /^\s*pragma\ssolidity\s+(.*?)\s*;/;
  const IMPORT_SOLIDITY_REGEX = /^\s*import(\s+).*$/gm;

  return resolvedFile.content
    .replace(PRAGAMA_SOLIDITY_VERSION_REGEX, "")
    .replace(IMPORT_SOLIDITY_REGEX, "")
    .trim();
}

internalTask(
  "builtin:get-flattened-sources",
  "Returns all contracts and their dependencies flattened",
  async () => {
    const graph = await run("builtin:get-dependency-graph");
    const sortedFiles = getSortedFiles(graph);

    const buidlerVersion = require(path.join(
      __dirname,
      "..",
      "..",
      "package.json"
    )).version;

    let flattened = "";

    flattened += `// Sources flattened with buidler v${buidlerVersion}\n`;
    flattened += `pragma solidity ${config.solc.version};\n`;

    for (const file of sortedFiles) {
      flattened += `\n\n// File ${file.getNameWithVersion()}\n`;
      flattened += `\n${getFileWithoutPragmaNorImports(file)}\n`;
    }

    return flattened.trim();
  }
);

task(
  "flatten",
  "Flattens all the contract and their dependencies",
  async () => {
    console.log(await run("builtin:get-flattened-sources"));
  }
);
