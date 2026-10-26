import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Validate every redirect before fetching it; curl never follows redirects itself.
export async function downloadPdf(
  url,
  destination,
  validate,
  { run = execute } = {},
) {
  let current = validate(url);
  for (let redirects = 0; redirects <= 3; redirects++) {
    let output;
    try {
      output = (
        await run(
          "curl",
          [
            "--disable",
            "--silent",
            "--show-error",
            "--proto",
            "=https",
            "--connect-timeout",
            "10",
            "--max-time",
            "30",
            "--max-filesize",
            String(MAX_PDF_BYTES),
            "--output",
            destination,
            "--write-out",
            "%{http_code}\n%{redirect_url}",
            "--url",
            current,
          ],
          {
            timeout: 35000,
            killSignal: "SIGKILL",
            maxBuffer: 65536,
            encoding: "utf8",
          },
        )
      ).stdout;
    } catch {
      throw new Error(
        "Falha de rede, TLS ou limite de tempo/tamanho ao baixar o PDF.",
      );
    }
    const [status, redirect] = output.trim().split(/\r?\n/);
    if (status === "200") return current;
    if (!["301", "302", "303", "307", "308"].includes(status))
      throw new Error(
        `PDF indisponível: HTTP ${/^\d{3}$/.test(status) ? status : "inválido"}.`,
      );
    if (redirects === 3 || !redirect)
      throw new Error(
        "Limite de redirecionamentos excedido ou destino ausente.",
      );
    current = validate(redirect);
  }
  throw new Error("Não foi possível resolver o endereço do PDF.");
}
