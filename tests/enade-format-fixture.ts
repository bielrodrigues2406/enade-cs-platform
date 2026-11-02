// Synthetic TEST ONLY sources. Nothing from the real catalogue is edited.
import { createHash, randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import type { Pool } from "pg";
import { assetPath, storeAsset } from "../apps/api/src/question-images.js";

export async function formatFixture(pool: Pool) {
  const prefix=`test-only-format-${randomUUID()}`;
  const [exam,key,standard]=[randomUUID(),randomUUID(),randomUUID()];
  const discursive=`discursive-${exam.replaceAll("-","").slice(0,12)}-d3`;
  const assets:string[]=[];
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [id,kind] of [[exam,"EXAM"],[key,"ANSWER_KEY"],[standard,"RESPONSE_STANDARD"]])
      await client.query(
        `INSERT INTO source_document(id,title,official_url,kind,year,area,modality,sha256,byte_size,page_count,
          status,verification_origin,assisted_verifier,reviewed_at,is_final,key_finality)
         VALUES($1,$2,$3,$4,2004,'Ciência da Computação','BACHARELADO',$5,64,2,'VERIFIED','ASSISTED',
          'test-only-reviewer',now(),$6,$7)`,
        [id,`TEST ONLY ${kind} ${prefix}`,`https://download.inep.gov.br/enade/test-fixtures/${id}.pdf`,kind,
          createHash("sha256").update(`TEST ONLY ${id}`).digest("hex"),kind==="ANSWER_KEY",kind==="ANSWER_KEY"?"ONLY_PUBLISHED":null]);
    for (let n=1;n<=45;n++) {
      const parent=`${prefix}-${n}`, version=`${parent}-v1`;
      await client.query("INSERT INTO editorial_question(id,origin,official_exam_id,official_question_number) VALUES($1,'OFFICIAL',$2,$3)",[parent,exam,n]);
      await client.query(
        `INSERT INTO question_version(id,question_id,title,topic,prompt,origin,editorial_status,explanation,
          correct_option_id,author_credit,explanation_credit,exam_source_id,key_source_id,source_page,
          source_question_number,key_page,review_origin,assisted_extractor,assisted_reviewer,reviewed_at)
         VALUES($1,$2,$3,$4,'TEST ONLY synthetic prompt','OFFICIAL','DRAFT','TEST ONLY private explanation',
          'A','TEST ONLY synthetic source','TEST ONLY',$5,$6,1,$7,1,'ASSISTED','test-only-extractor','test-only-reviewer',now())`,
        [version,parent,`TEST ONLY format ${n}`,n<=15?"Formação Geral":"Algoritmos",exam,key,n]);
      for (const [position,id] of ["A","B","C","D","E"].entries())
        await client.query("INSERT INTO question_option(question_id,id,text,position) VALUES($1,$2,$3,$4)",[version,id,`TEST ONLY ${id}`,position]);
      await client.query("UPDATE question_version SET editorial_status='PUBLISHED' WHERE id=$1",[version]);
      await client.query("UPDATE editorial_question SET current_version_id=$2 WHERE id=$1",[parent,version]);
    }
    const original=await readFile("tests/fixtures/test-only-question.webp");
    for (const part of ["PROMPT","STANDARD"]) {
      // Distinct hashes are needed to verify that the standard cannot be fetched
      // through permission to read the prompt. An unknown RIFF chunk changes no pixels.
      const marker=Buffer.from(`TEST ONLY ${prefix} ${part}`), padding=marker.length%2;
      const chunk=Buffer.alloc(8+marker.length+padding);
      chunk.write("TST0"); chunk.writeUInt32LE(marker.length,4); marker.copy(chunk,8);
      const bytes=Buffer.concat([original,chunk]); bytes.writeUInt32LE(bytes.length-8,4);
      const asset=await storeAsset(client,bytes); assets.push(asset.sha256);
    }
    await client.query(
      `INSERT INTO discursive_question(id,exam_source_id,standard_source_id,year,modality,number,area,subject,
        criteria,review_origin,assisted_extractor,assisted_reviewer)
       VALUES($1,$2,$3,2004,'BACHARELADO',3,'Algoritmos','TEST ONLY discursiva',
         '[{"label":"a","points":4},{"label":"b","points":6}]','ASSISTED','test-only-extractor','test-only-reviewer')`,[discursive,exam,standard]);
    for (const [index,part] of ["PROMPT","STANDARD"].entries()) await client.query(
      "INSERT INTO discursive_image(question_id,part,position,asset_sha256,source_page,box,dpi) VALUES($1,$2,1,$3,1,'{30,60,410,186}',200)",[discursive,part,assets[index]]);
    await client.query("COMMIT");
  } catch(error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
  return {exam,key,standard,discursive,assets,async cleanup(owners:string[]) {
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM practice_attempt WHERE owner_id=ANY($1::uuid[])",[owners]);
      await client.query("DELETE FROM discursive_response WHERE owner_id=ANY($1::uuid[])",[owners]);
      await client.query("DELETE FROM discursive_question WHERE id=$1",[discursive]);
      await client.query("DELETE FROM editorial_question WHERE official_exam_id=$1",[exam]);
      await client.query("DELETE FROM source_document WHERE id=ANY($1::uuid[])",[[exam,key,standard]]);
      await client.query("DELETE FROM study_identity WHERE id=ANY($1::uuid[])",[owners]);
      await client.query("DELETE FROM question_asset WHERE sha256=ANY($1::text[])",[assets]);
      await client.query("COMMIT");
      for (const sha of assets) await rm(assetPath(sha),{force:true});
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }};
}
