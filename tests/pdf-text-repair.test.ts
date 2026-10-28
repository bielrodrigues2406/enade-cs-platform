import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile, link, symlink, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const python = process.env.PDF_PYTHON || "python3";
const repairScript = fileURLToPath(new URL("../scripts/repair-calibri-text.py", import.meta.url));
const map = fileURLToPath(new URL("../data/calibri-cid-unicode.json", import.meta.url));
const limits = { timeout: 10000, maxBuffer: 512 * 1024 };
// Only intentionally unregistered fixture bytes. No official identity/hash is
// fabricated; rejection must happen before a PDF parser can accept this input.
const fixtureBytes = Buffer.from("%PDF-TEST ONLY unregistered fixture\n");
async function absent(path) {
  await assert.rejects(access(path), (error) => error.code === "ENOENT");
}

test("repair and map-builder never overwrite sources, references, maps or occupied aliases", async () => {
  const directory = await mkdtemp(join(tmpdir(), "enade-repair-alias-test-"));
  try {
    const input = join(directory, "test-only-source.pdf");
    const hard = join(directory, "hardlink.pdf"), symbolic = join(directory, "symlink.pdf");
    const fakeMap = join(directory, "test-only-map.json");
    await writeFile(input, fixtureBytes); await link(input, hard); await symlink(input, symbolic);
    await writeFile(fakeMap, '{"testOnly":true}\n');
    const inputBefore = await readFile(input), mapBefore = await readFile(fakeMap);
    for (const output of [input, hard, symbolic, fakeMap]) {
      await assert.rejects(run(python, ["-I", repairScript, "repair", "--map", fakeMap,
        input, output], limits), (error) => /saída já existe/.test(error.stderr));
      await assert.rejects(run(python, ["-I", repairScript, "build-map", "--output", output,
        input], limits), (error) => /saída já existe/.test(error.stderr));
    }
    const output = join(directory, "new-copy.pdf"), receipt = `${output}.json`;
    await symlink(input, receipt);
    await assert.rejects(run(python, ["-I", repairScript, "repair", "--map", map,
      input, output], limits), (error) => /saída já existe/.test(error.stderr));
    await absent(output);
    assert.deepEqual(await readFile(input), inputBefore);
    assert.deepEqual(await readFile(hard), inputBefore);
    assert.deepEqual(await readFile(symbolic), inputBefore);
    assert.deepEqual(await readFile(receipt), inputBefore);
    assert.deepEqual(await readFile(fakeMap), mapBefore);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unknown source bytes and unknown maps create no derived PDF, receipt or reference map", async () => {
  const directory = await mkdtemp(join(tmpdir(), "enade-repair-source-test-"));
  try {
    const input = join(directory, "test-only-unregistered.pdf");
    const fakeMap = join(directory, "test-only-unregistered-map.json");
    const output = join(directory, "new-copy.pdf"), builtMap = join(directory, "new-map.json");
    await writeFile(input, fixtureBytes); await writeFile(fakeMap, '{"map":{"258":"x"}}\n');
    await assert.rejects(run(python, ["-I", repairScript, "repair", "--map", map, input, output], limits),
      (error) => /não corresponde às edições catalogadas/.test(error.stderr));
    await assert.rejects(run(python, ["-I", repairScript, "repair", "--map", fakeMap, input, output], limits),
      (error) => /mapa Unicode não corresponde/.test(error.stderr));
    await assert.rejects(run(python, ["-I", repairScript, "build-map", "--output", builtMap, input], limits),
      (error) => /não corresponde às edições catalogadas/.test(error.stderr));
    await absent(output); await absent(`${output}.json`); await absent(builtMap);
    assert.deepEqual(await readFile(input), fixtureBytes);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("CMap decoding preserves explicit ranges and rejects contradictions or truncated values", async () => {
  const code = `
import runpy, sys
module = runpy.run_path(sys.argv[1], run_name="test_only_module")
parse = module["parse_to_unicode"]
assert parse(b"1 beginbfrange <0001> <0003> <0041> endbfrange") == {1:"A",2:"B",3:"C"}
assert parse(b"1 beginbfrange <0001> <0002> [<0061> <0062>] endbfrange") == {1:"a",2:"b"}
# Both encodings denote the same ligature; normalization must not invent a conflict.
assert parse(b"2 beginbfchar <0001> <FB01> <0001> <00660069> endbfchar") == {1:"fi"}
cases = [
    b"2 beginbfchar <0001> <0041> <0001> <0042> endbfchar",
    b"1 beginbfchar <0001> <0041> endbfchar 1 beginbfrange <0001> <0001> <0042> endbfrange",
    b"1 beginbfrange <0002> <0001> <0041> endbfrange",
    b"1 beginbfrange <0001> <10000> <0041> endbfrange",
    b"1 beginbfrange <0001> <0002> [<0061>] endbfrange",
    b"1 beginbfchar <0001> <004100> endbfchar",
]
for source in cases:
    try:
        parse(source)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid CMap accepted: " + repr(source))
print("CMap checks passed")
`;
  const result = await run(python, ["-I", "-c", code, repairScript], limits);
  assert.equal(result.stdout.trim(), "CMap checks passed");
});
