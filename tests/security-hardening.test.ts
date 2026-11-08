import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp, db } from "../apps/api/src/main.js";
import { authorize } from "../apps/api/src/roles.js";
import { normalizeIpForLimit, setSessionCookie } from "../apps/api/src/session.js";

let app: Awaited<ReturnType<typeof createApp>>;
let base: string;
const createdEmails: string[] = [];
const createdClasses: string[] = [];
const createdDiscursive: string[] = [];
const createdSources: string[] = [];

before(async () => {
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

after(async () => {
  try {
    await db.query("DELETE FROM study_class WHERE id = ANY($1::uuid[])", [createdClasses]);
    await db.query("DELETE FROM discursive_question WHERE id = ANY($1::text[])", [createdDiscursive]);
    await db.query("DELETE FROM source_document WHERE id = ANY($1::uuid[])", [createdSources]);
    const ids = (
      await db.query<{ identity_id: string }>(
        "SELECT identity_id FROM account WHERE email = ANY($1) OR email LIKE 'excluida-%@anon.invalid'",
        [createdEmails],
      )
    ).rows.map((r) => r.identity_id);
    await db.query("DELETE FROM activity_log WHERE actor_id = ANY($1::uuid[]) OR subject = ANY($2)", [
      ids,
      [...createdEmails, "conta-excluida"],
    ]);
    await db.query("DELETE FROM role_event WHERE email = ANY($1) OR email = 'conta-excluida@anon.invalid'", [createdEmails]);
    await db.query("DELETE FROM role_invitation WHERE email = ANY($1) OR invited_by = ANY($2::uuid[])", [createdEmails, ids]);
    await db.query("DELETE FROM account_role WHERE identity_id = ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM browser_session WHERE identity_id = ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM answer WHERE owner_id = ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM account WHERE identity_id = ANY($1::uuid[])", [ids]);
    await db.query("DELETE FROM study_identity WHERE id = ANY($1::uuid[])", [ids]);
  } finally {
    await app.close();
    await db.end();
  }
});

async function registerUser(opts: { name?: string; enrollment?: string; password?: string; admin?: boolean } = {}) {
  const guest = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  let cookie = guest.headers.get("set-cookie")!.split(";")[0];
  const email = `sec-${randomUUID().slice(0, 8)}@example.invalid`;
  const password = opts.password ?? "Seguranca estudo 2026!";
  createdEmails.push(email);
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name: opts.name ?? "Estudante Teste",
      enrollment: opts.enrollment ?? "",
    }),
  });
  assert.equal(res.status, 201);
  cookie = res.headers.get("set-cookie")!.split(";")[0];
  const id = (
    await db.query<{ identity_id: string }>("SELECT identity_id FROM account WHERE email=$1", [email])
  ).rows[0].identity_id;
  if (opts.admin) {
    const client = await db.connect();
    try {
      await authorize(client, email, "ADMIN", null);
    } finally {
      client.release();
    }
  }
  return { id, email, password, cookie };
}

test("session cookie uses __Host- in production, rejects duplicate cookies, and normalizes IPv6 /64", async () => {
  assert.equal(normalizeIpForLimit("::ffff:200.133.10.25"), "200.133.10.25");
  assert.equal(normalizeIpForLimit("2804:14d:5c80:1234:aaaa:bbbb:cccc:dddd"), "2804:014d:5c80:1234::/64");
  assert.equal(normalizeIpForLimit("2804:14d:5c80:1234:1111:2222:3333:4444"), "2804:014d:5c80:1234::/64");

  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    let capturedName = "";
    let capturedOpts: Record<string, unknown> = {};
    setSessionCookie(
      {
        cookie(name: string, _val: string, opts: Record<string, unknown>) {
          capturedName = name;
          capturedOpts = opts;
        },
      },
      "abc123",
    );
    assert.equal(capturedName, "__Host-enade_session");
    assert.equal(capturedOpts.path, "/");
    assert.equal(capturedOpts.sameSite, "strict");
    assert.equal(capturedOpts.secure, true);
    assert.equal(capturedOpts.httpOnly, true);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }

  const user = await registerUser();
  // Cookie tossing: quando um subdomínio irmão injeta um segundo cookie de mesmo nome, recusamos ambos.
  const tossed = await fetch(`${base}/api/me/profile`, {
    headers: { Cookie: `enade_session=${"a".repeat(64)}; ${user.cookie}` },
  });
  assert.equal(tossed.status, 401);
});

