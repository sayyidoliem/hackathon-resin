import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Cycle } from "@/types";

const cyclesCol = (userId: string) =>
  collection(db, "users", userId, "cycles");

export async function addCycle(
  userId: string,
  data: Omit<Cycle, "firestoreId" | "userId" | "createdAt">
): Promise<string> {
  const ref = await addDoc(cyclesCol(userId), {
    ...data,
    userId,
    isDraft: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getCycles(userId: string): Promise<Cycle[]> {
  const q = query(cyclesCol(userId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...(d.data() as Omit<Cycle, "firestoreId">),
    firestoreId: d.id,
  }));
}

export async function getCycle(
  userId: string,
  firestoreId: string
): Promise<Cycle | null> {
  const ref = doc(db, "users", userId, "cycles", firestoreId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<Cycle, "firestoreId">), firestoreId: snap.id };
}

// Draft is stored as a single well-known document so it can be overwritten
const draftDocRef = (userId: string) =>
  doc(db, "users", userId, "drafts", "new-cycle");

export async function saveDraft(
  userId: string,
  data: Omit<Cycle, "firestoreId" | "userId" | "createdAt">
): Promise<void> {
  await setDoc(draftDocRef(userId), {
    ...data,
    userId,
    isDraft: true,
    createdAt: serverTimestamp(),
  });
}

export async function getDraft(userId: string): Promise<Cycle | null> {
  const snap = await getDoc(draftDocRef(userId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<Cycle, "firestoreId">), firestoreId: snap.id };
}

export async function deleteDraft(userId: string): Promise<void> {
  await deleteDoc(draftDocRef(userId));
}

export function genCycleId(existingIds: string[]): string {
  const d = new Date();
  const key = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const count = existingIds.filter((id) => id.includes(key)).length;
  return `RSP-${key}-${String(count + 1).padStart(3, "0")}`;
}
