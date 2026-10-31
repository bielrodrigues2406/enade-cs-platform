import { Controller, Get, Query, Req } from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";

@Controller("api/review")
export class ReviewController {
  @Get()
  async notebook(
    @Req() req: any,
    @Query("topic") topic = "",
    @Query("offset") offset = "0",
  ) {
    const user = await requireIdentity(req);
    if (
      typeof topic !== "string" ||
      topic.length > 80 ||
      typeof offset !== "string" ||
      !/^(0|[1-9]\d{0,6})$/.test(offset) ||
      Number(offset) > 1000000
    )
      fail("Filtro ou página inválidos.", 400);

    // One statement gives counts, filters and page the same database snapshot.
    // Revisão espaçada: o erro volta para revisão um dia depois de a pessoa ter
    // visto o gabarito; refazer na hora só repete a resposta da memória.
    // A changed answer replaces its earlier choice; it is not another attempt.
    const result = await db.query(
      `WITH latest AS (
        SELECT DISTINCT ON (v.question_id)
          v.question_id,v.id,v.title,v.topic,v.origin,v.demonstration,
          v.version_number,a.updated_at,
          a.option_id=v.correct_option_id AS correct,c.current_version_id
        FROM answer a
        JOIN question_version v ON v.id=a.question_id
        JOIN editorial_question c ON c.id=v.question_id
        WHERE a.owner_id=$1 AND v.editorial_status='PUBLISHED'
        ORDER BY v.question_id,a.updated_at DESC,v.version_number DESC,v.id
      ), pending AS (
        SELECT * FROM latest WHERE NOT correct AND ($2='' OR topic=$2)
      )
      SELECT json_build_object(
        'summary',(SELECT json_build_object(
          'answered',count(*)::integer,
          'correct',count(*) FILTER (WHERE correct)::integer,
          'incorrect',count(*) FILTER (WHERE NOT correct)::integer,
          'demonstration',count(*) FILTER (WHERE demonstration)::integer,
          'ready',count(*) FILTER (WHERE NOT correct AND updated_at <= now() - interval '1 day')::integer
        ) FROM latest),
        'topics',COALESCE((SELECT json_agg(t ORDER BY t.topic) FROM (
          SELECT topic,count(*)::integer AS answered,
            count(*) FILTER (WHERE NOT correct)::integer AS incorrect
          FROM latest GROUP BY topic
        ) t),'[]'::json),
        'total',(SELECT count(*)::integer FROM pending),
        'items',COALESCE((SELECT json_agg(i ORDER BY i."answeredAt",i.id) FROM (
          SELECT id,question_id AS "questionId",title,topic,origin,demonstration,
            version_number AS "versionNumber",updated_at AS "answeredAt",
            current_version_id AS "currentVersionId",
            updated_at + interval '1 day' AS "reviewAt",updated_at <= now() - interval '1 day' AS ready
          FROM pending ORDER BY updated_at,id LIMIT 20 OFFSET $3
        ) i),'[]'::json)
      ) AS notebook`,
      [user.id, topic, Number(offset)],
    );
    return { ...result.rows[0].notebook, offset: Number(offset), pageSize: 20 };
  }
}