test("Sec-Fetch-Site blocks cross-site and sibling same-site mutations even without Origin header", async () => {
  const user = await registerUser();

  const crossSite = await fetch(`${base}/api/me/profile`, {
    method: "PUT",
    headers: {
      Cookie: user.cookie,
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "cross-site",
    },
    body: JSON.stringify({ name: "Invasao Cross" }),
  });
  assert.equal(crossSite.status, 403);

  const siblingSubdomain = await fetch(`${base}/api/me/profile`, {
    method: "PUT",
    headers: {
      Cookie: user.cookie,
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-site",
    },
    body: JSON.stringify({ name: "Subdominio Irmao" }),
  });
  assert.equal(siblingSubdomain.status, 403);

  const sameOrigin = await fetch(`${base}/api/me/profile`, {
    method: "PUT",
    headers: {
      Cookie: user.cookie,
      "Content-Type": "application/json",
      "Sec-Fetch-Site": "same-origin",
    },
    body: JSON.stringify({ name: "Mesma Origem" }),
  });
  assert.equal(sameOrigin.status, 200);
});

test("profile preserves omitted enrollment, requires currentPassword to change existing enrollment, and binds roster email", async () => {
  const enrollment = `PE${Math.floor(3000000 + Math.random() * 899999)}`;
  const admin = await registerUser({ admin: true, name: "Docente Admin" });
  const impostor = await registerUser({ enrollment, name: "Conta Outra" });

  // Omitir enrollment ao salvar apenas o nome preserva o prontuário já salvo.
  const keepRes = await fetch(`${base}/api/me/profile`, {
    method: "PUT",
    headers: { Cookie: impostor.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Conta Outra Editada" }),
  });
  assert.equal(keepRes.status, 200);
  assert.equal((await keepRes.json()).enrollment, enrollment);

  // Trocar prontuário já preenchido sem senha atual falha com 403.
  const nextEnrollment = `PE${Math.floor(4000000 + Math.random() * 899999)}`;
  const noPass = await fetch(`${base}/api/me/profile`, {
    method: "PUT",
    headers: { Cookie: impostor.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Conta Outra Editada", enrollment: nextEnrollment }),
  });
  assert.equal(noPass.status, 403);

  const withPass = await fetch(`${base}/api/me/profile`, {
    method: "PUT",
    headers: { Cookie: impostor.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Conta Outra Editada",
      enrollment,
      currentPassword: impostor.password,
    }),
  });
  assert.equal(withPass.status, 200);

  // Turma com e-mail oficial distinto na chamada não vaza presença para quem cadastrou só o prontuário.
  const clsRes = await fetch(`${base}/api/classes`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Turma Seguranca", editionYear: 2026 }),
  });
  assert.equal(clsRes.status, 201);
  const classId = (await clsRes.json()).id as string;
  createdClasses.push(classId);

  const rosterRes = await fetch(`${base}/api/classes/${classId}/members`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `=HYPERLINK("http://evil.invalid");${enrollment};titular.real@aluno.exemplo.edu.br`,
    }),
  });
  assert.equal(rosterRes.status, 200);

  const lessonRes = await fetch(`${base}/api/classes/${classId}/lessons`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      startsAt: "2026-11-10T19:00:00.000Z",
      endsAt: "2026-11-10T20:40:00.000Z",
      room: "Lab 1",
      subject: "Segurança",
      teacherId: admin.id,
    }),
  });
  assert.equal(lessonRes.status, 201);

  const myLessons = await (
    await fetch(`${base}/api/my/lessons`, { headers: { Cookie: impostor.cookie } })
  ).json();
  assert.deepEqual(myLessons.lessons, []);

  // CSV neutraliza prefixo de fórmula (=HYPERLINK...) com apóstrofo inicial.
  const csvText = await (
    await fetch(`${base}/api/classes/${classId}/attendance.csv`, { headers: { Cookie: admin.cookie } })
  ).text();
  assert.match(csvText, /"'=HYPERLINK\(""http:\/\/evil\.invalid""\)"/);
});

