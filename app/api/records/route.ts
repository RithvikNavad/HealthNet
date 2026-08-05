import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../db";
import { medicalRecords } from "../../../db/schema";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const VisitorIdSchema = z.string().uuid();

type RecordsEnv = typeof env & { RECORDS?: R2Bucket };

function bucket() {
  const recordsBucket = (env as RecordsEnv).RECORDS;
  if (!recordsBucket) throw new Error("The medical-record storage binding is unavailable.");
  return recordsBucket;
}

function publicRecord(record: typeof medicalRecords.$inferSelect) {
  return {
    id: record.id,
    fileName: record.fileName,
    sizeBytes: record.sizeBytes,
    mimeType: record.mimeType,
    uploadedAt: record.uploadedAt,
  };
}

export async function GET(request: Request) {
  const visitorId = VisitorIdSchema.safeParse(new URL(request.url).searchParams.get("visitorId"));
  if (!visitorId.success) return Response.json({ error: "A valid visitor ID is required." }, { status: 400 });

  try {
    const records = await getDb().select().from(medicalRecords)
      .where(eq(medicalRecords.visitorId, visitorId.data))
      .orderBy(desc(medicalRecords.uploadedAt));
    return Response.json({ records: records.map(publicRecord) });
  } catch (error) {
    console.error("Medical-record list failed", { error: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "Your medical documents could not be loaded right now." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const visitorId = VisitorIdSchema.safeParse(form?.get("visitorId"));
  const file = form?.get("file");
  if (!visitorId.success || !(file instanceof File)) {
    return Response.json({ error: "Choose a PDF file to upload." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_PDF_BYTES) {
    return Response.json({ error: "The PDF must be larger than 0 bytes and no more than 10 MB." }, { status: 400 });
  }
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "Only PDF documents are supported." }, { status: 400 });
  }
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== "%PDF-") {
    return Response.json({ error: "That file does not appear to be a valid PDF." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const objectKey = `medical-records/${visitorId.data}/${id}.pdf`;
  const uploadedAt = new Date().toISOString();
  const record = {
    id,
    visitorId: visitorId.data,
    objectKey,
    fileName: file.name.slice(0, 180),
    sizeBytes: file.size,
    mimeType: "application/pdf",
    uploadedAt,
  };

  try {
    const recordsBucket = bucket();
    await recordsBucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: { originalName: record.fileName },
    });
    try {
      await getDb().insert(medicalRecords).values(record);
    } catch (error) {
      await recordsBucket.delete(objectKey);
      throw error;
    }
    return Response.json({ record: publicRecord(record) }, { status: 201 });
  } catch (error) {
    console.error("Medical-record upload failed", { error: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "The PDF could not be saved right now. Please try again." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const search = new URL(request.url).searchParams;
  const visitorId = VisitorIdSchema.safeParse(search.get("visitorId"));
  const id = z.string().uuid().safeParse(search.get("id"));
  if (!visitorId.success || !id.success) {
    return Response.json({ error: "A valid document and visitor ID are required." }, { status: 400 });
  }

  try {
    const db = getDb();
    const [record] = await db.select().from(medicalRecords).where(and(
      eq(medicalRecords.id, id.data),
      eq(medicalRecords.visitorId, visitorId.data),
    )).limit(1);
    if (!record) return Response.json({ error: "Document not found." }, { status: 404 });

    await bucket().delete(record.objectKey);
    await db.delete(medicalRecords).where(and(
      eq(medicalRecords.id, id.data),
      eq(medicalRecords.visitorId, visitorId.data),
    ));
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Medical-record removal failed", { error: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "The PDF could not be removed right now." }, { status: 503 });
  }
}
