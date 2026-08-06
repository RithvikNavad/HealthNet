export type SavedMedication = {
  id: string;
  visitorId: string;
  name: string;
  strengthAndForm: string;
  dosage: string;
  timesPerDay: number;
  doseTimes: string[];
  rxcui?: string;
  createdAt: string;
};

const DATABASE_NAME = "healthnet-medications";
const STORE_NAME = "medications";

function openMedicationDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("visitorId", "visitorId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Medication storage could not be opened."));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("The medication storage operation failed."));
    transaction.onabort = () => reject(transaction.error || new Error("The medication storage operation was cancelled."));
  });
}

export async function listSavedMedications(visitorId: string) {
  const database = await openMedicationDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).index("visitorId").getAll(visitorId);
    const medications = await new Promise<SavedMedication[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as SavedMedication[]);
      request.onerror = () => reject(request.error || new Error("Medications could not be loaded."));
    });
    await waitForTransaction(transaction);
    return medications.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } finally {
    database.close();
  }
}

export async function saveMedication(medication: Omit<SavedMedication, "id" | "createdAt">) {
  const saved: SavedMedication = { ...medication, id: window.crypto.randomUUID(), createdAt: new Date().toISOString() };
  const database = await openMedicationDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(saved);
    await waitForTransaction(transaction);
    return saved;
  } finally {
    database.close();
  }
}

export async function removeSavedMedication(id: string) {
  const database = await openMedicationDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    await waitForTransaction(transaction);
  } finally {
    database.close();
  }
}
