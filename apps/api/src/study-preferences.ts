import { Body, Controller, Get, Put, Req } from "@nestjs/common";
import type { IncomingMessage } from "node:http";
import { db } from "./database.js";
import { fail } from "./api-error.js";
import { requireIdentity } from "./session.js";

type Preferences = { mascotEnabled: boolean };

@Controller("api/me/preferences")
export class StudyPreferencesController {
  @Get() async get(@Req() req: IncomingMessage): Promise<Preferences> {
    const user = await requireIdentity(req);
    if (!user.email) fail("Entre na conta para recuperar suas preferências.", 401);
    const saved = (await db.query<Preferences>(
      'SELECT mascot_enabled AS "mascotEnabled" FROM account WHERE identity_id=$1', [user.id],
    )).rows[0];
    return saved ?? fail("Entre novamente na conta para recuperar suas preferências.", 401);
  }

  @Put() async update(@Req() req: IncomingMessage, @Body() body: unknown): Promise<Preferences> {
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || !("mascotEnabled" in body)
      || typeof body.mascotEnabled !== "boolean") return fail("Preferência inválida.", 400);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const user = await requireIdentity(req, client, true);
      if (!user.email) fail("Entre na conta para guardar suas preferências.", 401);
      const saved = (await client.query<Preferences>(
        'UPDATE account SET mascot_enabled=$2 WHERE identity_id=$1 RETURNING mascot_enabled AS "mascotEnabled"',
        [user.id, body.mascotEnabled],
      )).rows[0];
      if (!saved) fail("Entre novamente na conta para guardar suas preferências.", 401);
      await client.query("COMMIT");
      return saved;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
}
