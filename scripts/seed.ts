import { db } from "../apps/api/src/database.js";
const questions = [
  {
    id: "demo-sql-v1",
    title: "Quando uma transação falha",
    topic: "Banco de dados",
    prompt:
      "Uma transferência bancária executa duas operações na mesma transação: debitar R$ 100 da conta de origem e creditar R$ 100 na conta de destino. O débito é executado, mas o crédito falha. Qual propriedade ACID garante que o débito não permaneça isoladamente?",
    choices: [
      "Isolamento: impede que duas transações sejam executadas ao mesmo tempo.",
      "Atomicidade: a transação é aplicada por inteiro ou desfeita por inteiro.",
      "Durabilidade: toda operação iniciada é preservada, mesmo quando falha.",
      "Consistência: qualquer comando SQL é automaticamente considerado válido.",
    ],
    correct: 1,
    explanation:
      "Atomicidade trata a transação como uma unidade: ou todas as suas operações são confirmadas, ou nenhuma delas é mantida. Durabilidade protege transações já confirmadas; isolamento controla a interferência entre transações.",
  },
  {
    id: "demo-search-v1",
    title: "Busca em uma coleção ordenada",
    topic: "Algoritmos",
    prompt:
      "Um vetor ordenado contém n elementos distintos. A cada etapa, uma busca compara o alvo com o elemento central e descarta metade do intervalo restante. Qual é a complexidade de tempo no pior caso?",
    choices: ["O(1)", "O(n)", "O(log n)", "O(n²)"],
    correct: 2,
    explanation:
      "A busca binária reduz o intervalo pela metade a cada comparação. Após k etapas, restam aproximadamente n/2ᵏ elementos. Para reduzir o intervalo a um elemento, k cresce como log₂ n.",
  },
  {
    id: "demo-network-v1",
    title: "Entrega confiável de um fluxo",
    topic: "Redes",
    prompt:
      "Uma aplicação precisa transportar um fluxo de bytes de forma ordenada e com retransmissão de dados perdidos. Qual protocolo da camada de transporte oferece essas características?",
    choices: ["IP", "UDP", "ARP", "TCP"],
    correct: 3,
    explanation:
      "TCP oferece um fluxo de bytes ordenado, com controle de sequência, confirmação e retransmissão. Isso não garante disponibilidade permanente da rede: conexões ainda podem falhar. UDP não oferece essas garantias por si só.",
  },
];
async function seed() {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(67124301)");
    for (const q of questions) {
      if (
        (
          await client.query("SELECT 1 FROM question_version WHERE id=$1", [
            q.id,
          ])
        ).rowCount
      )
        continue;
      await client.query(
        "INSERT INTO editorial_question(id,origin) VALUES($1,'AUTHOR_CREATED') ON CONFLICT(id) DO NOTHING",
        [q.id],
      );
      const created = await client.query(
        `INSERT INTO question_version(id,question_id,title,topic,prompt,origin,editorial_status,explanation,correct_option_id,demonstration,author_credit) VALUES($1,$1,$2,$3,$4,'AUTHOR_CREATED','DRAFT',$5,$6,true,'Conteúdo demonstrativo da base') ON CONFLICT(id) DO NOTHING RETURNING id`,
        [
          q.id,
          q.title,
          q.topic,
          q.prompt,
          q.explanation +
            " Explicação autoral demonstrativa; não é um gabarito do Inep.",
          `${q.id}-${q.correct}`,
        ],
      );
      if (!created.rowCount) continue; // Never mutate a version already used by a student.
      for (const [i, text] of q.choices.entries())
        await client.query(
          "INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",
          [q.id, `${q.id}-${i}`, text, i],
        );
      await client.query(
        "UPDATE question_version SET editorial_status='PUBLISHED' WHERE id=$1",
        [q.id],
      );
      await client.query(
        "UPDATE editorial_question SET current_version_id=$1 WHERE id=$1",
        [q.id],
      );
    }
    await client.query("COMMIT");
    console.log(
      "3 questões autorais demonstrativas disponíveis. Conteúdo oficial: 0.",
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}
seed().catch(() => {
  console.error(
    "Falha ao carregar seed; confira migrations e configuração do banco.",
  );
  process.exitCode = 1;
});
