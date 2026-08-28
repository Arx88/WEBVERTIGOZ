import { connectDb } from "./connect.mjs";

const ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";
const pool = await connectDb();
try {
  const before = await pool.query(
    "SELECT scheduled_at_start, scheduled_at_end, jornada_label, ready_a_at, ready_b_at, status FROM match WHERE id=$1",
    [ID]
  );
  console.log("BEFORE:", JSON.stringify(before.rows[0]));
  const res = await pool.query(
    `UPDATE match SET scheduled_at_start=NULL, scheduled_at_end=NULL, jornada_label=NULL, updated_at=now()
     WHERE id=$1 AND status='scheduled'
     RETURNING scheduled_at_start, scheduled_at_end, jornada_label, status`,
    [ID]
  );
  console.log("AFTER:", JSON.stringify(res.rows[0]));
} finally {
  await pool.end();
}
