import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { curator, object, revision, text, transaction } from "./editorial.js";
import {
  readArchive,
  sourceById,
  sourceFields,
  sourceMetadata,
  sourceView,
  type Source,
} from "./source-store.js";
@Controller("api/curation/sources")
export class SourcesController {
  @Get() async list(@Req() req: any) {
    const actor = await curator(req);
    return (
      await db.query<Source>(
        `SELECT ${sourceFields} FROM source_document ORDER BY year DESC,title,id LIMIT 100`,
      )
    ).rows.map((s) => sourceView(s, actor.id));
  }
  @Get(":id") async get(@Req() req: any, @Param("id") id: string) {
    const actor = await curator(req);
    return sourceView(await sourceById(id), actor.id);
  }
  @Get(":id/file") async file(
    @Req() req: any,
    @Param("id") id: string,
    @Res() res: any,
  ) {
    await curator(req);
    const source = await sourceById(id),
      bytes = await readArchive(source);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="source-${source.id}.pdf"`,
    );
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.send(bytes);
  }
  @Put(":id") async edit(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = object(body),
      expected = revision(input),
      meta = sourceMetadata(input);
    return transaction(req, async (client, actor) => {
      const source = await sourceById(id, client);
      await client.query(
        "SELECT id FROM source_document WHERE id=$1 FOR UPDATE",
        [id],
      );
      const current = await sourceById(id, client);
      if (current.revision !== expected || current.status === "VERIFIED")
        fail("A fonte mudou ou já foi conferida. Reabra o registro.", 409);
      await client.query(
        "UPDATE source_document SET title=$2,kind=$3,year=$4,area=$5,modality=$6,last_editor_id=$7,status='IMPORTED',revision=revision+1,reviewed_by=NULL,reviewed_at=NULL,is_final=false WHERE id=$1",
        [
          source.id,
          meta.title,
          meta.kind,
          meta.year,
          meta.area,
          meta.modality,
          actor,
        ],
      );
      await client.query(
        "INSERT INTO source_event(source_id,actor_id,event_type) VALUES($1,$2,'EDITED')",
        [id, actor],
      );
      return sourceView(await sourceById(id, client), actor);
    });
  }
  @Post(":id/review") @HttpCode(200) async review(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const input = object(body),
      expected = revision(input),
      note = text(input.note, "Parecer", 2000, 10);
    if (!["VERIFY", "REJECT"].includes(input.decision as string))
      fail("Decisão de conferência inválida.", 400);
    return transaction(req, async (client, actor) => {
      await sourceById(id, client);
      await client.query(
        "SELECT id FROM source_document WHERE id=$1 FOR UPDATE",
        [id],
      );
      const source = await sourceById(id, client);
      if (source.revision !== expected || source.status !== "IMPORTED")
        fail("A fonte mudou ou não está aguardando conferência.", 409);
      if (source.importedBy === actor || source.lastEditor === actor)
        fail("Outra pessoa da curadoria deve conferir esta fonte.", 403);
      const verify = input.decision === "VERIFY";
      if (verify) {
        const check = object(input.checklist);
        if (
          check.origin !== true ||
          check.edition !== true ||
          check.integrity !== true ||
          (source.kind === "ANSWER_KEY" && check.final !== true)
        )
          fail(
            "Confira origem, edição, integridade e o caráter definitivo do gabarito.",
            400,
          );
        await readArchive(source);
      }
      await client.query(
        "UPDATE source_document SET status=$2,revision=revision+1,reviewed_by=$3,reviewed_at=now(),note=$4,is_final=$5 WHERE id=$1",
        [
          id,
          verify ? "VERIFIED" : "REJECTED",
          actor,
          note,
          verify && source.kind === "ANSWER_KEY",
        ],
      );
      await client.query(
        "INSERT INTO source_event(source_id,actor_id,event_type,note) VALUES($1,$2,$3,$4)",
        [id, actor, verify ? "VERIFIED" : "REJECTED", note],
      );
      return sourceView(await sourceById(id, client), actor);
    });
  }
}
