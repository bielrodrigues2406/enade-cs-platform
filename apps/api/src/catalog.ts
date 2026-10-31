import { Controller, Get, Query, Req } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";
import { AREAS } from "./question-areas.js";

// Autorais (sem edição) primeiro, como antes; depois as oficiais da edição mais
// recente, na ordem da prova. O id desempata e mantém as páginas estáveis.
/** Sugestões do início: oficiais antes das autorais, demonstrações por último, provas recentes primeiro. */
const SUGGESTION_ORDER = `(origin='OFFICIAL') DESC,demonstration,year DESC NULLS LAST,"questionNumber" NULLS LAST,id`;
const CATALOG_ORDER = `year DESC NULLS FIRST,modality,"questionNumber" NULLS FIRST,id`;
const FILTERS = new Set(["q", "topic", "area", "year", "limit", "offset"]);
function text(value: unknown, max: number): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > max)
    fail("Filtro inválido.", 400);
  return value as string;
}
function integer(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,6})$/.test(value))
    fail("Página ou quantidade inválida.", 400);
  const parsed = Number(value);
  if (parsed < min || parsed > max)
    fail("Página ou quantidade inválida.", 400);
  return parsed;
}

@Controller("api/catalog")
export class CatalogController {
  @Get()
  async catalog(@Req() req: any, @Query() query: Record<string, unknown>) {
    const user = await requireIdentity(req);
    if (Object.keys(query).some((key) => !FILTERS.has(key)))
      fail("Filtro inválido.", 400);
    const search = text(query.q, 120), topic = text(query.topic, 80),
      area = text(query.area, 80), yearText = text(query.year, 4);
    if (area && area !== "unclassified" && !(AREAS as readonly string[]).includes(area))
      fail("Área inválida.", 400);
    if (yearText && (!/^\d{4}$/.test(yearText) || Number(yearText) < 2000 || Number(yearText) > 2100))
      fail("Ano inválido.", 400);
    const year = yearText ? Number(yearText) : null;
    const limit = integer(query.limit, 20, 1, 50);
    const offset = integer(query.offset, 0, 0, 1000000);

    // One statement keeps the page, all counts and global facets in the same
    // snapshot. Only current published pointers enter any public aggregate.
    const result = await db.query(
      `WITH published AS (
        SELECT q.id,q.title,q.topic,COALESCE(q.subject,q.topic) AS subject,q.prompt,q.origin,q.demonstration,
          q.version_number AS "versionNumber",q.source_question_number AS "questionNumber",
          CASE WHEN q.topic=ANY($8::text[]) THEN q.topic ELSE NULL END AS area,
          s.year,s.modality,
          EXISTS(SELECT 1 FROM answer a WHERE a.question_id=q.id AND a.owner_id=$1) AS answered
        FROM editorial_question c
        JOIN question_version q ON q.id=c.current_version_id
        LEFT JOIN source_document s ON s.id=q.exam_source_id AND s.kind='EXAM'
        WHERE q.editorial_status='PUBLISHED'
      ), filtered AS (
        SELECT * FROM published
        WHERE ($2='' OR strpos(lower(title),lower($2))>0 OR strpos(lower(prompt),lower($2))>0
            OR strpos(lower(subject),lower($2))>0)
          AND ($3='' OR subject=$3)
          AND ($4='' OR ($4='unclassified' AND area IS NULL) OR area=$4)
          AND ($5::integer IS NULL OR year=$5)
      ), counts AS (
        SELECT count(*)::integer AS total,
          count(*) FILTER (WHERE answered)::integer AS answered FROM filtered
      ), page_bounds AS (
        SELECT LEAST($7::integer,GREATEST(0,((total-1)/$6::integer)*$6::integer)) AS effective_offset FROM counts
      )
      SELECT json_build_object(
        'items',COALESCE((SELECT json_agg(i ORDER BY i.year DESC NULLS FIRST,i.modality,i."questionNumber" NULLS FIRST,i.id) FROM (
          SELECT id,title,topic,subject,origin,demonstration,"versionNumber",answered,
            area,year,modality,"questionNumber"
          FROM filtered ORDER BY ${CATALOG_ORDER} LIMIT $6 OFFSET (SELECT effective_offset FROM page_bounds)
        ) i),'[]'::json),
        'total',(SELECT total FROM counts),
        'answeredTotal',(SELECT answered FROM counts),
        'limit',$6::integer,'offset',(SELECT effective_offset FROM page_bounds),
        'summary',(SELECT json_build_object(
          'total',count(*)::integer,
          'answered',count(*) FILTER (WHERE answered)::integer,
          'official',count(*) FILTER (WHERE origin='OFFICIAL')::integer,
          'author',count(*) FILTER (WHERE origin<>'OFFICIAL' AND NOT demonstration)::integer,
          'demonstration',count(*) FILTER (WHERE demonstration)::integer
        ) FROM published),
        'suggestions',COALESCE((SELECT json_agg(i ORDER BY i.rank) FROM (
          SELECT *,row_number() OVER (ORDER BY ${SUGGESTION_ORDER}) AS rank FROM (
            -- Uma não respondida por área, para variar o que o início sugere.
            SELECT DISTINCT ON (COALESCE(area,topic)) id,title,topic,subject,origin,demonstration,
              "versionNumber",answered,area,year,modality,"questionNumber"
            FROM published WHERE NOT answered
            ORDER BY COALESCE(area,topic),${SUGGESTION_ORDER}
          ) per_area ORDER BY ${SUGGESTION_ORDER} LIMIT 3
        ) i),'[]'::json),
        'facets',json_build_object(
          'areas',(SELECT json_agg(json_build_object(
            'name',u.name,'count',(SELECT count(*)::integer FROM published p WHERE p.area=u.name)
          ) ORDER BY u.ordinality) FROM unnest($8::text[]) WITH ORDINALITY u(name,ordinality)),
          'unclassified',(SELECT count(*)::integer FROM published WHERE area IS NULL),
          'topics',COALESCE((SELECT json_agg(t.subject ORDER BY t.subject) FROM (
            SELECT DISTINCT subject FROM published
          ) t),'[]'::json),
          'years',COALESCE((SELECT json_agg(y.year ORDER BY y.year DESC) FROM (
            SELECT DISTINCT year FROM published WHERE year IS NOT NULL
          ) y),'[]'::json)
        )
      ) AS catalog`,
      [user.id, search, topic, area, year, limit, offset, [...AREAS]],
    );
    return result.rows[0].catalog;
  }
}