test("discursive detail hides standardUrl until student submits response", async () => {
  const admin = await registerUser({ admin: true });
  const reviewer = await registerUser({ admin: true });
  const student = await registerUser();
  const examSrc = randomUUID();
  const stdSrc = randomUUID();
  createdSources.push(examSrc, stdSrc);
  const shaA = randomUUID().replace(/-/g, "").padEnd(64, "a");
  const shaB = randomUUID().replace(/-/g, "").padEnd(64, "b");
  await db.query(
    `INSERT INTO source_document(id,title,kind,year,area,modality,official_url,sha256,byte_size,page_count,status,imported_by,reviewed_by,reviewed_at,note,is_final)
     VALUES ($1,'Prova Teste','EXAM',2021,'Ciência da Computação','BACHARELADO','https://download.inep.gov.br/enade/prova-sec.pdf',$3,1024,4,'VERIFIED',$5,$6,now(),'Conferido para teste',false),
            ($2,'Padrao Secreto','ANSWER_KEY',2021,'Ciência da Computação','BACHARELADO','https://download.inep.gov.br/enade/padrao-secreto.pdf',$4,1024,4,'VERIFIED',$5,$6,now(),'Conferido para teste',true)`,
    [examSrc, stdSrc, shaA, shaB, admin.id, reviewer.id],
  );
  const qId = `discursive-${shaA.slice(0, 12)}-d99`;
  createdDiscursive.push(qId);
  await db.query(
    `INSERT INTO discursive_question(id,year,modality,number,area,exam_source_id,standard_source_id,criteria,reviewed_by)
     VALUES ($1,2021,'BACHARELADO',99,'Redes de Computadores',$2,$3,'[{"label":"a","points":10}]'::jsonb,$4)`,
    [qId, examSrc, stdSrc, admin.id],
  );

  const beforeSubmit = await (
    await fetch(`${base}/api/discursive/${qId}`, { headers: { Cookie: student.cookie } })
  ).json();
  assert.equal(beforeSubmit.standardUrl, null);
  assert.deepEqual(beforeSubmit.standardImages, []);

  const submitted = await (
    await fetch(`${base}/api/discursive/${qId}/submit`, {
      method: "POST",
      headers: { Cookie: student.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        body: "TLS 1.3 reduz o handshake para 1-RTT e exige sigilo perfeito de encaminhamento com ECDHE.",
        baseRevision: 0,
      }),
    })
  ).json();
  assert.equal(submitted.standardUrl, "https://download.inep.gov.br/enade/padrao-secreto.pdf");
});

test("LGPD account deletion removes student account or anonymizes staff account while preserving institutional provenance", async () => {
  const admin = await registerUser({ admin: true, name: "Admin Responsavel" });
  const student = await registerUser({ name: "Aluno Excluir", enrollment: `PE${Math.floor(5000000 + Math.random() * 899999)}` });
  const teacher = await registerUser({ name: "Docente Excluir" });

  await fetch(`${base}/api/admin/roles`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ email: teacher.email, role: "PROFESSOR" }),
  });

  // Docente com aula criada mantém vínculo institucional -> deve ser anonimizado sem quebrar FK.
  const cls = await (
    await fetch(`${base}/api/classes`, {
      method: "POST",
      headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Turma LGPD", editionYear: 2026 }),
    })
  ).json();
  createdClasses.push(cls.id);
  await fetch(`${base}/api/classes/${cls.id}/lessons`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      startsAt: "2026-11-12T19:00:00.000Z",
      endsAt: "2026-11-12T20:40:00.000Z",
      room: "B201",
      subject: "Banco de Dados",
      teacherId: teacher.id,
    }),
  });

  // Senha errada do admin é recusada.
  const wrongPw = await fetch(`${base}/api/admin/accounts/${student.id}/delete`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ adminPassword: "Senha errada 9999!", reason: "Pedido LGPD" }),
  });
  assert.equal(wrongPw.status, 403);

  // Conta de estudante sem vínculos institucionais é fisicamente removida.
  const delStudent = await fetch(`${base}/api/admin/accounts/${student.id}/delete`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ adminPassword: admin.password, reason: "Pedido LGPD do titular" }),
  });
  assert.equal(delStudent.status, 200);
  assert.equal((await delStudent.json()).status, "DELETED");
  assert.equal((await db.query("SELECT 1 FROM account WHERE identity_id=$1", [student.id])).rowCount, 0);
  assert.equal((await db.query("SELECT 1 FROM study_identity WHERE id=$1", [student.id])).rowCount, 0);

  // Conta de docente com aula vinculada tem dados pessoais/estudo removidos e registro anonimizado.
  const delTeacher = await fetch(`${base}/api/admin/accounts/${teacher.id}/delete`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ adminPassword: admin.password, reason: "Desligamento docente" }),
  });
  assert.equal(delTeacher.status, 200);
  assert.equal((await delTeacher.json()).status, "ANONYMIZED");
  const anonRow = (
    await db.query<{ email: string; display_name: string | null; enrollment: string | null }>(
      "SELECT email, display_name, enrollment FROM account WHERE identity_id=$1",
      [teacher.id],
    )
  ).rows[0];
  assert.match(anonRow.email, /^excluida-.*@anon\.invalid$/);
  assert.equal(anonRow.display_name, null);
  assert.equal(anonRow.enrollment, null);

  // Contas anonimizadas não aparecem na listagem ativa de /api/admin/users.
  const listed = await (
    await fetch(`${base}/api/admin/users?q=${encodeURIComponent(teacher.id.slice(0, 8))}`, {
      headers: { Cookie: admin.cookie },
    })
  ).json();
  assert.equal(listed.total, 0);
});
