import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { PortfolioSnapshot, PortfolioClient } from '../types/portfolio';

// Maximum records per chunk to stay well below the 1MB (1,048,576 bytes) Firestore limit.
// 250 records is ~75KB, safely ~7% of the limit.
export const CHUNK_SIZE = 250;

/**
 * Sanitizes an object recursively to eliminate undefined values and ensure Firestore compatibility.
 */
export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date || obj?.toMillis !== undefined || obj?.seconds !== undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      clean[key] = null;
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      (value as any)?.toMillis === undefined &&
      (value as any)?.seconds === undefined
    ) {
      clean[key] = sanitizeForFirestore(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Strips heavy duplicate arrays and cleans individual records for minimal storage footprint.
 */
function cleanClientRecord(r: PortfolioClient): PortfolioClient {
  return {
    id: r.id || '',
    clientName: r.clientName || '',
    identification: r.identification || '',
    operationNumber: r.operationNumber || '',
    collectorName: r.collectorName || 'Sin Asignar',
    isUnassigned: Boolean(
      r.isUnassigned ||
      !r.collectorName ||
      r.collectorName.toLowerCase().includes('sin asignar') ||
      r.collectorName.toLowerCase().includes('oficina')
    ),
    recoveredStatus: r.recoveredStatus,
    amount: Number(r.amount) || 0,
    overdueDays: Number(r.overdueDays) || 0,
    bracket: r.bracket,
    phone: r.phone || '',
    itemSold: r.itemSold || '',
    address: r.address || '',
    saleDate: r.saleDate || '',
    lastPaymentDate: r.lastPaymentDate || '',
    lastPaymentAmount: r.lastPaymentAmount ? Number(r.lastPaymentAmount) : 0,
    installmentAmount: r.installmentAmount ? Number(r.installmentAmount) : 0,
    pendingDownPayment: r.pendingDownPayment ? Number(r.pendingDownPayment) : 0,
    totalPayments: r.totalPayments ? Number(r.totalPayments) : 0,
    saleValue: r.saleValue ? Number(r.saleValue) : 0,
    installmentNumber: r.installmentNumber || '',
    previousAmount: r.previousAmount !== undefined ? Number(r.previousAmount) : undefined,
    previousOverdueDays: r.previousOverdueDays !== undefined ? Number(r.previousOverdueDays) : undefined,
    isPartialPayment: Boolean(r.isPartialPayment),
    notes: r.notes || ''
  };
}

/**
 * Saves a portfolio snapshot safely into Firestore without ever exceeding the 1MB limit.
 * If the records list is large (> 200 records), records are stored in chunked sub-documents
 * inside the subcollection `portfolio_snapshots/{snapshotId}/record_chunks/`.
 */
export async function savePortfolioSnapshotToFirestore(
  snapshotData: PortfolioSnapshot,
  existingId?: string
): Promise<PortfolioSnapshot> {
  const allRecords = (snapshotData.records || []).map(cleanClientRecord);
  const shouldChunk = allRecords.length > 200;

  // Prepare root document payload
  // Avoid saving redundant full newClients array in Firestore (keep counts and amounts)
  const rootPayload: any = {
    enterpriseId: snapshotData.enterpriseId || '',
    month: snapshotData.month,
    cutoffDate: snapshotData.cutoffDate,
    snapshotType: snapshotData.snapshotType,
    isMasterPortfolio: Boolean(snapshotData.isMasterPortfolio),
    title: snapshotData.title,
    totalClients: allRecords.length,
    totalAmount: snapshotData.totalAmount,
    bracketSummary: snapshotData.bracketSummary,
    collectorSummary: snapshotData.collectorSummary,
    recoveredClients: (snapshotData.recoveredClients || []).map(cleanClientRecord),
    recoveredAmount: snapshotData.recoveredAmount || 0,
    recoveredCount: snapshotData.recoveredCount || (snapshotData.recoveredClients ? snapshotData.recoveredClients.length : 0),
    newClients: [], // Do NOT duplicate all records here to prevent hitting Firestore 1MB limits
    newAmount: snapshotData.newAmount || 0,
    newCount: snapshotData.newCount || (snapshotData.newClients ? snapshotData.newClients.length : 0),
    previousSnapshotId: snapshotData.previousSnapshotId || null,
    collectorName: snapshotData.collectorName || null,
    hasChunks: shouldChunk,
    chunkCount: shouldChunk ? Math.ceil(allRecords.length / CHUNK_SIZE) : 0,
    records: shouldChunk ? [] : allRecords,
    updatedAt: Timestamp.now()
  };

  if (!existingId) {
    rootPayload.createdAt = Timestamp.now();
  }

  const cleanMainDoc = sanitizeForFirestore(rootPayload);
  let targetSnapshotId = existingId;

  if (targetSnapshotId) {
    await updateDoc(doc(db, 'portfolio_snapshots', targetSnapshotId), cleanMainDoc);
  } else {
    const docRef = await addDoc(collection(db, 'portfolio_snapshots'), cleanMainDoc);
    targetSnapshotId = docRef.id;
  }

  // Handle Chunk Subcollection if needed
  if (shouldChunk && targetSnapshotId) {
    // 1. Fetch existing chunks to handle deletions if the new count is smaller
    const chunksCollRef = collection(db, 'portfolio_snapshots', targetSnapshotId, 'record_chunks');
    const existingChunksSnap = await getDocs(chunksCollRef);
    const existingChunkIds = new Set(existingChunksSnap.docs.map(d => d.id));

    // 2. Write new chunks
    const chunkCount = Math.ceil(allRecords.length / CHUNK_SIZE);
    const updatedChunkIds = new Set<string>();

    for (let i = 0; i < chunkCount; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, allRecords.length);
      const chunkRecords = allRecords.slice(start, end);
      const chunkDocId = `chunk_${String(i).padStart(4, '0')}`;
      updatedChunkIds.add(chunkDocId);

      const chunkRef = doc(db, 'portfolio_snapshots', targetSnapshotId, 'record_chunks', chunkDocId);
      const chunkData = sanitizeForFirestore({
        chunkIndex: i,
        recordCount: chunkRecords.length,
        records: chunkRecords,
        updatedAt: Timestamp.now()
      });

      const batch = writeBatch(db);
      batch.set(chunkRef, chunkData);
      await batch.commit();
    }

    // 3. Delete obsolete chunks if any
    const toDelete: string[] = [];
    existingChunkIds.forEach(id => {
      if (!updatedChunkIds.has(id)) {
        toDelete.push(id);
      }
    });

    if (toDelete.length > 0) {
      const delBatch = writeBatch(db);
      toDelete.forEach(delId => {
        delBatch.delete(doc(db, 'portfolio_snapshots', targetSnapshotId!, 'record_chunks', delId));
      });
      await delBatch.commit();
    }
  } else if (!shouldChunk && targetSnapshotId) {
    // If not chunked, make sure to clean up any old chunks if previously chunked
    try {
      const chunksCollRef = collection(db, 'portfolio_snapshots', targetSnapshotId, 'record_chunks');
      const existingChunksSnap = await getDocs(chunksCollRef);
      if (!existingChunksSnap.empty) {
        const delBatch = writeBatch(db);
        existingChunksSnap.docs.forEach(d => delBatch.delete(d.ref));
        await delBatch.commit();
      }
    } catch {
      // Ignore if no chunks exist
    }
  }

  // Return the complete snapshot with full in-memory records
  return {
    ...snapshotData,
    id: targetSnapshotId,
    records: allRecords,
    hasChunks: shouldChunk,
    chunkCount: shouldChunk ? Math.ceil(allRecords.length / CHUNK_SIZE) : 0
  };
}

/**
 * Fetches all records of a snapshot.
 * If the records are already in memory, returns them directly.
 * If the snapshot has chunks, fetches all chunks from the subcollection in order.
 */
export async function fetchSnapshotRecords(
  snapshot: PortfolioSnapshot
): Promise<PortfolioClient[]> {
  if (snapshot.records && snapshot.records.length > 0) {
    return snapshot.records;
  }

  if (!snapshot.id) {
    return [];
  }

  try {
    const chunksCollRef = collection(db, 'portfolio_snapshots', snapshot.id, 'record_chunks');
    const chunksSnap = await getDocs(chunksCollRef);

    if (chunksSnap.empty) {
      return snapshot.records || [];
    }

    const chunkDocs = chunksSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as { chunkIndex?: number; records?: PortfolioClient[] }[];

    // Sort chunks by chunkIndex or document id
    chunkDocs.sort((a, b) => {
      const idxA = a.chunkIndex ?? 0;
      const idxB = b.chunkIndex ?? 0;
      return idxA - idxB;
    });

    const fullRecords: PortfolioClient[] = [];
    for (const chunk of chunkDocs) {
      if (Array.isArray(chunk.records)) {
        fullRecords.push(...chunk.records);
      }
    }

    // Cache on snapshot object
    snapshot.records = fullRecords;
    return fullRecords;
  } catch (err) {
    console.error('Error fetching snapshot records chunks:', err);
    return snapshot.records || [];
  }
}

/**
 * Deletes a portfolio snapshot from Firestore, including all its subcollection chunk documents.
 */
export async function deletePortfolioSnapshotFromFirestore(
  snapshotId: string
): Promise<void> {
  if (!snapshotId) return;

  try {
    // 1. Delete all chunk documents
    const chunksCollRef = collection(db, 'portfolio_snapshots', snapshotId, 'record_chunks');
    const chunksSnap = await getDocs(chunksCollRef);
    if (!chunksSnap.empty) {
      const batch = writeBatch(db);
      chunksSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn('Error deleting record chunks (may not exist):', err);
  }

  // 2. Delete main snapshot document
  await deleteDoc(doc(db, 'portfolio_snapshots', snapshotId));
}
