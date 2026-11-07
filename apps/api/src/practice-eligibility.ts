// Questões que entram em treino e prova: publicadas, oficiais ou autorais, com
// 2 a 5 alternativas, gabarito entre elas e, se forem imagem, com o recorte.
// Fica num módulo próprio porque o treino, a prova da edição e o desempenho
// por área contam a mesma seleção. Publicação e revisão pertencem à curadoria;
// esta seleção não promove conteúdo privado.
export type PracticeSource = "OFFICIAL" | "GENERATED" | "MIXED";
export const PRACTICE_SOURCES: readonly PracticeSource[] = ["OFFICIAL", "GENERATED", "MIXED"];
const ORIGINS: Record<PracticeSource, string> = {
  OFFICIAL: "'AUTHOR_CREATED','OFFICIAL'",
  // Geradas por IA entram só quando o treino pede (07/11); a tela marca cada uma.
  GENERATED: "'AI_GENERATED'",
  MIXED: "'AUTHOR_CREATED','OFFICIAL','AI_GENERATED'",
};
export const eligible = (source: PracticeSource) => `SELECT q.id,q.question_id,q.topic,q.origin,q.exam_source_id,q.source_question_number
  FROM editorial_question c JOIN question_version q ON q.id=c.current_version_id
  WHERE q.editorial_status='PUBLISHED' AND q.origin IN (${ORIGINS[source]})
    AND (SELECT count(*) FROM question_option o WHERE o.question_id=q.id) BETWEEN 2 AND 5
    AND EXISTS(SELECT 1 FROM question_option o WHERE o.question_id=q.id AND o.id=q.correct_option_id)
    AND (q.presentation='TEXT' OR EXISTS(SELECT 1 FROM question_version_image i WHERE i.version_id=q.id))`;
export const ELIGIBLE = eligible("OFFICIAL");
