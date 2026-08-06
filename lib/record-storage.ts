export type StoredMedicalRecord = {
  id: string;
  visitorId: string;
  category?: DocumentCategory;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  file: Blob;
};

export type DocumentCategory = "records" | "labs";

const DATABASE_NAME = "healthnet-records";
const STORE_NAME = "medical-documents";
const DATABASE_VERSION = 1;

function openRecordsDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("visitorId", "visitorId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local document storage could not be opened."));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("The local storage operation failed."));
    transaction.onabort = () => reject(transaction.error || new Error("The local storage operation was cancelled."));
  });
}

export async function listMedicalRecords(visitorId: string, category: DocumentCategory = "records") {
  const database = await openRecordsDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).index("visitorId").getAll(visitorId);
    const records = await new Promise<StoredMedicalRecord[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredMedicalRecord[]);
      request.onerror = () => reject(request.error || new Error("Local documents could not be loaded."));
    });
    await waitForTransaction(transaction);
    return records
      .filter((record) => category === "records" ? !record.category || record.category === "records" : record.category === category)
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
  } finally {
    database.close();
  }
}

export async function saveMedicalRecord(visitorId: string, file: File, category: DocumentCategory = "records") {
  const record: StoredMedicalRecord = {
    id: window.crypto.randomUUID(),
    visitorId,
    category,
    fileName: file.name.slice(0, 180),
    sizeBytes: file.size,
    mimeType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    file,
  };
  const database = await openRecordsDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    await waitForTransaction(transaction);
    return record;
  } finally {
    database.close();
  }
}

export async function removeMedicalRecord(id: string) {
  const database = await openRecordsDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}
