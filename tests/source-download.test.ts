import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadPdf } from "../scripts/lib/source-download.mjs";
import {
  downloadCatalog,
  validateDownloadUrl,
} from "../scripts/download-sources.mjs";
const url = "https://download.inep.gov.br/enade/test-only.pdf";
const mirror =
  "https://raw.githubusercontent.com/test/fixture/" +
  "a".repeat(40) +
  "/test-only.pdf";
const bytes = Buffer.from(
  "%PDF-1.7\nSYNTHETIC TEST BYTES; not an official document\n",
);
const sha256 = createHash("sha256").update(bytes).digest("hex");

test("PDF downloading enforces HTTPS and validates each redirect before requesting it", async () => {
  let calls = 0;
  await assert.rejects(
    downloadPdf(url, "unused", validateDownloadUrl, {
      run: async (_command, args) => {
        calls++;
        assert.equal(args[0], "--disable");
        assert.equal(args.includes("--insecure"), false);
        assert.equal(args.includes("--location"), false);
        assert.equal(args[args.indexOf("--proto") + 1], "=https");
        return { stdout: "302\nhttps://127.0.0.1/private.pdf" };
      },
    }),
    /não permitido/,
  );
  assert.equal(calls, 1);
  for (const bad of [
    url.replace("https:", "http:"),
    mirror.replace("a".repeat(40), "main"),
    mirror + "?token=x",
    "https://evil.example/enade/a.pdf",
  ])
    assert.throws(() => validateDownloadUrl(bad));
  assert.equal(
    validateDownloadUrl(
      "https://download.inep.gov.br/download/Enade2008_RNP/COMPUTACAO.pdf",
    ),
    "https://download.inep.gov.br/download/Enade2008_RNP/COMPUTACAO.pdf",
  );
});

test("redirect bounds and HTTP failures cannot produce successful download receipts", async () => {
  let calls = 0;
  await assert.rejects(
    downloadPdf(url, "unused", validateDownloadUrl, {
      run: async () => {
        calls++;
        return { stdout: "302\n" + url };
      },
    }),
    /Limite/,
  );
  assert.equal(calls, 4);
  await assert.rejects(
    downloadPdf(url, "unused", validateDownloadUrl, {
      run: async () => ({ stdout: "503\n" }),
    }),
    /HTTP 503/,
  );
});

test("catalog downloads resume known and unreviewed files without replacing existing bytes", async () => {
  const output = await mkdtemp(join(tmpdir(), "source-download-test-"));
  const docs = [
    {
      id: "known-fixture",
      year: 2021,
      officialUrl: url,
      mirrorUrl: mirror,
      sha256,
      byteSize: bytes.length,
    },
    { id: "unknown-fixture", year: 2024, officialUrl: url, sha256: null },
  ];
  let calls = 0;
  const download = async (_url, file) => {
    calls++;
    await writeFile(file, bytes);
    return _url;
  };
  try {
    const first = await downloadCatalog({ output, source: "official" }, docs, {
      download,
    });
    assert.deepEqual(
      first.map((r) => r.status),
      ["DOWNLOADED_MATCHED_COPY", "DOWNLOADED_UNREVIEWED"],
    );
    const second = await downloadCatalog({ output, source: "official" }, docs, {
      download,
    });
    assert.deepEqual(
      second.map((r) => r.status),
      ["CACHED_MATCHED_COPY", "CACHED_UNREVIEWED"],
    );
    assert.equal(calls, 2);
    assert.ok(second.every((r) => r.reviewed === false));
    const file = join(output, "2021/known-fixture.pdf");
    await writeFile(file, "user data to preserve");
    const failed = await downloadCatalog(
      { output, source: "official" },
      docs.slice(0, 1),
      { download },
    );
    assert.equal(failed[0].status, "FAILED");
    assert.equal(await readFile(file, "utf8"), "user data to preserve");
    assert.equal(calls, 2);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("a mismatched downloaded hash is quarantined and never replaces the expected document", async () => {
  const output = await mkdtemp(join(tmpdir(), "source-download-test-"));
  try {
    const results = await downloadCatalog(
      { output, source: "official" },
      [
        {
          id: "changed-fixture",
          year: 2021,
          officialUrl: url,
          sha256: "0".repeat(64),
        },
      ],
      {
        download: async (_url, file) => {
          await writeFile(file, bytes);
          return _url;
        },
      },
    );
    assert.equal(results[0].status, "FAILED");
    assert.equal(results[0].quarantineFile, `quarantine/${sha256}.pdf`);
    assert.equal(
      (await readFile(join(output, results[0].quarantineFile))).equals(bytes),
      true,
    );
    await assert.rejects(readFile(join(output, "2021/changed-fixture.pdf")), {
      code: "ENOENT",
    });
    assert.equal(
      (await readdir(output)).some((name) => name.startsWith(".download-")),
      false,
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("the curated inventory distinguishes retrieved copies from pending links and uses unique safe file IDs", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../data/official-sources.json", import.meta.url),
      "utf8",
    ),
  );
  const ids = new Set();
  for (const document of manifest.documents) {
    assert.equal(ids.has(document.id), false);
    ids.add(document.id);
    assert.match(document.id, /^[a-z0-9-]{1,150}$/);
    assert.equal(
      validateDownloadUrl(document.officialUrl),
      document.officialUrl,
    );
    assert.equal(
      document.officialUrl,
      document.listedOfficialUrl.replace(/^http:/, "https:"),
    );
    assert.equal(document.reviewed, false);
    if (document.status === "DOWNLOADED_MIRROR") {
      assert.match(document.sha256, /^[a-f0-9]{64}$/);
      assert.ok(document.byteSize > 5 && document.pageCount > 0);
      assert.equal(validateDownloadUrl(document.mirrorUrl), document.mirrorUrl);
    } else {
      assert.equal(document.sha256, null);
      assert.equal(document.pageCount, null);
    }
  }
});

test("local bundle import rejects path traversal and symlinks escaping the selected directory", async () => {
  const { bundleFile } = await import("../scripts/import-sources.mjs");
  const { mkdir, symlink } = await import("node:fs/promises");
  const root = await mkdtemp(join(tmpdir(), "source-bundle-test-"));
  try {
    const directory = join(root, "bundle");
    await mkdir(join(directory, "2021"), { recursive: true });
    const outside = join(root, "outside.pdf");
    await writeFile(outside, bytes);
    await symlink(outside, join(directory, "2021/escape-fixture.pdf"));
    await assert.rejects(
      bundleFile(directory, { id: "escape-fixture", year: 2021 }),
      /fora da pasta/,
    );
    await assert.rejects(
      bundleFile(directory, { id: "../outside", year: 2021 }),
      /inválido/,
    );
    const inside = join(directory, "2021/inside-fixture.pdf");
    await writeFile(inside, bytes);
    assert.equal(
      await bundleFile(directory, { id: "inside-fixture", year: 2021 }),
      inside,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
